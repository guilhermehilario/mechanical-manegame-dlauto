import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatBRL } from '@mechanic-system/shared';
import type { WorkOrderStatusDto } from '@mechanic-system/types';
import {
  getPaymentMethodsReport,
  getRevenueReport,
  getTopProducts,
  getTopServices,
  getWorkOrderStatusReport,
} from '../../services/reports.service';
import { downloadCsv } from '../../utils/csv';
import { printReport, type ReportPrintData } from '../../utils/print';
import { WORK_ORDER_STATUS_LABELS } from '../work-orders/work-orders-page';
import {
  buildPaymentsReport,
  buildProductsReport,
  buildRevenueReport,
  buildServicesReport,
  buildStatusReport,
  PAYMENT_METHOD_LABELS,
  reportToCsvRows,
} from './report-export';

const STATUS_BADGES: Record<WorkOrderStatusDto, string> = {
  OPEN: 'bg-blue-50 text-blue-700',
  IN_ASSESSMENT: 'bg-cyan-50 text-cyan-700',
  AWAITING_APPROVAL: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-indigo-50 text-indigo-700',
  IN_EXECUTION: 'bg-violet-50 text-violet-700',
  AWAITING_PARTS: 'bg-orange-50 text-orange-700',
  COMPLETED: 'bg-green-50 text-green-700',
  AWAITING_PICKUP: 'bg-teal-50 text-teal-700',
  DELIVERED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-red-50 text-red-600',
};

type ReportTab = 'revenue' | 'payments' | 'services' | 'products' | 'status';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'revenue', label: 'Receita' },
  { id: 'payments', label: 'Recebimentos' },
  { id: 'services', label: 'Serviços' },
  { id: 'products', label: 'Produtos' },
  { id: 'status', label: 'Status das OS' },
];

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  return { from: toInputDate(startOfMonth(now)), to: toInputDate(endOfMonth(now)) };
}

function last30Days(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: toInputDate(from), to: toInputDate(now) };
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">{children}</div>
  );
}

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = ((): ReportTab => {
    const requested = searchParams.get('tab');
    return TABS.some((entry) => entry.id === requested)
      ? (requested as ReportTab)
      : 'revenue';
  })();

  const [appliedPeriod, setAppliedPeriod] = useState(defaultPeriod);
  const [draftFrom, setDraftFrom] = useState(appliedPeriod.from);
  const [draftTo, setDraftTo] = useState(appliedPeriod.to);
  const [tab, setTab] = useState<ReportTab>(initialTab);

  const { from, to } = appliedPeriod;

  const revenueQuery = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: () => getRevenueReport(from, to),
    enabled: tab === 'revenue',
  });
  const paymentsQuery = useQuery({
    queryKey: ['reports', 'payment-methods', from, to],
    queryFn: () => getPaymentMethodsReport(from, to),
    enabled: tab === 'payments',
  });
  const servicesQuery = useQuery({
    queryKey: ['reports', 'top-services', from, to],
    queryFn: () => getTopServices(from, to),
    enabled: tab === 'services',
  });
  const productsQuery = useQuery({
    queryKey: ['reports', 'top-products', from, to],
    queryFn: () => getTopProducts(from, to),
    enabled: tab === 'products',
  });
  const statusQuery = useQuery({
    queryKey: ['reports', 'status', from, to],
    queryFn: () => getWorkOrderStatusReport(from, to),
    enabled: tab === 'status',
  });

  function apply(preset: { from: string; to: string }) {
    setDraftFrom(preset.from);
    setDraftTo(preset.to);
    setAppliedPeriod(preset);
  }

  const activeQuery =
    tab === 'revenue'
      ? revenueQuery
      : tab === 'payments'
        ? paymentsQuery
        : tab === 'services'
          ? servicesQuery
          : tab === 'products'
            ? productsQuery
            : statusQuery;

  const reportTable: ReportPrintData | null =
    tab === 'revenue' && revenueQuery.data
      ? buildRevenueReport(revenueQuery.data)
      : tab === 'payments' && paymentsQuery.data
        ? buildPaymentsReport(paymentsQuery.data)
        : tab === 'services' && servicesQuery.data
          ? buildServicesReport(servicesQuery.data)
          : tab === 'products' && productsQuery.data
            ? buildProductsReport(productsQuery.data)
            : tab === 'status' && statusQuery.data
              ? buildStatusReport(statusQuery.data)
              : null;

  function handleExportCsv(): void {
    if (!reportTable) return;
    downloadCsv(`relatorio-${tab}-${from}_${to}.csv`, reportToCsvRows(reportTable));
  }

  function handlePrint(): void {
    if (reportTable) void printReport(reportTable);
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-500">Períodos inclusive · OS entregues</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedPeriod({ from: draftFrom, to: draftTo });
          }}
        >
