import { z } from 'zod';

/**
 * Work Order status machine (spec §11).
 * Centralized here so backend, frontend and tests share one source of truth.
 */

export const WORK_ORDER_STATUSES = [
  'OPEN',
  'IN_ASSESSMENT',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_EXECUTION',
  'AWAITING_PARTS',
  'COMPLETED',
  'AWAITING_PICKUP',
  'DELIVERED',
  'CANCELLED',
] as const;

export const WorkOrderStatus = z.enum(WORK_ORDER_STATUSES);
export type WorkOrderStatus = z.infer<typeof WorkOrderStatus>;

/**
 * Allowed transitions. Anything not listed is invalid and must be rejected
 * by the backend (spec §11, §33 — never trust the frontend).
 */
export const WORK_ORDER_TRANSITIONS: Readonly<
  Record<WorkOrderStatus, readonly WorkOrderStatus[]>
> = {
  OPEN: ['IN_ASSESSMENT', 'CANCELLED'],
  IN_ASSESSMENT: ['AWAITING_APPROVAL', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_EXECUTION', 'CANCELLED'],
  IN_EXECUTION: ['AWAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  AWAITING_PARTS: ['IN_EXECUTION', 'CANCELLED'],
  COMPLETED: ['AWAITING_PICKUP', 'CANCELLED'],
  AWAITING_PICKUP: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Business rule: can a work order move from `from` to `to`? */
export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return WORK_ORDER_TRANSITIONS[from].includes(to);
}

/** Terminal statuses — no further transitions allowed. */
export const TERMINAL_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = (
  Object.keys(WORK_ORDER_TRANSITIONS) as WorkOrderStatus[]
).filter((status) => WORK_ORDER_TRANSITIONS[status].length === 0);

export function isTerminalWorkOrderStatus(status: WorkOrderStatus): boolean {
  return TERMINAL_WORK_ORDER_STATUSES.includes(status);
}
