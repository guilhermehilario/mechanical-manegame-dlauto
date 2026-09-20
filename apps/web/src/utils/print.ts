import type { DateFormat, ShopSettingsDto } from '@mechanic-system/types';
import { getShopSettings } from '../services/settings.service';
import { formatCpf, formatPhone } from '../utils/format';
import { formatDate, formatDateTime } from './datetime';

/**
 * Printing infrastructure (Bloco B — docs/todo-mvp.md).
 *
 * `printDocument` swaps the app DOM for a print template inside #print-root
 * (see the `@media print` block in index.css), triggers window.print() and
 * restores the app on `afterprint`. Works identically in the browser and in
 * the Electron packaged app (webContents prints the same DOM) — no external
 * dependency, fully offline.
 *
 * Templates are plain HTML strings built from already-fetched DTOs: they must
 * never fetch (the print flow stays synchronous and side-effect free).
 */

/** Page header/footer shared by every printed document. */
export interface PrintHeader {
  settings: ShopSettingsDto | null;
  title: string;
  subtitle?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function headerHtml(header: PrintHeader): string {
  const shop = header.settings;
  const shopLines: string[] = [];
  if (shop) {
    shopLines.push(`<div class="shop-name">${escapeHtml(shop.name)}</div>`);
    const contact = [shop.phone ? formatPhone(shop.phone) : null].filter(Boolean).join(' · ');
    if (contact) shopLines.push(`<div>${escapeHtml(contact)}</div>`);
    if (shop.address) shopLines.push(`<div>${escapeHtml(shop.address)}</div>`);
  }
  return `
    <div class="doc-header">
      <div class="doc-shop">${shopLines.join('') || '<div class="shop-name">Oficina</div>'}</div>
      <div class="doc-title">
        <div class="doc-title-main">${escapeHtml(header.title)}</div>
        ${header.subtitle ? `<div class="doc-subtitle">${escapeHtml(header.subtitle)}</div>` : ''}
      </div>
    </div>`;
}

function footerHtml(settings: ShopSettingsDto | null): string {
  const footer = settings ? settings.documentFooter : null;
  return `
    <div class="doc-footer">
      ${footer ? `<div>${escapeHtml(footer)}</div>` : ''}
      <div>Emitido em ${formatDateTime(
        new Date().toISOString(),
        settings?.dateFormat ?? 'DD_MM_YYYY',
        settings?.timeFormat ?? 'H24',
      )}</div>
    </div>`;
}

/** Wraps a template body into the shared document chrome and prints it. */
async function printDocument(bodyHtml: string, header: PrintHeader): Promise<void> {
  const settings = await getShopSettings().catch(() => null);
  const html = `
    ${headerHtml({ ...header, settings })}
    ${bodyHtml}
    ${footerHtml(settings)}`;

  const existing = document.getElementById('print-root');
  const root = existing ?? document.createElement('div');
  if (!existing) {
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = html;

  const cleanup = (): void => {
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// ─── Shared rows ─────────────────────────────────────────────────────────────

interface ItemRow {
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents?: number;
}

function itemRowsHtml(rows: ItemRow[]): string {
  if (rows.length === 0) return '<tr><td colspan="4" class="empty">—</td></tr>';
  return rows
    .map((row) => {
      const line = Math.max(0, row.unitPriceCents * row.quantity - (row.discountCents ?? 0));
      const discount =
        row.discountCents && row.discountCents > 0 ? `<td>${brl(row.discountCents)}</td>` : '<td></td>';
      return `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td class="center">${row.quantity}</td>
        <td>${brl(row.unitPriceCents)}</td>
        ${discount}
        <td class="right strong">${brl(line)}</td>
      </tr>`;
    })
    .join('');
}

function totalsHtml(totals: {
  servicesCents: number;
  productsCents: number;
  discountsCents: number;
  totalCents: number;
}): string {
  return `
    <table class="totals">
      <tr><td>Serviços</td><td class="right">${brl(totals.servicesCents)}</td></tr>
      <tr><td>Peças</td><td class="right">${brl(totals.productsCents)}</td></tr>
      <tr><td>Descontos</td><td class="right">−${brl(totals.discountsCents)}</td></tr>
      <tr class="grand"><td>Total</td><td class="right">${brl(totals.totalCents)}</td></tr>
    </table>`;
}

// ─── Bloco B1: Work order ────────────────────────────────────────────────────

export interface WorkOrderPrintData {
  orderNumber: number;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  vehiclePlate: string;
  vehicleModel: string;
  notes?: string | null;
  serviceItems: ItemRow[];
  productItems: ItemRow[];
  totals: { servicesCents: number; productsCents: number; discountsCents: number; totalCents: number };
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberta',
  IN_ASSESSMENT: 'Em Avaliação',
  AWAITING_APPROVAL: 'Aguardando Aprovação',
  APPROVED: 'Aprovada',
  IN_EXECUTION: 'Em Execução',
  AWAITING_PARTS: 'Aguardando Peças',
  COMPLETED: 'Concluída',
  AWAITING_PICKUP: 'Aguardando Retirada',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
};

/** Opens the print dialog with the work-order document. */
export function printWorkOrder(
  data: WorkOrderPrintData,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): Promise<void> {
  const body = `
    <table class="meta">
      <tr><th>Cliente</th><td>${escapeHtml(data.customerName)}</td></tr>
      ${data.customerPhone ? `<tr><th>Telefone</th><td>${escapeHtml(formatPhone(data.customerPhone))}</td></tr>` : ''}
      <tr><th>Veículo</th><td><span class="mono">${escapeHtml(data.vehiclePlate)}</span> — ${escapeHtml(data.vehicleModel)}</td></tr>
      <tr><th>Status</th><td>${escapeHtml(STATUS_LABELS[data.status] ?? data.status)}</td></tr>
      <tr><th>Aberta em</th><td>${formatDate(data.createdAt, dateFormat)}</td></tr>
    </table>

    <h2>Serviços</h2>
    <table class="items">
      <thead><tr><th>Descrição</th><th class="center">Qtd</th><th>Unitário</th><th></th><th class="right">Total</th></tr></thead>
      <tbody>${itemRowsHtml(data.serviceItems)}</tbody>
    </table>

    <h2>Peças e produtos</h2>
    <table class="items">
      <thead><tr><th>Descrição</th><th class="center">Qtd</th><th>Unitário</th><th>Desconto</th><th class="right">Total</th></tr></thead>
      <tbody>${itemRowsHtml(data.productItems)}</tbody>
    </table>

    ${totalsHtml(data.totals)}

    ${data.notes ? `<h2>Observações</h2><p class="notes">${escapeHtml(data.notes)}</p>` : ''}

    <div class="signatures">
      <div class="sig-line"><span></span><label>O cliente</label></div>
      <div class="sig-line"><span></span><label>A oficina</label></div>
    </div>`;

  return printDocument(body, {
    settings: null, // resolved by printDocument
    title: `Ordem de Serviço #${data.orderNumber}`,
  });
}

// ─── Bloco B2: Pickup receipt ────────────────────────────────────────────────

export interface PickupReceiptPrintData {
  orderNumber: number;
  createdAt: string;
  customerName: string;
  vehiclePlate: string;
  vehicleModel: string;
  receiverName: string;
  receiverDoc: string;
  receiverPhone: string | null;
  mileageKm: number | null;
  signatureData: string | null;
  notes: string | null;
  workOrderTotalCents: number;
}

/** Opens the print dialog with the vehicle handover receipt. */
export function printPickupReceipt(
  data: PickupReceiptPrintData,
  dateFormat: DateFormat = 'DD_MM_YYYY',
): Promise<void> {
  const signature = data.signatureData
    ? `<div class="signature"><img src="${escapeHtml(data.signatureData)}" alt="Assinatura" /></div>`
    : '<div class="signature empty-signature"></div>';

  const body = `
    <table class="meta">
      <tr><th>OS</th><td>#${data.orderNumber}</td></tr>
      <tr><th>Cliente</th><td>${escapeHtml(data.customerName)}</td></tr>
      <tr><th>Veículo</th><td><span class="mono">${escapeHtml(data.vehiclePlate)}</span> — ${escapeHtml(data.vehicleModel)}</td></tr>
      <tr><th>Total da OS</th><td>${brl(data.workOrderTotalCents)}</td></tr>
    </table>

    <h2>Dados da retirada</h2>
    <table class="meta">
      <tr><th>Retirado por</th><td>${escapeHtml(data.receiverName)}</td></tr>
      <tr><th>Documento</th><td class="mono">${escapeHtml(formatCpf(data.receiverDoc))}</td></tr>
      ${data.receiverPhone ? `<tr><th>Telefone</th><td>${escapeHtml(formatPhone(data.receiverPhone))}</td></tr>` : ''}
      ${data.mileageKm !== null ? `<tr><th>KM</th><td>${data.mileageKm.toLocaleString('pt-BR')} km</td></tr>` : ''}
      <tr><th>Data/hora</th><td>${formatDateTime(data.createdAt, dateFormat)}</td></tr>
    </table>

    ${data.notes ? `<p class="notes">${escapeHtml(data.notes)}</p>` : ''}

    <p class="disclaimer">
      Declaro ter recebido o veículo descrito acima em perfeitas condições, dando
      plena e total quitação dos serviços executados.
    </p>

    ${signature}
    <div class="sig-label">${escapeHtml(data.receiverName)}</div>`;

  return printDocument(body, {
    settings: null, // resolved by printDocument
    title: 'Comprovante de Retirada de Veículo',
  });
}

// ─── Bloco B4: Reports ───────────────────────────────────────────────────────

/** Generic tabular report payload (built from the already-fetched DTOs). */
export interface ReportPrintData {
  title: string;
  /** Period subtitle, e.g. "Período: 2026-09-01 a 2026-09-30". */
  period: string;
  summary?: string;
  columns: string[];
  rows: string[][];
  /** Column indexes rendered right-aligned. */
  rightAlign?: number[];
  /** Optional footer row (e.g. totals), rendered bold. */
  totalsRow?: string[];
}

/** Opens the print dialog with a tabular report document. */
export function printReport(data: ReportPrintData): Promise<void> {
  const right = new Set(data.rightAlign ?? []);
  const cell = (value: string, index: number): string =>
    `<td class="${right.has(index) ? 'right' : ''}">${escapeHtml(value)}</td>`;
  const head = data.columns
    .map((column, index) => `<th class="${right.has(index) ? 'right' : ''}">${escapeHtml(column)}</th>`)
    .join('');
  const body =
    data.rows.length === 0
      ? `<tr><td colspan="${data.columns.length}" class="empty">—</td></tr>`
      : data.rows
          .map((row) => `<tr>${row.map((value, index) => cell(value, index)).join('')}</tr>`)
          .join('');
  const totals = data.totalsRow
    ? `<tr class="strong">${data.totalsRow.map((value, index) => cell(value, index)).join('')}</tr>`
    : '';

  const summary = data.summary ? `<p class="strong report-summary">${escapeHtml(data.summary)}</p>` : '';
  const html = `
    ${summary}
    <table class="items">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}${totals}</tbody>
    </table>`;

  return printDocument(html, {
    settings: null, // resolved by printDocument
    title: data.title,
    subtitle: data.period,
  });
}
