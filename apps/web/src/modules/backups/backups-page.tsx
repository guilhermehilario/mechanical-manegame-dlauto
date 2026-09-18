import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { BackupDto } from '@mechanic-system/types';
import { formatBytes, formatDate } from '../../utils/format';
import { createBackup, deleteBackup, listBackups, restoreBackup } from '../../services/backups.service';
import { PageHeader } from '../../components/page-header';
import { btnPrimary } from '../../components/ui';
import { IconButton, IconActionGroup } from '../../components/icon-button';
import { IconRestore, IconTrash } from '../../components/icons';

/**
 * Backups (Fase 10, spec §3) — admin-only page. The API enforces the role;
 * the UI hides the nav entry for non-admins (AppLayout).
 */

interface RestoreConfirmState {
  backup: BackupDto;
  /** User-typed confirmation word. */
  typed: string;
}

export function BackupsPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<RestoreConfirmState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BackupDto | null>(null);

  const backupsQuery = useQuery({
    queryKey: ['backups'],
    queryFn: listBackups,
  });

  const createMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: () => {
      setActionError('Não foi possível criar o backup.');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreBackup(id),
    onSuccess: () => {
      setRestoreConfirm(null);
      setActionError(null);
    },
    onError: () => {
      setRestoreConfirm(null);
      setActionError('Não foi possível restaurar o backup (verifique a integridade e tente novamente).');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBackup(id),
    onSuccess: () => {
      setDeleteConfirm(null);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: () => {
      setDeleteConfirm(null);
      setActionError('Não foi possível excluir o backup.');
    },
  });

  const backups = backupsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups"
        description="Cópia de segurança local do banco e das imagens (armazenada com permissões restritas)."
        actions={
          <button
            type="button"
            onClick={() => {
              createMutation.mutate();
            }}
            disabled={createMutation.isPending}
            className={btnPrimary}
          >
            {createMutation.isPending ? 'Criando backup…' : 'Criar backup agora'}
          </button>
        }
      />

      {actionError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Data</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Banco</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Imagens</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Total</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Migração</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {backupsQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum backup ainda — crie o primeiro.
                </td>
              </tr>
            ) : (
              backups.map((backup) => (
                <tr key={backup.id}>
                  <td className="px-4 py-3 text-slate-800">{formatDate(backup.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(backup.databaseSizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {backup.storageFiles} arquivo(s)
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(backup.sizeBytes)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-xs text-slate-400">
                    {backup.manifest.prismaMigration ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconActionGroup>
                      <IconButton
                        icon={IconRestore}
                        tone="blue"
                        label={`Restaurar backup de ${formatDate(backup.createdAt)}`}
                        onClick={() => {
                          setRestoreConfirm({ backup, typed: '' });
                        }}
                      />
                      <IconButton
                        icon={IconTrash}
                        tone="red"
                        label={`Excluir backup de ${formatDate(backup.createdAt)}`}
                        onClick={() => {
                          setDeleteConfirm(backup);
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

      {restoreConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Restaurar backup</h2>
            <p className="mt-2 text-sm text-slate-600">
              A restauração <strong>substitui TODOS os dados atuais</strong> (banco + imagens)
              pelo conteúdo do backup de <strong>{formatDate(restoreConfirm.backup.createdAt)}</strong>.
              Esta ação não pode ser desfeita.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Digite <span className="font-mono font-bold">RESTAURAR</span> para confirmar
              <input
                type="text"
                value={restoreConfirm.typed}
                onChange={(event) => {
                  setRestoreConfirm({ ...restoreConfirm, typed: event.target.value });
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                autoFocus
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestoreConfirm(null);
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restoreConfirm.typed !== 'RESTAURAR' || restoreMutation.isPending}
                onClick={() => {
                  restoreMutation.mutate(restoreConfirm.backup.id);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar dados'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Excluir backup</h2>
            <p className="mt-2 text-sm text-slate-600">
              Excluir permanentemente o backup de {formatDate(deleteConfirm.createdAt)}?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm(null);
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(deleteConfirm.id);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
