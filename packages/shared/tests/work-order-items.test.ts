import { describe, expect, it } from 'vitest';
import {
  isWorkOrderItemsEditable,
  itemLineTotalCents,
} from '../src/work-order-items';

describe('work order items rules', () => {
  it('allows item edits only while OPEN or IN_ASSESSMENT', () => {
    expect(isWorkOrderItemsEditable('OPEN')).toBe(true);
    expect(isWorkOrderItemsEditable('IN_ASSESSMENT')).toBe(true);
    expect(isWorkOrderItemsEditable('AWAITING_APPROVAL')).toBe(false);
    expect(isWorkOrderItemsEditable('APPROVED')).toBe(false);
    expect(isWorkOrderItemsEditable('IN_EXECUTION')).toBe(false);
    expect(isWorkOrderItemsEditable('AWAITING_PARTS')).toBe(false);
    expect(isWorkOrderItemsEditable('COMPLETED')).toBe(false);
    expect(isWorkOrderItemsEditable('CANCELLED')).toBe(false);
    expect(isWorkOrderItemsEditable('DELIVERED')).toBe(false);
  });

  it('computes line totals as price × quantity − discount', () => {
    expect(itemLineTotalCents(15000, 2, 0)).toBe(30000);
    expect(itemLineTotalCents(3500, 3, 1000)).toBe(9500);
    expect(itemLineTotalCents(1000, 1, 500)).toBe(500);
  });

  it('never returns negative line totals', () => {
    expect(itemLineTotalCents(1000, 1, 2000)).toBe(0);
  });
});
