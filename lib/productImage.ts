import { Product } from './types';

type RawProduct = Partial<Product> & {
  images?: Array<{ data?: string; id?: string } | string>;
};

function isNonEmptyUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveProductImage(product: RawProduct): string {
  const fromImagesArray = (product.images || [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      return entry?.data || '';
    })
    .find(isNonEmptyUrl);

  const candidates = [product.image, product.image1, product.image2, fromImagesArray];
  return candidates.find(isNonEmptyUrl)?.trim() || '';
}

export function normalizeProduct(raw: RawProduct & { id: string }): Product {
  const image = resolveProductImage(raw);
  return {
    id: raw.id,
    name: raw.name || '',
    desc: raw.desc,
    image,
    image1: raw.image1 || image,
    image2: raw.image2,
    price: Number(raw.price) || 0,
    originalPrice: raw.originalPrice != null ? Number(raw.originalPrice) : undefined,
    hasDiscount: !!raw.hasDiscount,
    category: raw.category || '',
  };
}
