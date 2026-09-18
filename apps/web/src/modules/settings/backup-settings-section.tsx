import { type FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../services/api-client';
import { createBackup, getBackupConfig, updateBackupConfig } from '../../services/backups.service';
import { getBackupStatus } from '../../services/backup-status.service';
import { seedCatalogExample } from '../../services/catalog.service';

const numberClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

function formatLastBackup(latestAt: string | null, hoursSinceLast: number | null): string {
  if (!latestAt || hoursSinceLast === null) return 'Nenhum backup ainda.';
  const label =
    hoursSinceLast < 1
      ? 'menos de 1 hora'
      : hoursSinceLast < 24
        ? `${Math.round(hoursSinceLast)}h atrás`
        : `${(hoursSinceLast / 24).toFixed(1)} dias atrás`;
  return `Último backup há ${label}.`;
}

/**
 * Settings > Operação (2026-09-18): automatic backup runtime config, manual
 * backup CTA and the optional example catalog. ADMIN-only surface (the API
 * enforces it) — everything saved here takes effect without a restart.
 */
export function BackupSettingsSection() {
  const queryClient = useQueryClient();

  const configQuery = useQuery({ queryKey: ['backup-config'], queryFn: getBackupConfig });
  const statusQuery = useQuery({ queryKey: ['backup-status'], queryFn: getBackupStatus });

  const [autoEnabled, setAutoEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState('24');
  const [keep, setKeep] = useState('14');
  const [alertAfterHours, setAlertAfterHours] = useState('24');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: updateBackupConfig,
    onSuccess: () => {
      setFormError(null);
      setNotice('Configurações de backup salvas.');
      void queryClient.invalidateQueries({ queryKey: ['backup-config'] });
      void queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error) => {
      setNotice(null);
      setFormError(
        error instanceof ApiClientError ? error.message : 'Não foi possível salvar o backup.',
      );
    },
  });

  const backupNowMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      setNotice('Backup criado com sucesso.');
      void queryClient.invalidateQueries({ queryKey: ['backup-config'] });
      void queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: () => {
      setNotice(null);
      setFormError('Não foi possível criar o backup agora.');
    },
  });

  const seedMutation = useMutation({
    mutationFn: seedCatalogExample,
    onSuccess: (result) => {
      setSeedNotice(
        `Catálogo de exemplo carregado (${result.services} serviços, ${result.products} produtos, ${result.suppliers} fornecedores).`,
      );
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: () => {
      setSeedNotice(null);
      setFormError('Não foi possível carregar o catálogo de exemplo.');
    },
  });

  const status = statusQuery.data;
  const config = configQuery.data;

  useEffect(() => {
    if (config) {
      setAutoEnabled(config.autoEnabled);
      setIntervalHours(String(config.intervalHours));
      setKeep(String(config.keep));
      setAlertAfterHours(String(config.alertAfterHours));
    }
  }, [config]);

  if (config) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800">Backup automático</h2>
          <p className="mb-3 text-sm text-slate-500">
            {status ? formatLastBackup(status.latestAt, status.hoursSinceLast) : 'Verificando…'}
            {status?.isStale ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Atrasado
              </span>
            ) : null}
          </p>

          <form
            className="space-y-4"
            noValidate
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const parsed = {
                autoEnabled,
                intervalHours: Number(intervalHours),
                keep: Number(keep),
                alertAfterHours: Number(alertAfterHours),
              };
              if (
                !Number.isInteger(parsed.intervalHours) ||
                parsed.intervalHours < 1 ||
                parsed.intervalHours > 168
              ) {
                setFormError('Intervalo deve ser um número inteiro entre 1 e 168 horas.');
                return;
              }
              if (!Number.isInteger(parsed.keep) || parsed.keep < 1 || parsed.keep > 365) {
                setFormError('Retenção deve ser um número inteiro entre 1 e 365 backups.');
                return;
              }
              if (
                !Number.isInteger(parsed.alertAfterHours) ||
                parsed.alertAfterHours < 1 ||
                parsed.alertAfterHours > 720
              ) {
                setFormError('Alerta deve ser um número inteiro entre 1 e 720 horas.');
                return;
              }
              setFormError(null);
              saveMutation.mutate(parsed);
            }}
          >
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(event) => {
                  setAutoEnabled(event.target.checked);
                }}
                className="rounded border-slate-300"
              />
              Backup automático ativo
            </label>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="backup-interval"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  Intervalo (horas)
                </label>
                <input
                  id="backup-interval"
                  className={numberClass}
                  inputMode="numeric"
                  value={intervalHours}
                  onChange={(event) => {
                    setIntervalHours(event.target.value);
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="backup-keep"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  Guardar (últimos)
                </label>
                <input
                  id="backup-keep"
                  className={numberClass}
                  inputMode="numeric"
                  value={keep}
                  onChange={(event) => {
                    setKeep(event.target.value);
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="backup-alert"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  Alerta após (horas)
                </label>
                <input
                  id="backup-alert"
                  className={numberClass}
                  inputMode="numeric"
                  value={alertAfterHours}
                  onChange={(event) => {
                    setAlertAfterHours(event.target.value);
                  }}
                />
              </div>
            </div>

            {formError ? (
              <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}
            {notice ? (
              <div role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                {notice}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Salvando…' : 'Salvar backup'}
              </button>
              <button
                type="button"
                onClick={() => {
                  backupNowMutation.mutate();
                }}
                disabled={backupNowMutation.isPending}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {backupNowMutation.isPending ? 'Criando…' : 'Fazer backup agora'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800">Catálogo de exemplo</h2>
          <p className="mb-3 text-sm text-slate-500">
            Opcional — carrega serviços, produtos e fornecedores de exemplo para facilitar a
            primeira semana. Nada é criado sem a sua ação.
          </p>
          <button
            type="button"
            onClick={() => {
              seedMutation.mutate();
            }}
            disabled={seedMutation.isPending}
            className="rounded-md border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {seedMutation.isPending ? 'Carregando…' : 'Carregar catálogo de exemplo'}
          </button>
          {seedNotice ? (
            <p role="status" className="mt-3 text-sm text-green-700">
              {seedNotice}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
      Carregando configurações…
    </div>
  );
}