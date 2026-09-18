import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkOrderDto } from '@mechanic-system/types';
import type { WorkOrderStatus } from '@mechanic-system/shared';
import { formatBRL } from '@mechanic-system/shared';
import {
  deleteWorkOrder,
  listWorkOrders,
} from '../../services/work-orders.service';
import { ApiClientError } from '../../services/api-client';
import { PageHeader } from '../../components/page-header';
import { btnPrimary, btnSecondary, inputClass, tableHead, tableWrap } from '../../components/ui';
import { IconButton, IconActionGroup } from '../../components/icon-button';
import { IconPlus, IconTrash } from '../../components/icons';
import { SortableTh } from '../../components/sortable-th';
import { useTableSort } from '../../hooks/use-table-sort';
import { WorkOrderForm } from './work-order-form';

const DEFAULT_DIRS = {
  orderNumber: 'desc',
  status: 'asc',
  createdAt: 'desc',
} as const;

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPEN: 'Aberta',
  IN_ASSESSMENT: 'Em avaliação',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  IN_EXECUTION: 'Em execução',
  AWAITING_PARTS: 'Aguardando peças',
  COMPLETED: 'Concluída',
  AWAITING_PICKUP: 'Aguardando retirada',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
};

export const WORK_ORDER_STATUS_BADGES: Record<WorkOrderStatus, string> = {
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

export function WorkOrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'' | WorkOrderStatus>('');
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { sort, sortProps } = useTableSort(DEFAULT_DIRS);

  const workOrdersQuery = useQuery({
    queryKey: ['work-orders', page, statusFilter, sort],
    queryFn: () =>
      listWorkOrders({ page, status: statusFilter || undefined, ...sort }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkOrder,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError ? `Erro ao excluir: ${error.message}` : 'Erro ao excluir.',
      );
    },
  });

  const items = workOrdersQuery.data?.items ?? [];
  const totalPages = workOrdersQuery.data?.totalPages ?? 1;

  function handleDelete(workOrder: WorkOrderDto): void {
    if (window.confirm(`Excluir definitivamente a OS #${workOrder.orderNumber}?`)) {
      deleteMutation.mutate(workOrder.id);
    }
  }

  return (
    <section>
      <PageHeader
        title="Ordens de Serviço"
        actions={
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
            }}
            className={btnPrimary}
          >
            <IconPlus className="h-4 w-4" />
            Nova OS
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value as '' | WorkOrderStatus);
          }}
          className={`${inputClass} sm:max-w-60`}
        >
          <option value="">Todos os status</option>
          {(Object.keys(WORK_ORDER_STATUS_LABELS) as WorkOrderStatus[]).map((status) => (
            <option key={status} value={status}>
              {WORK_ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {actionError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className={tableWrap}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <SortableTh name="Número" {...sortProps('orderNumber')}>Nº</SortableTh>
              <SortableTh name="Cliente">Cliente</SortableTh>
              <SortableTh name="Veículo">Veículo</SortableTh>
              <SortableTh name="Total">Total</SortableTh>
              <SortableTh name="Status" {...sortProps('status')}>Status</SortableTh>
              <SortableTh name="Ações" className="text-right">Ações</SortableTh>
            </tr>
          </thead>
          <tbody>
            {workOrdersQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma OS encontrada.
                </td>
              </tr>
            ) : (
              items.map((workOrder) => (
                <tr key={workOrder.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-slate-800">
                    <Link
                      to={`/work-orders/${workOrder.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      #{workOrder.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{workOrder.customerName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="font-mono text-xs">{workOrder.vehiclePlate}</span>
                    <span className="ml-2 text-xs text-slate-400">{workOrder.vehicleModel}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatBRL(workOrder.totals.totalCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        WORK_ORDER_STATUS_BADGES[workOrder.status]
                      }`}
                    >
                      {WORK_ORDER_STATUS_LABELS[workOrder.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconActionGroup>
                      <IconButton
                        icon={IconTrash}
                        tone="red"
                        label={`Excluir OS #${workOrder.orderNumber}`}
                        onClick={() => {
                          handleDelete(workOrder);
                        }}
                      />
                    </IconActionGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => current - 1);
            }}
            className={btnSecondary}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((current) => current + 1);
            }}
            className={btnSecondary}
          >
            Próxima
          </button>
        </div>
      </div>

      {formOpen ? (
        <WorkOrderForm
          onClose={() => {
            setFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
          }}
        />
      ) : null}
    </section>
  );
}
