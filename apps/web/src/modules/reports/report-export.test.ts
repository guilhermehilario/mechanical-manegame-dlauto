import { describe, expect, it } from 'vitest';
import type {
  PaymentMethodRevenueReportDto,
  RevenueReportDto,
  TopItemsReportDto,
  WorkOrderStatusReportDto,
} from '@mechanic-system/types';
import {
  buildPaymentsReport,
  buildProductsReport,
  buildRevenueReport,
  buildServicesReport,
  buildStatusReport,
  reportToCsvRows,
} from './report-export';

const revenue: RevenueReportDto = {
  from: '2026-09-01',
  to: '2026-09-30',
  totalCents: 123456,
  items: [
    {
      date: '2026-09-10',
      workOrderCount: 2,
      servicesCents: 100000,
      productsCents: 30000,
      discountsCents: 6544,
      totalCents: 123456,
    },
  ],
};

const payments: PaymentMethodRevenueReportDto = {
  from: '2026-09-01',
  to: '2026-09-30',
  totalCents: 5000,
  items: [
    { method: 'PIX', count: 3, totalCents: 3000 },
    { method: 'CASH', count: 2, totalCents: 2000 },
  ],
};

const topItems: TopItemsReportDto = {
  from: '2026-09-01',
  to: '2026-09-30',
  items: [
    { name: 'Troca de óleo', quantity: 4, revenueCents: 20000 },
    { name: 'Alinhamento', quantity: 1, revenueCents: 8000 },
  ],
};

const status: WorkOrderStatusReportDto = {
  from: '2026-09-01',
  to: '2026-09-30',
  items: [
    { status: 'OPEN', count: 3 },
    { status: 'DELIVERED', count: 2 },
  ],
};

describe('report-export builders', () => {
  it('builds the revenue table with totals and right-aligned money', () => {
    const table = buildRevenueReport(revenue);

    expect(table.title).toBe('Relatório de Receita');
    expect(table.period).toBe('Período: 01/09/2026 a 30/09/2026');
    expect(table.columns).toEqual(['Data', 'OS', 'Serviços', 'Produtos', 'Descontos', 'Total']);
    expect(table.rows[0]?.[0]).toBe('10/09/2026');
    expect(table.rows[0]?.[1]).toBe('2');
    expect(table.rows[0]?.join(' ')).toContain('1.234,56');
    expect(table.totalsRow?.[5]).toContain('1.234,56');
    expect(table.rightAlign).toEqual([1, 2, 3, 4, 5]);
  });

  it('reflects the configured date format in period and rows', () => {
    const table = buildRevenueReport(revenue, 'YYYY_MM_DD');

    expect(table.period).toBe('Período: 2026/09/01 a 2026/09/30');
    expect(table.rows[0]?.[0]).toBe('2026/09/10');
  });

  it('builds the cash-basis payments table with translated labels', () => {
    const table = buildPaymentsReport(payments);

    expect(table.rows.map((row) => row[0])).toEqual(['Pix', 'Dinheiro']);
    expect(table.totalsRow?.[0]).toBe('Total');
    expect(table.totalsRow?.[1]).toBe('5');
  });

  it('builds ranked service/product tables and status table', () => {
    expect(buildServicesReport(topItems).rows[0]).toEqual([
      '1º',
      'Troca de óleo',
      '4',
      expect.stringContaining('200,00'),
    ]);
    expect(buildProductsReport(topItems).title).toBe('Produtos mais vendidos');
    expect(buildStatusReport(status).totalsRow).toEqual(['Total', '5']);
  });

  it('flattens a table into CSV rows (header + body + totals)', () => {
    const rows = reportToCsvRows(buildStatusReport(status));

    expect(rows[0]).toEqual(['Status', 'Quantidade']);
    expect(rows[1]).toEqual(['Aberta', '3']);
    expect(rows.at(-1)).toEqual(['Total', '5']);
  });
});
