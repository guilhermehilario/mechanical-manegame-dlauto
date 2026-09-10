import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppointmentsAgenda } from './appointments-agenda';
import type { AppointmentDto } from '@mechanic-system/types';

// Fixed "today" would require clock mocking; tests below avoid isToday branches
// by using non-today dates in the same week as the cursor.

const appointment: AppointmentDto = {
  id: 'apt_1',
  customerId: 'cus_1',
  customerName: 'João da Silva',
  vehicleId: 'veh_1',
  vehiclePlate: 'ABC1D23',
  serviceId: 'svc_1',
  serviceName: 'Troca de óleo',
  // Wednesday 2026-10-07 10:00 local-independent: stored as UTC instants.
  scheduledAt: '2026-10-07T13:00:00.000Z',
  status: 'SCHEDULED',
  notes: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

function renderAgenda(props: Partial<Parameters<typeof AppointmentsAgenda>[0]> = {}): void {
  render(
    <AppointmentsAgenda
      appointments={[appointment]}
      cursor={new Date('2026-10-07T12:00:00.000Z')}
      mode="day"
      onTransition={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />,
  );
}

describe('AppointmentsAgenda', () => {
  it('renders the day view with the appointment card', () => {
    renderAgenda({ mode: 'day' });

    expect(screen.getByText('João da Silva')).toBeTruthy();
    expect(screen.getByText('ABC1D23')).toBeTruthy();
    expect(screen.getByText('Troca de óleo')).toBeTruthy();
    expect(screen.getByText('Agendado')).toBeTruthy();
    // Transition buttons come from the shared state machine.
    expect(screen.getByRole('button', { name: 'Confirmado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Em andamento' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeTruthy();
  });

  it('renders the week view with 7 day columns and empty days', () => {
    renderAgenda({ mode: 'week' });

    // 7 day columns render (empty days show a dash placeholder).
    expect(screen.getAllByText('—').length).toBe(6);
    // The appointment appears under its day column.
    expect(screen.getByText('João da Silva')).toBeTruthy();
  });

  it('shows the empty placeholder when there are no appointments', () => {
    renderAgenda({ mode: 'day', appointments: [] });

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('João da Silva')).toBeNull();
  });
});
