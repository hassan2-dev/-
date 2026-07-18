/**
 * One-time migration: Firestore → PostgreSQL, then Bunny images → Cloudflare R2.
 *
 * Usage (from backend/):
 *   npx tsx scripts/migrate-from-firestore.ts
 *   npx tsx scripts/migrate-from-firestore.ts --dry-run
 *   npx tsx scripts/migrate-from-firestore.ts --data-only
 *   npx tsx scripts/migrate-from-firestore.ts --images-only
 *
 * Safety for images:
 *   download OK → upload R2 → update Postgres URL
 *   any failure → keep old URL
 */

import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { extname, resolve } from 'path';
import { PrismaClient, OrderStatus, Prisma } from '@prisma/client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const scriptDir = resolve(process.cwd());

// ─── CLI / env ───────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const DATA_ONLY = args.has('--data-only');
const IMAGES_ONLY = args.has('--images-only');

function loadEnv() {
  const envPath = resolve(scriptDir, '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'basjfk-58536';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
const R2_BUCKET = process.env.R2_BUCKET || 'tofaha';
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '');

const prisma = new PrismaClient();

// ─── helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[migrate:warn] ${msg}`);
}

function normalizeIraqiPhone(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('964') && digits.length >= 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 11) return digits;
  if (digits.length === 10 && digits.startsWith('7')) return `0${digits}`;
  return digits;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function mapOrderStatus(raw: unknown): OrderStatus {
  const s = String(raw || 'pending')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  const map: Record<string, OrderStatus> = {
    pending: OrderStatus.PENDING,
    accepted: OrderStatus.ACCEPTED,
    preparing: OrderStatus.PREPARING,
    on_the_way: OrderStatus.ON_THE_WAY,
    ontheway: OrderStatus.ON_THE_WAY,
    delivered: OrderStatus.DELIVERED,
    cancelled: OrderStatus.CANCELLED,
    canceled: OrderStatus.CANCELLED,
  };
  return map[s] || OrderStatus.PENDING;
}

function parseFirestoreValue(value: any): any {
  if (value === undefined || value === null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in value) {
    const result: Record<string, any> = {};
    const fields = value.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      result[key] = parseFirestoreValue(fields[key]);
    }
    return result;
  }
  return null;
}

function parseFirestoreDoc(doc: any): any {
  const fields = doc.fields || {};
  const result: Record<string, any> = {};
  for (const key of Object.keys(fields)) {
    result[key] = parseFirestoreValue(fields[key]);
  }
  const nameParts = String(doc.name || '').split('/');
  result.id = nameParts[nameParts.length - 1];
  return result;
}

