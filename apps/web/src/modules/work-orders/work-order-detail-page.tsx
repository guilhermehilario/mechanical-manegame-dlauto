import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkOrderDto } from '@mechanic-system/types';
import {
  WORK_ORDER_TRANSITIONS,
  isWorkOrderItemsEditable,
  formatBRL,
  type WorkOrderStatus,
} from '@mechanic-system/shared';
import { addProductItemSchema, addServiceItemSchema } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import { printWorkOrder } from '../../utils/print';
import { getCustomer } from '../../services/customers.service';
import {
  addProductItem,
  addServiceItem,
  getWorkOrder,
  removeProductItem,
  removeServiceItem,
  transitionWorkOrder,
  updateWorkOrder,
} from '../../services/work-orders.service';
import { listServices } from '../../services/catalog.service';
import { listProducts } from '../../services/catalog.service';
import {
  WORK_ORDER_STATUS_BADGES,
  WORK_ORDER_STATUS_LABELS,
} from './work-orders-page';
import { WorkOrderImagesPanel } from './work-order-images-panel';
import { WorkOrderPaymentsPanel } from './work-order-payments-panel';
import { useDateTime } from '../../hooks/use-date-time';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { dateFormat } = useDateTime();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [serviceQty, setServiceQty] = useState('1');
  const [productId, setProductId] = useState('');
  const [productQty, setProductQty] = useState('1');
  const [discount, setDiscount] = useState('0');

  const workOrderQuery = useQuery({
    queryKey: ['work-orders', id],
    queryFn: () => {
      if (!id) throw new Error('missing id');
      return getWorkOrder(id);
    },
    enabled: id !== undefined,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', 'for-wo-items'],
    queryFn: () => listServices({ limit: 100 }),
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'for-wo-items'],
    queryFn: () => listProducts({ limit: 100 }),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };

  function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiClientError) {
      if (error.code === 'WORK_ORDER_ITEMS_LOCKED') {
        return 'Itens bloqueados: a OS já saiu de Aberta/Em Avaliação.';
      }
      if (error.code === 'INSUFFICIENT_STOCK') return error.message;
      if (error.code === 'INVALID_WORK_ORDER_TRANSITION') return error.message;
      return `${fallback}: ${error.message}`;
    }
    return fallback;
  }

  const transitionMutation = useMutation({
    mutationFn: ({ status }: { status: WorkOrderStatus }) => transitionWorkOrder(id ?? '', status),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(errorMessage(error, 'Erro ao atualizar status.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { notes: string }) => updateWorkOrder(id ?? '', input),
    onSuccess: () => {
      setActionError(null);
      setNotes(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(errorMessage(error, 'Erro ao salvar observações.'));
    },
  });

  const addServiceMutation = useMutation({
    mutationFn: (input: { serviceId: string; quantity: number }) =>
      addServiceItem(id ?? '', input),
    onSuccess: () => {
      setActionError(null);
      setServiceId('');
      setServiceQty('1');
      invalidate();
    },
    onError: (error) => {
      setActionError(errorMessage(error, 'Erro ao adicionar serviço.'));
    },
  });

  const addProductMutation = useMutation({
    mutationFn: (input: { productId: string; quantity: number; discountCents: number }) =>
      addProductItem(id ?? '', input),
    onSuccess: () => {
      setActionError(null);
      setProductId('');
      setProductQty('1');
      setDiscount('0');
      invalidate();
    },
    onError: (error) => {
      setActionError(errorMessage(error, 'Erro ao adicionar peça.'));
    },
  });

  const removeServiceMutation = useMutation({
    mutationFn: (itemId: string) => removeServiceItem(id ?? '', itemId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(errorMessage(error, 'Erro ao remover serviço.'));
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: (itemId: string) => removeProductItem(id ?? '', itemId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(errorMessage(error, 'Erro ao remover peça.'));
    },
  });

  const customerQuery = useQuery({
    queryKey: ['customer', workOrderQuery.data?.customerId],
    queryFn: () => getCustomer(workOrderQuery.data?.customerId ?? ''),
    enabled: Boolean(workOrderQuery.data?.customerId),
    staleTime: 60_000,
  });

  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePrint(): Promise<void> {
    if (!workOrderQuery.data) return;
    setIsPrinting(true);
    try {
      await printWorkOrder(
        {
          orderNumber: workOrderQuery.data.orderNumber,
          status: workOrderQuery.data.status,
          createdAt: workOrderQuery.data.createdAt,
          customerName: workOrderQuery.data.customerName,
          customerPhone: customerQuery.data?.phone ?? null,
          vehiclePlate: workOrderQuery.data.vehiclePlate,
          vehicleModel: workOrderQuery.data.vehicleModel,
          notes: workOrderQuery.data.notes,
          serviceItems: workOrderQuery.data.serviceItems.map((item) => ({
            name: item.serviceName,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
          })),
          productItems: workOrderQuery.data.productItems.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountCents: item.discountCents,
          })),
          totals: workOrderQuery.data.totals,
        },
        dateFormat,
      );
    } finally {
      setIsPrinting(false);
    }
  }

  if (workOrderQuery.isLoading) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>;
  }

  if (workOrderQuery.isError || !workOrderQuery.data) {
    return (
      <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        Ordem de Serviço não encontrada.{' '}
        <Link to="/work-orders" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  const workOrder: WorkOrderDto = workOrderQuery.data;
  const itemsEditable = isWorkOrderItemsEditable(workOrder.status);
  const nextStatuses = WORK_ORDER_TRANSITIONS[workOrder.status];
  const currentNotes = notes ?? workOrder.notes ?? '';

  function handleAddService(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = addServiceItemSchema.safeParse({
      serviceId,
      quantity: serviceQty === '' ? 1 : Number(serviceQty),
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    addServiceMutation.mutate(parsed.data);
  }

  function handleAddProduct(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = addProductItemSchema.safeParse({
      productId,
      quantity: productQty === '' ? 1 : Number(productQty),
      discountCents: Math.round(Number(discount.replace(',', '.')) * 100) || 0,
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    addProductMutation.mutate(parsed.data);
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            OS #{workOrder.orderNumber}{' '}
            <span
              className={`ml-2 inline-block translate-y-[-2px] rounded-full px-2 py-0.5 text-xs font-medium ${
                WORK_ORDER_STATUS_BADGES[workOrder.status]
              }`}
            >
              {WORK_ORDER_STATUS_LABELS[workOrder.status]}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {workOrder.customerName} ·{' '}
            <span className="font-mono text-xs">{workOrder.vehiclePlate}</span>{' '}
            {workOrder.vehicleModel}
          </p>
        </div>
        <Link
          to="/work-orders"
          className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Voltar
        </Link>
      </div>

      {actionError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {/* Status transitions */}
      {nextStatuses.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {nextStatuses.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => {
                transitionMutation.mutate({ status: next });
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {next === 'CANCELLED' ? 'Cancelar OS' : `Marcar: ${WORK_ORDER_STATUS_LABELS[next]}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              void handlePrint();
            }}
            disabled={isPrinting}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isPrinting ? 'Preparando…' : '🖨 Imprimir OS'}
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              void handlePrint();
            }}
            disabled={isPrinting}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isPrinting ? 'Preparando…' : '🖨 Imprimir OS'}
          </button>
        </div>
      )}

      {/* Service items */}
      <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
          Serviços
        </div>
        <table className="w-full text-left text-sm">
          <tbody>
            {workOrder.serviceItems.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-slate-500">Nenhum serviço.</td>
              </tr>
            ) : (
              workOrder.serviceItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.serviceName}</td>
                  <td className="px-4 py-3 text-slate-500">qtd {item.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatBRL(item.unitPriceCents)} un.
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {formatBRL(item.unitPriceCents * item.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {itemsEditable ? (
                      <button
                        type="button"
                        onClick={() => {
                          removeServiceMutation.mutate(item.id);
                        }}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {itemsEditable ? (
          <form
            className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-3"
            onSubmit={handleAddService}
          >
            <select
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
              }}
              className="min-w-48 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione o serviço…</option>
              {(servicesQuery.data?.items ?? []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({formatBRL(service.priceCents)})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={serviceQty}
              onChange={(event) => {
                setServiceQty(event.target.value);
              }}
              className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Adicionar
            </button>
          </form>
        ) : null}
      </div>

      {/* Product items */}
      <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
          Peças e produtos
        </div>
        <table className="w-full text-left text-sm">
          <tbody>
            {workOrder.productItems.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-slate-500">Nenhuma peça.</td>
              </tr>
            ) : (
              workOrder.productItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.productName}</td>
                  <td className="px-4 py-3 text-slate-500">qtd {item.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatBRL(item.unitPriceCents)} un.
                  </td>
                  {item.discountCents > 0 ? (
                    <td className="px-4 py-3 text-xs text-green-700">
                      desc. {formatBRL(item.discountCents)}
                    </td>
                  ) : (
                    <td />
                  )}
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {formatBRL(
                      Math.max(0, item.unitPriceCents * item.quantity - item.discountCents),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {itemsEditable ? (
                      <button
                        type="button"
                        onClick={() => {
                          removeProductMutation.mutate(item.id);
                        }}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {itemsEditable ? (
          <form
            className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-3"
            onSubmit={handleAddProduct}
          >
            <select
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
              }}
              className="min-w-48 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione a peça…</option>
              {(productsQuery.data?.items ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {formatBRL(product.salePriceCents)} ({product.stockQuantity} un.)
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={productQty}
              onChange={(event) => {
                setProductQty(event.target.value);
              }}
              className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(event) => {
                setDiscount(event.target.value);
              }}
              placeholder="Desconto R$"
              className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Adicionar
            </button>
          </form>
        ) : (
          <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400">
            Itens bloqueados — a OS já está em aprovação/execução. Peças reservadas: o estoque
            já foi debitado.
          </p>
        )}
      </div>

      {/* Images (Fase 6) */}
      <div className="mb-4">
        <WorkOrderImagesPanel workOrderId={workOrder.id} />
      </div>

      {/* Payments (Bloco A) */}
      <div className="mb-4">
        <WorkOrderPaymentsPanel workOrder={workOrder} />
      </div>

      {/* Totals */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Totais</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-slate-400">Serviços</p>
            <p className="font-medium text-slate-800">{formatBRL(workOrder.totals.servicesCents)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Peças</p>
            <p className="font-medium text-slate-800">{formatBRL(workOrder.totals.productsCents)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Descontos</p>
            <p className="font-medium text-green-700">
              {formatBRL(workOrder.totals.discountsCents)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Total</p>
            <p className="text-base font-bold text-slate-900">
              {formatBRL(workOrder.totals.totalCents)}
            </p>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Observações</h2>
        <textarea
          rows={2}
          className={inputClass}
          value={currentNotes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={currentNotes === (workOrder.notes ?? '') || updateMutation.isPending}
            onClick={() => {
              updateMutation.mutate({ notes: currentNotes });
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Salvar observações
          </button>
        </div>
      </div>
    </section>
  );
}
