import { Product } from './types';

export const HOME_FEATURED_LIMIT = 20;

/** خصومات أولاً، ثم إكمال العدد بمنتجات عادية حتى 20 */
export function buildHomeFeaturedProducts(
  products: Product[],
  limit = HOME_FEATURED_LIMIT
): Product[] {
  const discounted = products.filter((p) => p.hasDiscount);
  const regular = products.filter((p) => !p.hasDiscount);

  const pickedDiscounted = discounted.slice(0, limit);
  const slotsLeft = limit - pickedDiscounted.length;
  const pickedRegular = slotsLeft > 0 ? regular.slice(0, slotsLeft) : [];

  return [...pickedDiscounted, ...pickedRegular];
}
