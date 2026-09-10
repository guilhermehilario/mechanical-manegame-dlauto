import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CustomerDetailPage } from './customer-detail-page';
import { ApiClientError } from '../../services/api-client';
import type { CustomerDto, VehicleDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  getCustomer: vi.fn(),
  listVehiclesByCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  deleteVehicle: vi.fn(),
}));

vi.mock('../../services/customers.service', () => ({
  getCustomer: mocks.getCustomer,
  listVehiclesByCustomer: mocks.listVehiclesByCustomer,
  updateCustomer: mocks.updateCustomer,
  deleteCustomer: mocks.deleteCustomer,
}));

vi.mock('../../services/vehicles.service', () => ({
  listVehiclesByCustomer: mocks.listVehiclesByCustomer,
  deleteVehicle: mocks.deleteVehicle,
}));

// VehicleForm triggers a customers query — mock it out entirely.
vi.mock('../../vehicles/vehicle-form', () => ({
  VehicleForm: () => null,
}));

const customer: CustomerDto = {
  id: 'cus_1',
  name: 'João da Silva',
  cpf: '52998224725',
  phone: '11999998888',
  email: 'joao@email.com',
  address: 'Rua das Flores, 123',
  notes: 'Prefere contato por telefone.',
  active: true,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
};

const vehicles: VehicleDto[] = [
  {
    id: 'veh_1',
    customerId: 'cus_1',
    plate: 'ABC1D23',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2020,
    color: 'Prata',
    mileage: 45000,
    active: true,
    createdAt: '2026-02-10T12:00:00.000Z',
    updatedAt: '2026-02-10T12:00:00.000Z',
  },
];

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/customers/cus_1']}>
        <Routes>
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerDetailPage', () => {
  it('renders customer data, formatted CPF/phone and vehicles', async () => {
    mocks.getCustomer.mockResolvedValue(customer);
    mocks.listVehiclesByCustomer.mockResolvedValue(vehicles);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeTruthy();
    expect(screen.getByText('529.982.247-25')).toBeTruthy();
    expect(screen.getByText('(11) 99999-8888')).toBeTruthy();
    expect(screen.getByText('ABC1D23')).toBeTruthy();
    expect(screen.getByText('Volkswagen Gol · Prata')).toBeTruthy();
    expect(screen.getByText('45.000 km')).toBeTruthy();
    expect(screen.getByText(/Cliente desde/)).toBeTruthy();
    // History section lists the vehicle registration event.
    expect(screen.getByText(/Veículo cadastrado: Volkswagen Gol/)).toBeTruthy();
  });

  it('shows the empty state when the customer has no vehicles', async () => {
    mocks.getCustomer.mockResolvedValue(customer);
    mocks.listVehiclesByCustomer.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText('Nenhum veículo cadastrado para este cliente.'),
    ).toBeTruthy();
    expect(screen.getByText('Nenhum evento ainda.')).toBeTruthy();
  });

  it('shows a friendly message for a missing customer', async () => {
    mocks.getCustomer.mockRejectedValue(
      new ApiClientError('CUSTOMER_NOT_FOUND', 'Cliente não encontrado', 404),
    );

    renderPage();

    expect(await screen.findByText('Cliente não encontrado.')).toBeTruthy();
  });
});
