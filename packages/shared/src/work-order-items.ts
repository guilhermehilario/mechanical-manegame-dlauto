import type { WorkOrderStatus } from './work-order-status';

/**
 * Work order items carry price snapshots (spec §35): the OS copies
 * name/price/quantity at execution time, and editing the catalog never
 * rewrites an existing OS. Items are editable only while the order is still
 * being prepared — i.e., before the quote is sent for approval.
 */
export const WORK_ORDER_ITEM_EDITABLE_STATUSES: readonly WorkOrderStatus[] = [
  'OPEN',
  'IN_ASSESSMENT',
];

export function isWorkOrderItemsEditable(status: WorkOrderStatus): boolean {
  return WORK_ORDER_ITEM_EDITABLE_STATUSES.includes(status);
}

/** Line total for a snapshot item: unit price × quantity − discount (≥ 0). */
export function itemLineTotalCents(
  unitPriceCents: number,
  quantity: number,
  discountCents: number,
): number {
  const gross = unitPriceCents * quantity;
  const total = gross - discountCents;
  return Math.max(0, total);
}
