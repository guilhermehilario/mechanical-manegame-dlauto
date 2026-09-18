import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VehiclePickupDto, WorkOrderDto } from '@mechanic-system/types';
import { formatBRL } from '@mechanic-system/shared';
import { createVehiclePickupSchema } from '@mechanic-system/validation';
import type { CreateVehiclePickupInput } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import { listWorkOrders } from '../../services/work-orders.service';
import {
  getVehiclePickupReceipt,
  listVehiclePickups,
  registerVehiclePickup,
} from '../../services/vehicle-pickups.service';
import { formatDate, formatPhone } from '../../utils/format';
import { printPickupReceipt } from '../../utils/print';
import { PageHeader } from '../../components/page-header';
import { SignaturePad } from './signature-pad';
import { btnPrimary, btnSecondary, inputClass, tableHead, tableWrap } from '../../components/ui';

export function VehiclePickupsPage() {
  const [page, setPage] = useState(1);
  const [registering, setRegistering] = useState<WorkOrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['work-orders', 'awaiting-pickup'],
    queryFn: () => listWorkOrders({ status: 'AWAITING_PICKUP', limit: 100 }),
  });

  const pickupsQuery = useQuery({
    queryKey: ['vehicle-pickups', page],
    queryFn: () => listVehiclePickups({ page, limit: 20 }),
  });

  const queue: WorkOrderDto[] = queueQuery.data?.items ?? [];
  const pickups: VehiclePickupDto[] = pickupsQuery.data?.items ?? [];

  /** Fetches the full receipt and opens the print dialog (Bloco B2). */
  async function printReceiptFor(workOrderId: string): Promise<void> {
    setError(null);
    try {
      const receipt = await getVehiclePickupReceipt(workOrderId);
      await printPickupReceipt({
        orderNumber: receipt.orderNumber,
        createdAt: receipt.createdAt,
        customerName: receipt.customerName,
        vehiclePlate: receipt.vehiclePlate,
        vehicleModel: receipt.vehicleModel,
        receiverName: receipt.receiverName,
        receiverDoc: receipt.receiverDoc,
        receiverPhone: receipt.receiverPhone,
        mileageKm: receipt.mileageKm,
        signatureData: receipt.signatureData,
        notes: receipt.notes,
        workOrderTotalCents: receipt.workOrderTotalCents,
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 404
          ? 'Retirada não registrada para esta OS.'
          : 'Não foi possível preparar o recibo para impressão.',
      );
    }
  }

  return (
    <section>
      <PageHeader
        title="Retirada / Entrega de Veículos"
        description={
          <>
            Registre a saída do veículo e emita o comprovante — a OS vai para <b>Entregue</b>.
          </>
        }
      />

      {error ? (
        <div role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Queue: OS awaiting pickup */}
      <h2 className="mt-6 text-base font-semibold text-slate-900">
        Aguardando retirada ({queue.length})
      </h2>
      <div className={`mt-3 ${tableWrap}`}>
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-4 py-3">OS</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {queueQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Carregando…</td>
              </tr>
            ) : queue.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma OS aguardando retirada.
                </td>
              </tr>
            ) : (
              queue.map((workOrder) => (
                <tr key={workOrder.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">#{workOrder.orderNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{workOrder.customerName}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{workOrder.vehiclePlate}</span>{' '}
                    <span className="text-slate-500">{workOrder.vehicleModel}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {formatBRL(workOrder.totals.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setRegistering(workOrder);
                      }}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Registrar retirada
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void printReceiptFor(workOrder.id);
                      }}
                      className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      title="Imprimir comprovante (retiradas anteriores)"
                    >
                      🖨
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* History of registered pickups */}
      <h2 className="mt-8 text-base font-semibold text-slate-900">Retiradas registradas</h2>
      <div className={`mt-3 ${tableWrap}`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-4 py-3">OS</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Quem retirou</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">KM</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pickupsQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Carregando…</td>
              </tr>
            ) : pickups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma retirada registrada ainda.
                </td>
              </tr>
            ) : (
              pickups.map((pickup) => (
                <tr key={pickup.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">#{pickup.orderNumber}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{pickup.vehiclePlate}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {pickup.receiverName}
                    {pickup.receiverPhone ? (
                      <span className="text-slate-400"> · {formatPhone(pickup.receiverPhone)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{pickup.receiverDoc}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {pickup.mileageKm === null ? '—' : `${pickup.mileageKm.toLocaleString('pt-BR')} km`}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(pickup.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void printReceiptFor(pickup.workOrderId);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      🖨 Recibo
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pickupsQuery.data && pickupsQuery.data.totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
            }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-slate-500">
            {page} / {pickupsQuery.data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pickupsQuery.data.totalPages}
            onClick={() => {
              setPage((p) => p + 1);
            }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            →
          </button>
        </div>
      ) : null}

      {registering ? (
        <RegisterPickupModal
          workOrder={registering}
          onClose={() => {
            setRegistering(null);
          }}
          onError={(message) => {
            setError(message);
          }}
        />
      ) : null}
    </section>
  );
}

function RegisterPickupModal({
  workOrder,
  onClose,
  onError,
}: {
  workOrder: WorkOrderDto;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [receiverName, setReceiverName] = useState('');
  const [receiverDoc, setReceiverDoc] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [mileageKm, setMileageKm] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: (input: CreateVehiclePickupInput) =>
      registerVehiclePickup(workOrder.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicle-pickups'] });
      onClose();
    },
    onError: (err) => {
      onError(friendlyRegisterError(err));
      onClose();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = createVehiclePickupSchema.safeParse({
      receiverName,
      receiverDoc,
      receiverPhone: receiverPhone === '' ? undefined : receiverPhone,
      mileageKm: mileageKm === '' ? undefined : Number(mileageKm),
      signatureData: signature ?? undefined,
      notes: notes === '' ? undefined : notes,
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setValidationError(null);
    registerMutation.mutate(parsed.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-900">
          Registrar retirada — OS #{workOrder.orderNumber}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {workOrder.customerName} · <span className="font-mono text-xs">{workOrder.vehiclePlate}</span>{' '}
          {workOrder.vehicleModel} · Total {formatBRL(workOrder.totals.totalCents)}
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="receiverName">
              Nome de quem retira *
            </label>
            <input
              id="receiverName"
              className={inputClass}
              value={receiverName}
              onChange={(event) => {
                setReceiverName(event.target.value);
              }}
              placeholder="Ex.: Maria Souza"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="receiverDoc">
                CPF/CNH (11 dígitos) *
              </label>
              <input
                id="receiverDoc"
                className={inputClass}
                value={receiverDoc}
                onChange={(event) => {
                  setReceiverDoc(event.target.value);
                }}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="receiverPhone">
                Telefone
              </label>
              <input
                id="receiverPhone"
                className={inputClass}
                value={receiverPhone}
                onChange={(event) => {
                  setReceiverPhone(event.target.value);
                }}
                placeholder="(11) 99999-8888"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="mileageKm">
              KM do veículo
            </label>
            <input
              id="mileageKm"
              type="number"
              min={0}
              className={inputClass}
              value={mileageKm}
              onChange={(event) => {
                setMileageKm(event.target.value);
              }}
              placeholder="Ex.: 45200"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Assinatura (opcional)</label>
            <SignaturePad onChange={setSignature} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="pickupNotes">
              Observações
            </label>
            <textarea
              id="pickupNotes"
              rows={2}
              className={inputClass}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </div>

          {validationError ? (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {validationError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className={btnPrimary}
            >
              {registerMutation.isPending ? 'Registrando…' : 'Confirmar retirada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function friendlyRegisterError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'PICKUP_ALREADY_EXISTS') return 'A retirada desta OS já foi registrada.';
    if (err.code === 'WORK_ORDER_NOT_AWAITING_PICKUP') return err.message;
    return err.message;
  }
  return 'Não foi possível registrar a retirada.';
}