<label className="flex flex-col gap-1 text-xs text-slate-500">
            De
            <input
              type="date"
              value={draftFrom}
              onChange={(event) => {
                setDraftFrom(event.target.value);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Até
            <input
              type="date"
              value={draftTo}
              onChange={(event) => {
                setDraftTo(event.target.value);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => {
              apply(defaultPeriod());
            }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Este mês
          </button>
          <button
            type="button"
            onClick={() => {
              apply(last30Days());
            }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Últimos 30 dias
          </button>
        </form>

        <div className="flex flex-col items-end gap-2">
          <div className="flex rounded-md border border-slate-200 bg-white p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === item.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!reportTable}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!reportTable}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <Section>
        {activeQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>
        ) : activeQuery.isError ? (
          <p role="alert" className="py-8 text-center text-sm text-red-600">
            Não foi possível carregar o relatório.
          </p>
        ) : (
          <ReportContent
            tab={tab}
            revenue={revenueQuery.data ?? null}
            payments={paymentsQuery.data ?? null}
            services={servicesQuery.data ?? null}
            products={productsQuery.data ?? null}
            status={statusQuery.data ?? null}
          />
        )}
      </Section>
    </section>
  );
}

function ReportContent({
  tab,
  revenue,
  payments,
  services,
  products,
  status,
}: {
  tab: ReportTab;
  revenue: Awaited<ReturnType<typeof getRevenueReport>> | null;
  payments: Awaited<ReturnType<typeof getPaymentMethodsReport>> | null;
  services: Awaited<ReturnType<typeof getTopServices>> | null;
  products: Awaited<ReturnType<typeof getTopProducts>> | null;
  status: Awaited<ReturnType<typeof getWorkOrderStatusReport>> | null;
}) {
  if (tab === 'payments' && payments) {
    const max = Math.max(1, ...payments.items.map((item) => item.totalCents));
    return (
      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-slate-500">Recebido no período (caixa)</span>
          <span className="text-2xl font-bold text-green-700">
            {formatBRL(payments.totalCents)}
          </span>
        </div>
        {payments.items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum pagamento recebido no período {payments.from} a {payments.to}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Forma</th>
                  <th className="px-3 py-2 text-right">Recebimentos</th>
                  <th className="px-3 py-2"> </th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {payments.items.map((item) => (
                  <tr key={item.method} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {PAYMENT_METHOD_LABELS[item.method]}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{item.count}</td>
                    <td className="px-3 py-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-green-600"
                          style={{ width: `${(item.totalCents / max) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {formatBRL(item.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'revenue' && revenue) {
    const maxDaily = Math.max(1, ...revenue.items.map((item) => item.totalCents));
    return (
      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-slate-500">Receita total</span>
          <span className="text-2xl font-bold text-slate-900">
            {formatBRL(revenue.totalCents)}
          </span>
        </div>
        {revenue.items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma OS entregue no período {revenue.from} a {revenue.to}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2 text-right">OS</th>
                  <th className="px-3 py-2 text-right">Serviços</th>
                  <th className="px-3 py-2 text-right">Produtos</th>
                  <th className="px-3 py-2 text-right">Descontos</th>
                  <th className="px-3 py-2"> </th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {revenue.items.map((item) => (
                  <tr key={item.date} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">{item.date}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{item.workOrderCount}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatBRL(item.servicesCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatBRL(item.productsCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {item.discountsCents > 0 ? `−${formatBRL(item.discountsCents)}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${(item.totalCents / maxDaily) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {formatBRL(item.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'services' && services) {
    return <TopItemsTable title="Serviços mais vendidos" items={services.items} />;
  }

  if (tab === 'products' && products) {
    return <TopItemsTable title="Produtos mais vendidos" items={products.items} />;
  }

  if (tab === 'status' && status) {
    const max = Math.max(1, ...status.items.map((item) => item.count));
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          OS criadas no período ({status.items.reduce((sum, item) => sum + item.count, 0)} no
          total)
        </p>
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {status.items.map((item) => (
            <div key={item.status} className="flex items-center gap-3">
              <div className="flex w-52 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    STATUS_BADGES[item.status]
                  }`}
                >
                  {WORK_ORDER_STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-medium text-slate-700">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function TopItemsTable({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; quantity: number; revenueCents: number }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.revenueCents));
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum dado no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2 text-right">Quantidade</th>
                <th className="px-3 py-2"> </th>
                <th className="px-3 py-2 text-right">Receita</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-slate-400">{index + 1}º</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${(item.revenueCents / max) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {formatBRL(item.revenueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}