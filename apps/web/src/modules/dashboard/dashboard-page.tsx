import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatBRL } from '@mechanic-system/shared';
import type { WorkOrderStatusCountDto } from '@mechanic-system/types';
import { getDashboardSummary } from '../../services/dashboard.service';
import { BackupAlertBanner } from './backup-alert-banner';
import { WORK_ORDER_STATUS_LABELS, WORK_ORDER_STATUS_BADGES } from '../work-orders/work-orders-page';
import { APPOINTMENT_STATUS_BADGES } from '../appointments/appointment-status';
import { formatTime } from '../../utils/dates';

function KpiCard({
  label,
  value,
  to,
  accent,
}: {
  label: string;
  value: number;
  to: string;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </Link>
  );
}

function StatusBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const width = total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 truncate text-sm text-slate-600">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-medium text-slate-700">{count}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  if (summaryQuery.isLoading) {
    return <p className="text-sm text-slate-500">Carregando…</p>;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <p role="alert" className="text-sm text-red-600">
        Não foi possível carregar o painel.
      </p>
    );
  }

  const summary = summaryQuery.data;
  const totalStatusCount = summary.workOrdersByStatus.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const statusRows = [...summary.workOrdersByStatus].sort((a, b) => b.count - a.count);
  const maxRevenue = Math.max(summary.revenue.currentMonthCents, summary.revenue.previousMonthCents, 1);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral da oficina</p>
      </div>

      {/* Stale/missing backup warning (Bloco E/E2) — admin/manager only. */}
      <BackupAlertBanner />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="Clientes"
          value={summary.counts.customers}
          to="/customers"
          accent="bg-blue-600"
        />
        <KpiCard
          label="OS ativas"
          value={summary.counts.activeWorkOrders}
          to="/work-orders"
          accent="bg-teal-600"
        />
        <KpiCard
          label="Aguardando retirada"
          value={summary.counts.awaitingPickup}
          to="/pickups"
          accent="bg-amber-500"
        />
        <KpiCard
          label="Agendamentos hoje"
          value={summary.counts.todayAppointments}
          to="/appointments"
          accent="bg-rose-500"
        />
        <KpiCard
          label="Itens com estoque baixo"
          value={summary.counts.lowStockProducts}
          to="/products?lowStock=1"
          accent="bg-amber-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Receita realizada">
          <div className="space-y-4">
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500">Este mês</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatBRL(summary.revenue.currentMonthCents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Mês anterior</p>
                  <p className="text-lg font-medium text-slate-600">
                    {formatBRL(summary.revenue.previousMonthCents)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-blue-600"
                  style={{
                    width: `${(summary.revenue.currentMonthCents / maxRevenue) * 100}%`,
                  }}
                />
                <div
                  className="bg-slate-300"
                  style={{
                    width: `${(summary.revenue.previousMonthCents / maxRevenue) * 100}%`,
                  }}
                />
              </div>
            </div>
            <Link to="/reports" className="text-sm font-medium text-blue-600 hover:underline">
              Ver relatórios →
            </Link>
          </div>
        </Card>

        <Card title="Status das ordens de serviço">
          <div className="space-y-3">
            {statusRows.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma OS registrada.</p>
            ) : (
              statusRows.slice(0, 6).map((row: WorkOrderStatusCountDto) => (
                <StatusBar
                  key={row.status}
                  label={WORK_ORDER_STATUS_LABELS[row.status]}
                  count={row.count}
                  total={totalStatusCount}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Próximos agendamentos">
          {summary.upcomingAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">Sem agendamentos por vir.</p>
          ) : (
            <ul className="space-y-3">
              {summary.upcomingAppointments.map((appointment) => (
                <li key={appointment.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {appointment.customerName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {appointment.vehiclePlate} · {appointment.serviceName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-medium text-slate-600">
                      {formatTime(new Date(appointment.scheduledAt))}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        APPOINTMENT_STATUS_BADGES[appointment.status]
                      }`}
                    >
                      {appointment.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="OS recentes">
          {summary.recentWorkOrders.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma OS recente.</p>
          ) : (
            <ul className="space-y-3">
              {summary.recentWorkOrders.map((workOrder) => (
                <li key={workOrder.id}>
                  <Link
                    to={`/work-orders/${workOrder.id}`}
                    className="flex items-center justify-between gap-2 rounded-md p-1 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        OS #{workOrder.orderNumber} · {workOrder.customerName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {workOrder.vehicleModel} ({workOrder.vehiclePlate}) ·{' '}
                        {formatBRL(workOrder.totals.totalCents)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        WORK_ORDER_STATUS_BADGES[workOrder.status]
                      }`}
                    >
                      {WORK_ORDER_STATUS_LABELS[workOrder.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Estoque baixo">
          {summary.lowStockProducts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum item abaixo do mínimo.</p>
          ) : (
            <ul className="space-y-3">
              {summary.lowStockProducts.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{product.code}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {product.stockQuantity} / mín {product.minStock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}