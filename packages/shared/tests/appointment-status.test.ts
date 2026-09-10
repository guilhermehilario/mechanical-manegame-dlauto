import { describe, expect, it } from 'vitest';
import {
  canTransitionAppointment,
  isActiveAppointmentStatus,
} from '../src/appointment-status';

describe('appointment status machine', () => {
  it('allows the documented happy path', () => {
    expect(canTransitionAppointment('SCHEDULED', 'CONFIRMED')).toBe(true);
    expect(canTransitionAppointment('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionAppointment('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('allows cancellation from any active status', () => {
    expect(canTransitionAppointment('SCHEDULED', 'CANCELLED')).toBe(true);
    expect(canTransitionAppointment('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(canTransitionAppointment('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('allows skipping confirmation (SCHEDULED → IN_PROGRESS)', () => {
    expect(canTransitionAppointment('SCHEDULED', 'IN_PROGRESS')).toBe(true);
  });

  it('rejects terminal statuses and illegal jumps', () => {
    expect(canTransitionAppointment('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionAppointment('CANCELLED', 'SCHEDULED')).toBe(false);
    expect(canTransitionAppointment('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransitionAppointment('IN_PROGRESS', 'SCHEDULED')).toBe(false);
  });

  it('treats exactly the three non-terminal statuses as active', () => {
    expect(isActiveAppointmentStatus('SCHEDULED')).toBe(true);
    expect(isActiveAppointmentStatus('CONFIRMED')).toBe(true);
    expect(isActiveAppointmentStatus('IN_PROGRESS')).toBe(true);
    expect(isActiveAppointmentStatus('COMPLETED')).toBe(false);
    expect(isActiveAppointmentStatus('CANCELLED')).toBe(false);
  });
});
