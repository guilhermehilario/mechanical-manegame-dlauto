import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBackupStatus } from '../../services/backup-status.service';

/**
 * Stale/missing backup warning (Bloco E/E2 of docs/todo-mvp.md). Rendered at
 * the top of the dashboard: the whole dataset is local-only, so a missing
 * backup is the single biggest data-loss risk of the product.
 *
 * The API route is ADMIN/MANAGER — for other roles the request 403s and the
 * banner renders nothing (silent degradation, no noise for mechanics).
 */
export function BackupAlertBanner() {
  const statusQuery = useQuery({
    queryKey: ['backup-status'],
    queryFn: getBackupStatus,
    staleTime: 60_000,
    retry: false,
  });

  const status = statusQuery.data;
  // Only show when something is actually wrong (query settled + stale).
  if (!status || !status.isStale) {
    return null;
  }

  const hours = status.hoursSinceLast;
  const detail =
    hours === null
      ? 'Nenhum backup foi criado ainda.'
      : `Último backup há ${Math.floor(hours)}h (limite: ${status.alertAfterHours}h).`;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div>
        <p className="text-sm font-semibold text-amber-800">
          ⚠️ Backup dos dados atrasado
        </p>
        <p className="text-sm text-amber-700">
          {detail} Em caso de falha do computador, os dados podem ser perdidos.
        </p>
      </div>
      <Link
        to="/backups"
        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Fazer backup agora
      </Link>
    </div>
  );
}
