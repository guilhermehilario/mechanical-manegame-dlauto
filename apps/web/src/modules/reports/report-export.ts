import { formatBRL } from '@mechanic-system/shared';
import { formatDate } from '../../utils/datetime';
import type {
  PaymentMethod,
  PaymentMethodRevenueReportDto,
  RevenueReportDto,
  TopItemsReportDto,
  WorkOrderStatusReportDto,
} from '@mechanic-system/types';
import type { ReportPrintData } from '../../utils/print';
import { WORK_ORDER_STATUS_LABELS } from '../work-orders/work-orders-page';

/**
 * Report → printable/exportable table (Bloco B4 — docs/todo-mvp.md).
 *
 * Pure builders shared by the "Imprimir" and "Exportar CSV" actions: the page
 * keeps rendering its own charts/tables and these only reshape the DTOs into a
 * common `ReportPrintData` (columns + rows). No fetching, no side effects.
 */

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  TRANSFER: 'Transferência',
};

function period(report: { from: string; to: string }): string {
  return `Período: ${formatDate(report.from)} a ${formatDate(report.to)}`;
}

export function buildRevenueReport(report: RevenueReportDto): ReportPrintData {
  return {
    title: 'Relatório de Receita',
    period: period(report),
    summary: `Receita total: ${formatBRL(report.totalCents)}`,
    columns: ['Data', 'OS', 'Serviços', 'Produtos', 'Descontos', 'Total'],
    rightAlign: [1, 2, 3, 4, 5],
    rows: report.items.map((item) => [
      formatDate(item.date),
      String(item.workOrderCount),
      formatBRL(item.servicesCents),
      formatBRL(item.productsCents),
      item.discountsCents > 0 ? `-${formatBRL(item.discountsCents)}` : '—',
      formatBRL(item.totalCents),
    ]),
    totalsRow: ['Total', '', '', '', '', formatBRL(report.totalCents)],
  };
}

export function buildPaymentsReport(report: PaymentMethodRevenueReportDto): ReportPrintData {
  const count = report.items.reduce((sum, item) => sum + item.count, 0);
  return {
    title: 'Relatório de Recebimentos (caixa)',
    period: period(report),
    summary: `Recebido no período: ${formatBRL(report.totalCents)}`,
    columns: ['Forma', 'Recebimentos', 'Total'],
    rightAlign: [1, 2],
    rows: report.items.map((item) => [
      PAYMENT_METHOD_LABELS[item.method],
      String(item.count),
      formatBRL(item.totalCents),
    ]),
    totalsRow: ['Total', String(count), formatBRL(report.totalCents)],
  };
}

function buildTopItemsReport(title: string, report: TopItemsReportDto): ReportPrintData {
  const quantity = report.items.reduce((sum, item) => sum + item.quantity, 0);
  const revenue = report.items.reduce((sum, item) => sum + item.revenueCents, 0);
  return {
    title,
    period: period(report),
    columns: ['#', 'Nome', 'Quantidade', 'Receita'],
    rightAlign: [2, 3],
    rows: report.items.map((item, index) => [
      `${index + 1}º`,
      item.name,
      String(item.quantity),
      formatBRL(item.revenueCents),
    ]),
    totalsRow: ['', 'Total', String(quantity), formatBRL(revenue)],
  };
}

export function buildServicesReport(report: TopItemsReportDto): ReportPrintData {
  return buildTopItemsReport('Serviços mais vendidos', report);
}

export function buildProductsReport(report: TopItemsReportDto): ReportPrintData {
  return buildTopItemsReport('Produtos mais vendidos', report);
}

export function buildStatusReport(report: WorkOrderStatusReportDto): ReportPrintData {
  const total = report.items.reduce((sum, item) => sum + item.count, 0);
  return {
    title: 'Relatório de OS por status',
    period: period(report),
    summary: `OS criadas no período: ${total}`,
    columns: ['Status', 'Quantidade'],
    rightAlign: [1],
    rows: report.items.map((item) => [WORK_ORDER_STATUS_LABELS[item.status], String(item.count)]),
    totalsRow: ['Total', String(total)],
  };
}

/** Flattens a report table into CSV rows (header + body + totals). */
export function reportToCsvRows(table: ReportPrintData): string[][] {
  return [
    table.columns,
    ...table.rows,
    ...(table.totalsRow ? [table.totalsRow] : []),
  ];
}
