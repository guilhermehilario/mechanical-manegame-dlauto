import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { VehicleHistoryEntryDto } from '@mechanic-system/types';
import { formatBRL } from '@mechanic-system/shared';
import { getVehicle } from '../../services/vehicles.service';
import { getVehicleHistory } from '../../services/images.service';
import { useDateTime } from '../../hooks/use-date-time';
import { formatDate } from '../../utils/datetime';

/**
 * Vehicle maintenance history (Fase 6, spec §14) — a DERIVED view over work
 * orders: newest OS first with its snapshot items and total. No separate
 * history storage exists, so this view can never disagree with the orders.
 */
export function VehicleHistoryPage() {
  const { dateFormat, timeFormat } = useDateTime();
  const { vehicleId = '' } = useParams<{ vehicleId: string }>();

  const vehicleQuery = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => getVehicle(vehicleId),
    enabled: vehicleId !== '',
  });

  const historyQuery = useQuery({
    queryKey: ['vehicle-history', vehicleId],
    queryFn: () => getVehicleHistory(vehicleId),
    enabled: vehicleId !== '',
  });

  const vehicle = vehicleQuery.data;
  const history: VehicleHistoryEntryDto[] = historyQuery.data ?? [];

  if (vehicleQuery.isError) {
    return (
      <section>
        <Link to="/vehicles" className="text-sm text-blue-600 hover:underline">
          ← Voltar para veículos
        </Link>
        <div role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Veículo não encontrado.
        </div>
      </section>
    );
  }

  return (
    <section>
      <Link to="/vehicles" className="text-sm text-blue-600 hover:underline">
        ← Voltar para veículos
      </Link>

      <div className="mt-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Histórico — <span className="font-mono">{vehicle?.plate ?? '…'}</span>
        </h1>
        {vehicle ? (
          <p className="mt-0.5 text-sm text-slate-500">
            {vehicle.brand} {vehicle.model}
            {vehicle.year ? ` · ${vehicle.year}` : ''}
            {vehicle.color ? ` · ${vehicle.color}` : ''}
          </p>
        ) : null}
      </div>

      {historyQuery.isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Carregando…</p>
      ) : history.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Nenhuma ordem de serviço para este veículo ainda.
        </div>
      ) : (
        <ol className="mt-4 space-y-4">
          {history.map((entry) => (
            <li key={entry.workOrderId} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <Link
                    to={`/work-orders/${entry.workOrderId}`}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    OS #{entry.orderNumber}
                  </Link>
                  <p className="text-xs text-slate-500">
                    Aberta em {formatDate(entry.openedAt, dateFormat, timeFormat)}
                    {entry.completedAt ? ` · Concluída em ${formatDate(entry.completedAt, dateFormat, timeFormat)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-900">{formatBRL(entry.totalCents)}</p>
              </div>

              {entry.services.length > 0 ? (
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Serviços</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-600">
                    {entry.services.map((service, index) => (
                      <li key={`s-${index}`} className="flex justify-between gap-4">
                        <span>
                          {service.name}
                          {service.quantity > 1 ? ` ×${service.quantity}` : ''}
                        </span>
                        <span className="shrink-0">
                          {formatBRL(service.unitPriceCents * service.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {entry.products.length > 0 ? (
                <div className="border-t border-slate-100 px-4 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Peças</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-600">
                    {entry.products.map((product, index) => (
                      <li key={`p-${index}`} className="flex justify-between gap-4">
                        <span>
                          {product.name}
                          {product.quantity > 1 ? ` ×${product.quantity}` : ''}
                        </span>
                        <span className="shrink-0">
                          {formatBRL(
                            Math.max(
                              0,
                              product.unitPriceCents * product.quantity - product.discountCents,
                            ),
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
