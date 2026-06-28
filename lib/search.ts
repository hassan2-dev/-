import { Product } from './types';

export function matchesProductQuery(name: string, query: string): boolean {
  const normalizedName = name.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return false;
  return normalizedQuery.split('').every((char) => normalizedName.includes(char));
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
