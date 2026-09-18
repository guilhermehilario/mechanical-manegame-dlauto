import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkOrderDto } from '@mechanic-system/types';
import { PAYMENT_METHODS, type PaymentMethod } from '@mechanic-system/types';
import { createPaymentSchema } from '@mechanic-system/validation';
import { formatBRL } from '@mechanic-system/shared';
import { ApiClientError } from '../../services/api-client';
import { useAuth } from '../auth/use-auth';
import { useTimeFormat } from '../../hooks/use-time-format';
import { formatDate } from '../../utils/datetime';
import {
  createPayment,
  listPayments,
  refundPayment,
} from '../../services/payments.service';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Débito',
  CREDIT_CARD: 'Crédito',
  TRANSFER: 'Transferência',
};

/**
 * Payments panel (Bloco A — docs/todo-mvp.md). Money rules (balance check,
 * payable status) live in the API; this panel only collects input and shows
 * state. "Receber saldo" prefills the remaining balance — the server still
 * validates everything.
 */
export function WorkOrderPaymentsPanel({ workOrder }: { workOrder: WorkOrderDto }) {
  const queryClient = useQueryClient();
  const timeFormat = useTimeFormat();
  const { user } = useAuth();

  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const summary = workOrder.payment;
  // Guard for cached DTOs fetched before the payments feature (no payment field).
  const paidCents = summary?.paidCents ?? 0;
  const balanceCents = summary?.balanceCents ?? workOrder.totals.totalCents;

  const paymentsQuery = useQuery({
    queryKey: ['payments', workOrder.id],
    queryFn: () => listPayments(workOrder.id),
    // The endpoint rejects non-payable orders (409 WORK_ORDER_NOT_PAYABLE) —
    // only fetch once the receivable summary exists.
    enabled: summary !== null,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['payments', workOrder.id] });
    void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    // Receipt printing and reports also embed payment data.
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: { method: PaymentMethod; amountCents: number; notes?: string }) =>
      createPayment(workOrder.id, input),
    onSuccess: () => {
      setError(null);
      setAmount('');
      setNotes('');
      setMethod('PIX');
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        if (err.code === 'PAYMENT_EXCEEDS_BALANCE') {
          setError('Valor maior que o saldo restante da OS.');
          return;
        }
        setError(err.message);
        return;
      }
      setError('Erro ao registrar pagamento.');
    },
  });

  const refundMutation = useMutation({
    mutationFn: (paymentId: string) => refundPayment(workOrder.id, paymentId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: () => {
      setError('Erro ao estornar pagamento.');
    },
  });

  function handlePay(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = createPaymentSchema.safeParse({
      method,
      amountCents: Math.round(Number(amount.replace(',', '.')) * 100) || 0,
      notes: notes === '' ? undefined : notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    createMutation.mutate(parsed.data);
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <h2 className="text-xs font-semibold uppercase text-slate-500">Pagamentos</h2>
        {summary ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              summary.status === 'PAID'
                ? 'bg-green-100 text-green-700'
                : summary.status === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-200 text-slate-600'
            }`}
          >
            {summary.status === 'PAID'
              ? 'PAGO'
              : summary.status === 'PARTIAL'
                ? 'PARCIAL'
                : 'AGUARDANDO'}
          </span>
        ) : null}
      </div>

      {summary ? (
        <div className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
          <div>
            <p className="text-xs uppercase text-slate-400">Total</p>
            <p className="font-medium text-slate-800">{formatBRL(workOrder.totals.totalCents)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Pago</p>
            <p className="font-medium text-green-700">{formatBRL(paidCents)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Saldo</p>
            <p className={`font-medium ${balanceCents > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {formatBRL(balanceCents)}
            </p>
          </div>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-slate-400">
          Pagamentos abrem quando a OS fica concluída.
        </p>
      )}

      {paymentsQuery.data && paymentsQuery.data.items.length > 0 ? (
        <table className="w-full text-left text-sm">
          <tbody>
            {paymentsQuery.data.items.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">
                  {PAYMENT_METHOD_LABELS[payment.method]}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(payment.paidAt, timeFormat)}</td>
                <td className="px-4 py-2 text-slate-500">{payment.notes ?? ''}</td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {formatBRL(payment.amountCents)}
                </td>
                <td className="px-4 py-2 text-right">
                  {user?.role === 'ADMIN' ? (
                    <button
                      type="button"
                      onClick={() => {
                        refundMutation.mutate(payment.id);
                      }}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Estornar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : summary ? (
        <table className="w-full text-left text-sm">
          <tbody>
            <tr>
              <td className="px-4 py-6 text-center text-sm text-slate-500">
                Nenhum pagamento registrado ainda — use o formulário abaixo.
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      {summary && summary.status !== 'PAID' ? (
        <form
          className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-3"
          onSubmit={handlePay}
        >
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value as PaymentMethod);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_METHOD_LABELS[option]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            placeholder="Valor R$"
            className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            placeholder="Observação (opcional)"
            className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setAmount((balanceCents / 100).toFixed(2));
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Receber saldo ({formatBRL(balanceCents)})
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Receber
          </button>
        </form>
      ) : null}

      {error ? (
        <div role="alert" className="border-t border-slate-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}


