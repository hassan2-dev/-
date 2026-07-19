import { OrderStatus } from '@prisma/client';

/** Orders that keep a driver "Busy" while assigned. */
export const OPEN_DRIVER_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.ON_THE_WAY,
];

export function computeDriverAvailability(
  presence: 'ONLINE' | 'OFFLINE',
  openOrdersCount: number,
): 'available' | 'busy' | 'offline' {
  if (presence === 'OFFLINE') return 'offline';
  if (openOrdersCount > 0) return 'busy';
  return 'available';
}
