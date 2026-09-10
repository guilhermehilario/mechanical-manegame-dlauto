import { itemLineTotalCents } from './work-order-items';

/**
 * Work order totals are ALWAYS integer cents (spec §18). Service product
 * lines are aggregates of snapshot rows (spec §35); discounts apply per
 * product line. This helper is the single source of truth for the OS
 * totals used by the work-order service, the dashboard and the reports.
 */

export interface ServiceTotalInput {
  unitPriceCents: number;
  quantity: number;
}

export interface ProductTotalInput {
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
}

export interface WorkOrderTotals {
  servicesCents: number;
  productsCents: number;
  discountsCents: number;
  totalCents: number;
}

export function computeWorkOrderTotals(
  serviceItems: readonly ServiceTotalInput[],
  productItems: readonly ProductTotalInput[],
): WorkOrderTotals {
  const servicesCents = serviceItems.reduce(
    (sum, item) => sum + itemLineTotalCents(item.unitPriceCents, item.quantity, 0),
    0,
  );
  const productsCents = productItems.reduce(
    (sum, item) =>
      sum + itemLineTotalCents(item.unitPriceCents, item.quantity, item.discountCents),
    0,
  );
  const discountsCents = productItems.reduce((sum, item) => sum + item.discountCents, 0);
  return {
    servicesCents,
    productsCents,
    discountsCents,
    totalCents: servicesCents + productsCents,
  };
}

/** Structural source of totals — any object with snapshot item arrays. */
export interface TotalsSource {
  serviceItems: readonly ServiceTotalInput[];
  productItems: readonly ProductTotalInput[];
}

/** Sums the totals of many work orders (dashboard/report aggregates). */
export function sumTotalsSources(sources: readonly TotalsSource[]): WorkOrderTotals {
  return sources.reduce<WorkOrderTotals>(
    (acc, source) => {
      const totals = computeWorkOrderTotals(source.serviceItems, source.productItems);
      acc.servicesCents += totals.servicesCents;
      acc.productsCents += totals.productsCents;
      acc.discountsCents += totals.discountsCents;
      acc.totalCents += totals.totalCents;
      return acc;
    },
    { servicesCents: 0, productsCents: 0, discountsCents: 0, totalCents: 0 },
  );
}