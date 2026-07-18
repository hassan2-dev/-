/**
 * Migrate orders only: Firestore → PostgreSQL (idempotent via legacyId).
 * Usage (from backend/): npx tsx scripts/migrate-orders-only.ts
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, OrderStatus, Prisma } from '@prisma/client';

const scriptDir = resolve(process.cwd());

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

const prisma = new PrismaClient();

function log(msg: string) {
  console.log(`[orders-migrate] ${msg}`);
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
    .replace(/\s+/g, '_');
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

function decodeFirestoreValue(v: any): unknown {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    return (v.arrayValue?.values || []).map(decodeFirestoreValue);
  }
  if ('mapValue' in v) {
    const out: Record<string, unknown> = {};
    const fields = v.mapValue?.fields || {};
    for (const [k, val] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(val);
    }
    return out;
  }
  return null;
}

function parseFirestoreDoc(doc: any) {
  const id = String(doc.name || '').split('/').pop();
  const fields = doc.fields || {};
  const data: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(fields)) {
    data[k] = decodeFirestoreValue(v);
  }
  return data;
}

async function getFirebaseToken(): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!json.idToken) throw new Error(`Auth failed: ${JSON.stringify(json)}`);
  return json.idToken as string;
}

async function fetchOrders(token: string) {
  const docs: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${FIRESTORE_BASE}/orders`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    for (const doc of data.documents || []) docs.push(parseFirestoreDoc(doc));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

async function main() {
  log('Connecting to Postgres...');
  await prisma.$connect();
  const before = await prisma.order.count();
  log(`Orders already in Postgres: ${before}`);

  log('Fetching Firestore orders...');
  const token = await getFirebaseToken();
  const orders = await fetchOrders(token);
  log(`Firestore orders: ${orders.length}`);

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
  log(`Users upserted: ${phones.size}`);

  let created = 0;
  let updated = 0;

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
    if (existing) {
      await prisma.order.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.order.create({ data: { ...data, legacyId } });
      created++;
    }
  }

  const after = await prisma.order.count();
  log(`Done. created=${created} updated=${updated} total_in_db=${after}`);

  const byStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
  });
  log(`By status: ${JSON.stringify(byStatus)}`);
}

main()
  .catch((e) => {
    console.error('[orders-migrate] FAILED:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