async function getFirebaseIdToken(): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { idToken?: string; error?: { message?: string } };
  if (!res.ok || !data.idToken) {
    throw new Error(`Firebase anonymous auth failed: ${data.error?.message || res.status}`);
  }
  return data.idToken;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchCollection(collectionName: string, token: string): Promise<any[]> {
  const docs: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${FIRESTORE_BASE}/${collectionName}`);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    let attempt = 0;
    let data: {
      documents?: any[];
      nextPageToken?: string;
      error?: { message?: string; status?: string };
    } = {};
    let res: Response | null = null;

    while (attempt < 6) {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      data = (await res.json()) as typeof data;

      const msg = data.error?.message || '';
      const quotaHit =
        res.status === 429 ||
        /quota|resource.?exhausted|rate/i.test(msg);

      if (res.ok) break;
      if (!quotaHit) {
        throw new Error(
          `Firestore ${collectionName} failed: ${msg || res.status}`,
        );
      }

      attempt++;
      const wait = Math.min(30_000, 1500 * 2 ** attempt);
      warn(`quota on ${collectionName}, retry ${attempt}/6 after ${wait}ms`);
      await sleep(wait);
    }

    if (!res?.ok) {
      throw new Error(
        `Firestore ${collectionName} failed after retries: ${data.error?.message || res?.status}`,
      );
    }

    for (const doc of data.documents || []) {
      docs.push(parseFirestoreDoc(doc));
    }
    pageToken = data.nextPageToken;
    await sleep(250);
  } while (pageToken);

  return docs;
}

function guessContentType(url: string, headerType?: string | null): string {
  if (headerType && headerType.startsWith('image/')) return headerType.split(';')[0].trim();
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function extFromContentType(contentType: string, url: string): string {
  const fromUrl = extname(url.split('?')[0]);
  if (fromUrl && fromUrl.length <= 5) return fromUrl;
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  return '.jpg';
}

function isAlreadyOnR2(url: string): boolean {
  if (!url) return false;
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) return true;
  return url.includes('.r2.dev/') || url.includes('.r2.cloudflarestorage.com/');
}

function isHttpUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

// ─── data migration ──────────────────────────────────────────────────────────

async function migrateData(token: string) {
  log('Fetching Firestore collections...');
  const categories = await fetchCollection('categories', token);
  const products = await fetchCollection('products', token);
  const banners = await fetchCollection('banners', token);
  const offers = await fetchCollection('offers', token);
  const orders = await fetchCollection('orders', token);
  const notifications = await fetchCollection('notifications', token);
  const pushTokens = await fetchCollection('push_tokens', token);
  const settingsDocs = await fetchCollection('settings', token);

  log(
    `Fetched: categories=${categories.length} products=${products.length} banners=${banners.length} offers=${offers.length} orders=${orders.length} notifications=${notifications.length} push_tokens=${pushTokens.length}`,
  );

  if (DRY_RUN) {
    log('Dry-run: skipping DB writes for data.');
    return { categories, products, banners, offers };
  }

  // Categories (pass 1: without parent)
  const categoryIdByLegacy = new Map<string, string>();
  const categoryIdByName = new Map<string, string>();

  for (const c of categories) {
    const legacyId = String(c.id);
    const existing = await prisma.category.findUnique({ where: { legacyId } });
    const data = {
      name: String(c.name || 'بدون اسم'),
      image: String(c.image || ''),
      createdAt: toDate(c.createdAt) || undefined,
      updatedAt: toDate(c.updatedAt) || undefined,
    };

    const row = existing
      ? await prisma.category.update({ where: { id: existing.id }, data })
      : await prisma.category.create({
          data: { ...data, legacyId, parentId: null },
        });

    categoryIdByLegacy.set(legacyId, row.id);
    categoryIdByName.set(row.name.trim(), row.id);
  }

  // Categories (pass 2: parents)
  for (const c of categories) {
    if (!c.parentId) continue;
    const id = categoryIdByLegacy.get(String(c.id));
    const parentId = categoryIdByLegacy.get(String(c.parentId));
    if (!id || !parentId || id === parentId) continue;
    await prisma.category.update({ where: { id }, data: { parentId } });
  }
  log(`Categories migrated: ${categories.length}`);

  // Ensure a fallback category for orphan products
  let fallbackCategoryId = categoryIdByName.values().next().value as string | undefined;
  if (!fallbackCategoryId) {
    const fallback = await prisma.category.create({
      data: {
        name: 'عام',
        image: '',
        legacyId: '__migrated_uncategorized__',
      },
    });
    fallbackCategoryId = fallback.id;
  }

  // Products
  let productsOk = 0;
  for (const p of products) {
    const legacyId = String(p.id);
    const categoryName = String(p.category || '').trim();
    const categoryId =
      categoryIdByName.get(categoryName) ||
      [...categoryIdByName.entries()].find(
        ([n]) => n.toLowerCase() === categoryName.toLowerCase(),
      )?.[1] ||
      fallbackCategoryId!;

    const price = Number(p.price ?? 0);
    const originalPrice =
      p.originalPrice !== undefined && p.originalPrice !== null
        ? Number(p.originalPrice)
        : null;
    const image =
      String(p.image || p.image1 || '') ||
      (Array.isArray(p.images) && p.images[0]?.data ? String(p.images[0].data) : '');

    const data = {
      name: String(p.name || 'منتج'),
      description: p.desc != null ? String(p.desc) : p.description != null ? String(p.description) : null,
      categoryId,
      price: new Prisma.Decimal(Number.isFinite(price) ? price : 0),
      originalPrice:
        originalPrice !== null && Number.isFinite(originalPrice)
          ? new Prisma.Decimal(originalPrice)
          : null,
      hasDiscount: Boolean(p.hasDiscount),
      discountPercent:
        p.discountPercent !== undefined && p.discountPercent !== null
          ? Number(p.discountPercent)
          : null,
      image,
      image1: p.image1 != null ? String(p.image1) : null,
      image2: p.image2 != null ? String(p.image2) : null,
      images: Array.isArray(p.images)
        ? (p.images as Prisma.InputJsonValue)
        : undefined,
      createdAt: toDate(p.createdAt) || undefined,
      updatedAt: toDate(p.updatedAt) || undefined,
    };

    const existing = await prisma.product.findUnique({ where: { legacyId } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data: { ...data, legacyId } });
    }
    productsOk++;
  }
  log(`Products migrated: ${productsOk}`);

  // Banners
  for (const b of banners) {
    const legacyId = String(b.id);
    const data = {
      image: String(b.image || ''),
      sortOrder: Number(b.sortOrder ?? 0) || 0,
      createdAt: toDate(b.createdAt) || undefined,
      updatedAt: toDate(b.updatedAt) || undefined,
    };
    const existing = await prisma.banner.findUnique({ where: { legacyId } });
    if (existing) await prisma.banner.update({ where: { id: existing.id }, data });
    else await prisma.banner.create({ data: { ...data, legacyId } });
  }
  log(`Banners migrated: ${banners.length}`);

  // Offers
  for (const o of offers) {
    const legacyId = String(o.id);
    const data = {
      image: String(o.image || ''),
      sortOrder: Number(o.sortOrder ?? 0) || 0,
      createdAt: toDate(o.createdAt) || undefined,
      updatedAt: toDate(o.updatedAt) || undefined,
    };
    const existing = await prisma.offer.findUnique({ where: { legacyId } });
    if (existing) await prisma.offer.update({ where: { id: existing.id }, data });
    else await prisma.offer.create({ data: { ...data, legacyId } });
  }
  log(`Offers migrated: ${offers.length}`);

  // Users from unique order phones
  const phoneToUserId = new Map<string, string>();
  const phones = new Set<string>();
  for (const o of orders) {
    const phone = normalizeIraqiPhone(String(o.phone || ''));
    if (phone) phones.add(phone);
  }
  for (const phone of phones) {
    const user = await prisma.user.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });
    phoneToUserId.set(phone, user.id);
  }
  log(`Users upserted from orders: ${phones.size}`);

  // Orders
  const orderIdByLegacy = new Map<string, string>();
  for (const o of orders) {
    const legacyId = String(o.id);
    const phone = normalizeIraqiPhone(String(o.phone || ''));
    const userId = phone ? phoneToUserId.get(phone) : undefined;
    const items = Array.isArray(o.items) ? o.items : [];
    const data = {
      userId: userId || null,
      name: String(o.name || ''),
      phone: phone || String(o.phone || ''),
      address: String(o.address || ''),
      email: o.email != null ? String(o.email) : null,
      items: items as Prisma.InputJsonValue,
      total: new Prisma.Decimal(Number(o.total ?? 0) || 0),
      totalDiscount: new Prisma.Decimal(Number(o.totalDiscount ?? 0) || 0),
      status: mapOrderStatus(o.status),
      isScheduled: Boolean(o.isScheduled),
      scheduledAt: toDate(o.scheduledAt),
      statusUpdatedAt: toDate(o.statusUpdatedAt),
      updatedBy: o.updatedBy != null ? String(o.updatedBy) : null,
      createdAt: toDate(o.createdAt) || undefined,
      updatedAt: toDate(o.updatedAt) || undefined,
    };
    const existing = await prisma.order.findUnique({ where: { legacyId } });
    const row = existing
      ? await prisma.order.update({ where: { id: existing.id }, data })
      : await prisma.order.create({ data: { ...data, legacyId } });
    orderIdByLegacy.set(legacyId, row.id);
  }
  log(`Orders migrated: ${orders.length}`);

  // Notifications
  for (const n of notifications) {
    const legacyId = String(n.id);
    const phone = n.phone ? normalizeIraqiPhone(String(n.phone)) : null;
    const userId = phone ? phoneToUserId.get(phone) || null : null;
    const legacyOrderId = n.orderId != null ? String(n.orderId) : null;
    const orderId = legacyOrderId ? orderIdByLegacy.get(legacyOrderId) || null : null;

    const data = {
      userId,
      orderId,
      title: String(n.title || ''),
      body: String(n.body || ''),
      phone,
      email: n.email != null ? String(n.email) : null,
      status: n.status != null ? String(n.status) : null,
      broadcast: Boolean(n.broadcast),
      read: Boolean(n.read),
      createdAt: toDate(n.createdAt) || undefined,
    };

    const existing = await prisma.notification.findUnique({ where: { legacyId } });
    if (existing) await prisma.notification.update({ where: { id: existing.id }, data });
    else await prisma.notification.create({ data: { ...data, legacyId } });
  }
  log(`Notifications migrated: ${notifications.length}`);

  // Push tokens
  let pushOk = 0;
  for (const t of pushTokens) {
    const tokenValue = String(t.token || '').trim();
    if (!tokenValue) continue;
    const phone = t.phone ? normalizeIraqiPhone(String(t.phone)) : null;
    const userId = phone ? phoneToUserId.get(phone) || null : null;
    await prisma.pushToken.upsert({
      where: { token: tokenValue },
      create: {
        token: tokenValue,
        userId,
        phone,
        email: t.email != null ? String(t.email) : null,
        platform: t.platform != null ? String(t.platform) : null,
      },
      update: {
        userId,
        phone,
        email: t.email != null ? String(t.email) : null,
        platform: t.platform != null ? String(t.platform) : null,
      },
    });
    pushOk++;
  }
  log(`Push tokens migrated: ${pushOk}`);

  // Store settings
  const store = settingsDocs.find((s) => s.id === 'store') || settingsDocs[0];
  if (store) {
    await prisma.storeSettings.upsert({
      where: { id: 'store' },
      create: {
        id: 'store',
        openTime: String(store.openTime || '09:00'),
        closeTime: String(store.closeTime || '22:00'),
        timezone: String(store.timezone || 'Asia/Baghdad'),
        enabled: store.enabled !== false,
      },
      update: {
        openTime: String(store.openTime || '09:00'),
        closeTime: String(store.closeTime || '22:00'),
        timezone: String(store.timezone || 'Asia/Baghdad'),
        enabled: store.enabled !== false,
      },
    });
    log('Store settings migrated');
  }

  await prisma.catalogMeta.upsert({
    where: { id: 'version' },
    create: { id: 'version' },
    update: {},
  });

  return { categories, products, banners, offers };
}

// ─── image migration ─────────────────────────────────────────────────────────

type ImageRef = {
  table: 'categories' | 'products' | 'banners' | 'offers';
  id: string;
  field: 'image' | 'image1' | 'image2' | 'images';
  url: string;
  imagesIndex?: number;
};

function getR2Client(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey || !R2_ENDPOINT) {
    throw new Error('R2 credentials missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT)');
  }
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function collectImageRefs(): Promise<ImageRef[]> {
  const refs: ImageRef[] = [];

  const categories = await prisma.category.findMany({
    select: { id: true, image: true },
  });
  for (const c of categories) {
    if (isHttpUrl(c.image) && !isAlreadyOnR2(c.image)) {
      refs.push({ table: 'categories', id: c.id, field: 'image', url: c.image });
    }
  }

  const products = await prisma.product.findMany({
    select: { id: true, image: true, image1: true, image2: true, images: true },
  });
  for (const p of products) {
    if (isHttpUrl(p.image) && !isAlreadyOnR2(p.image)) {
      refs.push({ table: 'products', id: p.id, field: 'image', url: p.image });
    }
    if (isHttpUrl(p.image1) && !isAlreadyOnR2(p.image1)) {
      refs.push({ table: 'products', id: p.id, field: 'image1', url: p.image1 });
    }
    if (isHttpUrl(p.image2) && !isAlreadyOnR2(p.image2)) {
      refs.push({ table: 'products', id: p.id, field: 'image2', url: p.image2 });
    }
    if (Array.isArray(p.images)) {
      p.images.forEach((item: any, index: number) => {
        const url = item?.data;
        if (isHttpUrl(url) && !isAlreadyOnR2(url)) {
          refs.push({
            table: 'products',
            id: p.id,
            field: 'images',
            url,
            imagesIndex: index,
          });
        }
      });
    }
  }

  const banners = await prisma.banner.findMany({ select: { id: true, image: true } });
  for (const b of banners) {
    if (isHttpUrl(b.image) && !isAlreadyOnR2(b.image)) {
      refs.push({ table: 'banners', id: b.id, field: 'image', url: b.image });
    }
  }

  const offers = await prisma.offer.findMany({ select: { id: true, image: true } });
  for (const o of offers) {
    if (isHttpUrl(o.image) && !isAlreadyOnR2(o.image)) {
      refs.push({ table: 'offers', id: o.id, field: 'image', url: o.image });
    }
  }

  return refs;
}

async function downloadImage(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'tofaha-migrate/1.0' },
    });
    if (!res.ok) {
      warn(`download failed ${res.status}: ${url}`);
      return null;
    }
    const contentType = guessContentType(url, res.headers.get('content-type'));
    const ab = await res.arrayBuffer();
    return { buffer: Buffer.from(ab), contentType };
  } catch (e) {
    warn(`download error: ${url} (${(e as Error).message})`);
    return null;
  }
}

async function uploadToR2(
  client: S3Client,
  buffer: Buffer,
  contentType: string,
  sourceUrl: string,
): Promise<string | null> {
  try {
    if (!R2_PUBLIC_URL) {
      warn('R2_PUBLIC_URL is empty — cannot build public URL');
      return null;
    }
    const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12);
    const ext = extFromContentType(contentType, sourceUrl);
    const key = `migrated/${hash}-${randomUUID()}${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `${R2_PUBLIC_URL}/${key}`;
  } catch (e) {
    warn(`upload failed: ${sourceUrl} (${(e as Error).message})`);
    return null;
  }
}

