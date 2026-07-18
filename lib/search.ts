import { Product } from './types';

/** Normalize Arabic text for forgiving search: unify alef/teh-marbuta/yaa, strip tashkeel. */
function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ');
}

export function matchesProductQuery(name: string, query: string): boolean {
  const normalizedName = normalizeArabic(name);
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return false;
  // Every word of the query must appear somewhere in the name.
  return normalizedQuery
    .split(' ')
    .every((word) => normalizedName.includes(word));
}

export function filterProductsByQuery(
  products: Product[],
  query: string,
  maxResults = 12
): Product[] {
  const q = query.trim();
  if (!q) return [];
  return products.filter((p) => matchesProductQuery(p.name, q)).slice(0, maxResults);
}
