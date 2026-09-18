import { useEffect, useState } from 'react';
import { formatBRL } from '@mechanic-system/shared';
import type {
  DashboardPaymentMethodDto,
  DashboardSummaryDto,
  WorkOrderStatusCountDto,
} from '@mechanic-system/types';
import { btnSecondary } from '../../components/ui';
import { WORK_ORDER_STATUS_LABELS } from '../work-orders/work-orders-page';
import { PAYMENT_METHOD_LABELS } from '../reports/report-export';

/**
 * Dashboard charts (2026-09-18). Pure SVG/CSS renderings of the summary
 * DTO — no chart library (project rule: zero external dependencies).
 * The section can be hidden by the user; the preference is persisted in
 * localStorage and survives reloads.
 */

const CHART_PREFERENCE_KEY = 'mechanic.dashboard.hideCharts';

const DONUT_COLORS = [
  '#2563eb',
  '#0d9488',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#84cc16',
];

const REVENUE_BAR_COLORS = ['#2563eb', '#93c5fd', '#0d9488', '#99f6e4'];

function readPreference(): boolean {
  try {
    return localStorage.getItem(CHART_PREFERENCE_KEY) === '1';
  } catch {
    return false;
  }
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-600">{title}</h3>
      {children}
    </div>
  );
}

function DonutChart({ rows }: { rows: WorkOrderStatusCountDto[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 120 120"
        className="h-32 w-32 shrink-0"
        role="img"
        aria-label="Distribuição de status das ordens de serviço"
      >
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={16} />
        {rows.map((row, index) => {
          const fraction = row.count / total;
          const dash = fraction * circumference;
          const offset = -accumulated * circumference;
          accumulated += fraction;
          return (
            <circle
              key={row.status}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
              strokeWidth={16}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.status} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">
              {WORK_ORDER_STATUS_LABELS[row.status]}
            </span>
            <span className="font-medium text-slate-800">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevenueBarChart({ summary }: { summary: DashboardSummaryDto }) {
  const bars = [
    {
      label: 'Competência atual',
      value: summary.revenue.currentMonthCents,
      color: REVENUE_BAR_COLORS[0],
    },
    {
      label: 'Competência anterior',
      value: summary.revenue.previousMonthCents,
      color: REVENUE_BAR_COLORS[1],
    },
    {
      label: 'Caixa no mês',
      value: summary.cash.monthCents,
      color: REVENUE_BAR_COLORS[2],
    },
    {
      label: 'Caixa hoje',
      value: summary.cash.todayCents,
      color: REVENUE_BAR_COLORS[3],
    },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="flex items-end gap-3 sm:gap-4">
      {bars.map((bar) => (
        <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-700">
            {formatBRL(bar.value)}
          </span>
          <div className="flex h-28 w-full items-end justify-center">
            <div
              className="w-full max-w-12 rounded-t-md"
              style={{
                height: `${(bar.value / max) * 100}%`,
                backgroundColor: bar.color,
              }}
            />
          </div>
          <span className="text-center text-[10px] leading-tight text-slate-500">
            {bar.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PaymentMethodsChart({ rows }: { rows: DashboardPaymentMethodDto[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum recebimento no mês.</p>;
  }

  const sorted = [...rows].sort((a, b) => b.totalCents - a.totalCents);
  const max = Math.max(...sorted.map((row) => row.totalCents), 1);

  return (
    <ul className="space-y-2.5">
      {sorted.map((row) => (
        <li key={row.method} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-slate-600">
              {PAYMENT_METHOD_LABELS[row.method]}
            </span>
            <span className="shrink-0 font-medium text-slate-800">
              {formatBRL(row.totalCents)}{' '}
              <span className="text-xs font-normal text-slate-400">({row.count})</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${(row.totalCents / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardChartsSection({ summary }: { summary: DashboardSummaryDto }) {
  const [hidden, setHidden] = useState<boolean>(readPreference);

  useEffect(() => {
    try {
      localStorage.setItem(CHART_PREFERENCE_KEY, hidden ? '1' : '0');
    } catch {
      // Storage may be unavailable (private mode) — the toggle still works.
    }
  }, [hidden]);

  return (
    <section aria-label="Gráficos do painel" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Gráficos
        </h2>
        <button
          type="button"
          aria-expanded={!hidden}
          onClick={() => {
            setHidden((value) => !value);
          }}
          className={btnSecondary}
        >
          {hidden ? 'Mostrar gráficos' : 'Ocultar gráficos'}
        </button>
      </div>
      {!hidden && (
        <div data-testid="dashboard-charts" className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="Status das OS">
            {summary.workOrdersByStatus.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma OS registrada.</p>
            ) : (
              <DonutChart rows={summary.workOrdersByStatus} />
            )}
          </ChartCard>
          <ChartCard title="Receita e caixa">
            <RevenueBarChart summary={summary} />
          </ChartCard>
          <ChartCard title="Recebido por forma de pagamento">
            <PaymentMethodsChart rows={summary.paymentMethods} />
          </ChartCard>
        </div>
      )}
    </section>
  );
}