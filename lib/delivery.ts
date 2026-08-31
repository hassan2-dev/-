import { DELIVERY_COST } from './theme';
import type { CartItem } from './types';

/** قسم المياه في الكتالوج: «مياه عادية» */
const WATER_RE = /مياه|ماء|water/i;

export function isWaterProduct(item: {
  category?: string;
  name?: string;
}): boolean {
  const haystack = `${item.category || ''} ${item.name || ''}`;
  return WATER_RE.test(haystack);
}

/** عدد ستات الماء في السلة (كمية المنتجات المائية). */
export function countWaterSets(
  cart: Array<{ category?: string; name?: string; qty: number }>,
): number {
  return cart.reduce((sum, item) => {
    if (!isWaterProduct(item)) return sum;
    return sum + (Number(item.qty) || 0);
  }, 0);
}

/**
 * سعر التوصيل:
 * - بدون ماء أو ست واحد → نفس السعر الثابت
 * - أكثر من ست ماء → السعر × عدد الستات (سائق يروح ويرجع لكل ست)
 * المنتجات الأخرى لا تغيّر منطق الماء.
 */
export function calcDeliveryFee(cart: CartItem[]): number {
  if (!cart.length) return 0;
  const waterSets = countWaterSets(cart);
  if (waterSets <= 1) return DELIVERY_COST;
  return DELIVERY_COST * waterSets;
}