async function updateImageUrl(ref: ImageRef, newUrl: string) {
  if (ref.table === 'categories') {
    await prisma.category.update({ where: { id: ref.id }, data: { image: newUrl } });
    return;
  }
  if (ref.table === 'banners') {
    await prisma.banner.update({ where: { id: ref.id }, data: { image: newUrl } });
    return;
  }
  if (ref.table === 'offers') {
    await prisma.offer.update({ where: { id: ref.id }, data: { image: newUrl } });
    return;
  }

  if (ref.field === 'images') {
    const product = await prisma.product.findUnique({ where: { id: ref.id } });
    if (!product || !Array.isArray(product.images) || ref.imagesIndex == null) return;
    const images = [...(product.images as any[])];
    if (!images[ref.imagesIndex]) return;
    images[ref.imagesIndex] = { ...images[ref.imagesIndex], data: newUrl };
    await prisma.product.update({
      where: { id: ref.id },
      data: { images: images as Prisma.InputJsonValue },
    });
    return;
  }

  await prisma.product.update({
    where: { id: ref.id },
    data: { [ref.field]: newUrl },
  });
}

async function migrateImages() {
  const refs = await collectImageRefs();
  log(`Images to migrate: ${refs.length}`);

  if (refs.length === 0) {
    log('No images need migration.');
    return;
  }

  if (DRY_RUN) {
    for (const r of refs.slice(0, 20)) {
      log(`  would migrate ${r.table}.${r.field} ${r.url}`);
    }
    if (refs.length > 20) log(`  ... and ${refs.length - 20} more`);
    return;
  }

  const client = getR2Client();
  const cache = new Map<string, string>(); // oldUrl → newUrl
  let ok = 0;
  let failed = 0;

  for (const ref of refs) {
    if (cache.has(ref.url)) {
      const cached = cache.get(ref.url)!;
      await updateImageUrl(ref, cached);
      ok++;
      continue;
    }

    const downloaded = await downloadImage(ref.url);
    if (!downloaded) {
      failed++;
      continue; // keep old URL
    }

    const newUrl = await uploadToR2(
      client,
      downloaded.buffer,
      downloaded.contentType,
      ref.url,
    );
    if (!newUrl) {
      failed++;
      continue; // keep old URL
    }

    await updateImageUrl(ref, newUrl);
    cache.set(ref.url, newUrl);
    ok++;
    log(`OK ${ref.table}/${ref.id} → ${newUrl}`);
  }

  log(`Images done: success=${ok} failed(kept old)=${failed}`);
  await prisma.catalogMeta.upsert({
    where: { id: 'version' },
    create: { id: 'version' },
    update: {},
  });
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting (dryRun=${DRY_RUN} dataOnly=${DATA_ONLY} imagesOnly=${IMAGES_ONLY})`);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  await prisma.$connect();
  log('Connected to PostgreSQL');

  if (!IMAGES_ONLY) {
    const token = await getFirebaseIdToken();
    log('Firebase anonymous auth OK');
    await migrateData(token);
  }

  if (!DATA_ONLY) {
    await migrateImages();
  }

  log('Migration finished.');
}

main()
  .catch((err) => {
    console.error('[migrate:error]', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
