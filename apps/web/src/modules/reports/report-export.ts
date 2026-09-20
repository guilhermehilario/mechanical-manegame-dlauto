import { formatBRL } from '@mechanic-system/shared';
import type { DateFormat } from '@mechanic-system/types';
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

function period(
  report: { from: string; to: string },
  dateFormat: DateFormat,
): string {
  return `Período: ${formatDate(report.from, dateFormat)} a ${formatDate(report.to, dateFormat)}`;
}

export function buildRevenueReport(
  report: RevenueReportDto,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): ReportPrintData {
  return {
    title: 'Relatório de Receita',
    period: period(report, dateFormat),
    summary: `Receita total: ${formatBRL(report.totalCents)}`,
    columns: ['Data', 'OS', 'Serviços', 'Produtos', 'Descontos', 'Total'],
    rightAlign: [1, 2, 3, 4, 5],
    rows: report.items.map((item) => [
      formatDate(item.date, dateFormat),
      String(item.workOrderCount),
      formatBRL(item.servicesCents),
      formatBRL(item.productsCents),
      item.discountsCents > 0 ? `-${formatBRL(item.discountsCents)}` : '—',
      formatBRL(item.totalCents),
    ]),
    totalsRow: ['Total', '', '', '', '', formatBRL(report.totalCents)],
  };
}

export function buildPaymentsReport(
  report: PaymentMethodRevenueReportDto,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): ReportPrintData {
  const count = report.items.reduce((sum, item) => sum + item.count, 0);
  return {
    title: 'Relatório de Recebimentos (caixa)',
    period: period(report, dateFormat),
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

function buildTopItemsReport(
  title: string,
  report: TopItemsReportDto,
  dateFormat: DateFormat,
): ReportPrintData {
  const quantity = report.items.reduce((sum, item) => sum + item.quantity, 0);
  const revenue = report.items.reduce((sum, item) => sum + item.revenueCents, 0);
  return {
    title,
    period: period(report, dateFormat),
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

export function buildServicesReport(
  report: TopItemsReportDto,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): ReportPrintData {
  return buildTopItemsReport('Serviços mais vendidos', report, dateFormat);
}

export function buildProductsReport(
  report: TopItemsReportDto,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): ReportPrintData {
  return buildTopItemsReport('Produtos mais vendidos', report, dateFormat);
}

export function buildStatusReport(
  report: WorkOrderStatusReportDto,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): ReportPrintData {
  const total = report.items.reduce((sum, item) => sum + item.count, 0);
  return {
    title: 'Relatório de OS por status',
    period: period(report, dateFormat),
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
