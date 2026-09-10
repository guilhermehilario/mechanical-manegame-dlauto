import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isTerminalWorkOrderStatus,
  WORK_ORDER_TRANSITIONS,
  type WorkOrderStatus,
} from '../src/work-order-status';

describe('work order state machine', () => {
  it('allows the main happy path', () => {
    const path = [
      'OPEN',
      'IN_ASSESSMENT',
      'AWAITING_APPROVAL',
      'APPROVED',
      'IN_EXECUTION',
      'COMPLETED',
      'AWAITING_PICKUP',
      'DELIVERED',
    ] as const;

    for (let i = 0; i < path.length - 1; i++) {
      const from: WorkOrderStatus = path[i] ?? 'OPEN';
      const to: WorkOrderStatus = path[i + 1] ?? 'OPEN';
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it('allows awaiting parts during execution', () => {
    expect(canTransition('IN_EXECUTION', 'AWAITING_PARTS')).toBe(true);
    expect(canTransition('AWAITING_PARTS', 'IN_EXECUTION')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('OPEN', 'DELIVERED')).toBe(false);
    expect(canTransition('OPEN', 'COMPLETED')).toBe(false);
    expect(canTransition('DELIVERED', 'OPEN')).toBe(false);
    expect(canTransition('CANCELLED', 'OPEN')).toBe(false);
    expect(canTransition('AWAITING_PICKUP', 'CANCELLED')).toBe(false);
  });

  it('treats DELIVERED and CANCELLED as terminal', () => {
    expect(isTerminalWorkOrderStatus('DELIVERED')).toBe(true);
    expect(isTerminalWorkOrderStatus('CANCELLED')).toBe(true);
    expect(isTerminalWorkOrderStatus('OPEN')).toBe(false);
  });

  it('never allows transitions out of terminal statuses', () => {
    for (const terminal of ['DELIVERED', 'CANCELLED'] as const) {
      expect(WORK_ORDER_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });
});
