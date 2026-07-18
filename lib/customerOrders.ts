import { fetchMyApiOrders } from './api';

export const ORDER_EXPIRE_MS = 6 * 60 * 60 * 1000;

export function getOrderTime(order: { statusUpdatedAt?: string; createdAt?: string }): number {
  const raw = order?.statusUpdatedAt || order?.createdAt;
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function formatOrderDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export async function fetchCustomerOrders(options?: {
  limit?: number;
  hideExpiredOnTheWay?: boolean;
}): Promise<any[]> {
  const limit = options?.limit;
  const hideExpired = options?.hideExpiredOnTheWay !== false;

  const orders = await fetchMyApiOrders();
  let matched = orders.sort((a: any, b: any) => getOrderTime(b) - getOrderTime(a));

  if (hideExpired) {
    matched = matched.filter(
      (order: any) =>
        !(order.status === 'on_the_way' && Date.now() - getOrderTime(order) > ORDER_EXPIRE_MS)
    );
  }

  return limit ? matched.slice(0, limit) : matched;
}
