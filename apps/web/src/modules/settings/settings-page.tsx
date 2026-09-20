import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shopSettingsSchema } from '@mechanic-system/validation';
import type { DateFormat, TimeFormat } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { formatDateExample, formatTimeExample } from '../../utils/datetime';
import { getShopSettings, updateShopSettings } from '../../services/settings.service';
import { useAuth } from '../auth/use-auth';
import { BackupSettingsSection } from './backup-settings-section';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const tabClass =
  'rounded-t-md border-b-2 px-4 py-2 text-sm font-semibold transition-colors';

type Tab = 'identidade' | 'data-hora' | 'operacao' | 'conta';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  MECHANIC: 'Mecânico',
  ATTENDANT: 'Atendente',
};

function Tabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ id: Tab; label: string }> = [
    { id: 'identidade', label: 'Identidade da oficina' },
    { id: 'data-hora', label: 'Data e hora' },
    { id: 'operacao', label: 'Operação' },
    { id: 'conta', label: 'Minha conta' },
  ];
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          onClick={() => {
            onChange(item.id);
          }}
          className={`${tabClass} ${
            active === item.id
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function IdentitySection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: getShopSettings,
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [documentFooter, setDocumentFooter] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (settings) {
      setName(settings.name);
      setPhone(settings.phone ?? '');
      setAddress(settings.address ?? '');
      setDocumentFooter(settings.documentFooter ?? '');
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateShopSettings,
    onSuccess: () => {
      setFormError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      setSaved(false);
      setFormError(
        error instanceof ApiClientError ? error.message : 'Não foi possível salvar.',
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSaved(false);
    setFormError(null);
    const parsed = shopSettingsSchema.safeParse({
      name,
      phone: phone === '' ? null : phone,
      address: address === '' ? null : address,
      documentFooter: documentFooter === '' ? null : documentFooter,
      timeFormat: settingsQuery.data?.timeFormat ?? 'H24',
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    saveMutation.mutate(parsed.data);
  }

  if (settingsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-6" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="shop-name" className="mb-1 block text-sm font-medium text-slate-700">
          Nome da oficina *
        </label>
        <input
          id="shop-name"
          className={inputClass}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          disabled={!canEdit || saveMutation.isPending}
        />
      </div>

      <div>
        <label htmlFor="shop-phone" className="mb-1 block text-sm font-medium text-slate-700">
          Telefone
        </label>
        <input
          id="shop-phone"
          className={inputClass}
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
          placeholder="(11) 3333-4444"
          disabled={!canEdit || saveMutation.isPending}
        />
      </div>

      <div>
        <label htmlFor="shop-address" className="mb-1 block text-sm font-medium text-slate-700">
          Endereço
        </label>
        <input
          id="shop-address"
          className={inputClass}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          disabled={!canEdit || saveMutation.isPending}
        />
      </div>

      <div>
        <label htmlFor="shop-footer" className="mb-1 block text-sm font-medium text-slate-700">
          Rodapé dos documentos
        </label>
        <textarea
          id="shop-footer"
          rows={2}
          className={inputClass}
          value={documentFooter}
          onChange={(event) => {
            setDocumentFooter(event.target.value);
          }}
          placeholder="Ex.: Obrigado pela preferência! Garantia de 90 dias."
          disabled={!canEdit || saveMutation.isPending}
        />
      </div>

      {formError ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Configurações salvas.
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Somente administradores e gerentes podem editar.
        </p>
      )}
    </form>
  );
}

/** Formato de data e hora usado em todo o app (H24 padrão; H12 = AM/PM). */
function TimeFormatSection({
  value,
  onChange,
  disabled,
}: {
  value: TimeFormat;
  onChange: (format: TimeFormat) => void;
  disabled: boolean;
}) {
  const options: Array<{ id: TimeFormat; label: string }> = [
    { id: 'H24', label: '24 horas' },
    { id: 'H12', label: '12 horas (AM/PM)' },
  ];
  return (
    <fieldset className="border-t border-slate-100 pt-4">
      <legend className="mb-1 text-sm font-medium text-slate-700">Formato de data e hora</legend>
      <p className="mb-2 text-xs text-slate-500">
        Como as datas aparecem no app. Data sempre no formato brasileiro
        (dd/mm/aaaa); muda apenas a hora.
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Formato de data e hora">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              value === option.id
                ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="radio"
              name="time-format"
              value={option.id}
              checked={value === option.id}
              onChange={() => {
                onChange(option.id);
              }}
              disabled={disabled}
              className="accent-blue-600"
            />
            {option.label}
            <span className="text-xs text-slate-400">
              ({formatTimeExample('DD_MM_YYYY', option.id)})
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Formato de data usado em todo o app (padrão DD/MM/AAAA; opções ISO/US). */
function DateFormatSection({
  value,
  onChange,
  disabled,
}: {
  value: DateFormat;
  onChange: (format: DateFormat) => void;
  disabled: boolean;
}) {
  const options: Array<{ id: DateFormat; label: string }> = [
    { id: 'DD_MM_YYYY', label: 'DD/MM/AAAA' },
    { id: 'YYYY_MM_DD', label: 'AAAA/MM/DD' },
    { id: 'MM_DD_YYYY', label: 'MM/DD/AAAA' },
  ];
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700">Formato da data</legend>
      <p className="mb-2 text-xs text-slate-500">
        Como as datas são exibidas em toda a plataforma.
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Formato da data">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              value === option.id
                ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="radio"
              name="date-format"
              value={option.id}
              checked={value === option.id}
              onChange={() => {
                onChange(option.id);
              }}
              disabled={disabled}
              className="accent-blue-600"
            />
            {option.label}
            <span className="text-xs text-slate-400">({formatDateExample(option.id)})</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Aba própria de data/hora (2026-09-18) — salva só o formato, preservando
 * os demais campos (a API sobrescreve com null quando o campo é omitido). */
function DateTimeSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: getShopSettings,
  });

  const [selectedDate, setSelectedDate] = useState<DateFormat>('DD_MM_YYYY');
  const [selected, setSelected] = useState<TimeFormat>('H24');
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setSelectedDate(settingsQuery.data.dateFormat);
      setSelected(settingsQuery.data.timeFormat);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateShopSettings,
    onSuccess: () => {
      setFormError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      setSaved(false);
      setFormError(
        error instanceof ApiClientError ? error.message : 'Não foi possível salvar.',
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const settings = settingsQuery.data;
    if (!settings) return;
    setSaved(false);
    setFormError(null);
    const parsed = shopSettingsSchema.safeParse({
      name: settings.name,
      phone: settings.phone,
      address: settings.address,
      documentFooter: settings.documentFooter,
      dateFormat: selectedDate,
      timeFormat: selected,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    saveMutation.mutate(parsed.data);
  }

  if (settingsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-6" onSubmit={handleSubmit} noValidate>
      <DateFormatSection
        value={selectedDate}
        onChange={setSelectedDate}
        disabled={!canEdit || saveMutation.isPending}
      />
      <TimeFormatSection
        value={selected}
        onChange={setSelected}
        disabled={!canEdit || saveMutation.isPending}
      />

      {formError ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Configurações salvas.
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Somente administradores e gerentes podem editar.
        </p>
      )}
    </form>
  );
}

function OperationsSection() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        A área de operação (backup e catálogo de exemplo) é exclusiva do administrador.
      </div>
    );
  }
  return <BackupSettingsSection />;
}

function AccountSection() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <p className="text-sm font-semibold text-slate-800">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
        <p className="mt-1 text-sm text-slate-600">Papel: {ROLE_LABELS[user.role] ?? user.role}</p>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <Link
          to="/change-password"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          Alterar minha senha
        </Link>
        <p className="mt-1 text-xs text-slate-400">
          Trocar a senha revoga as outras sessões abertas.
        </p>
      </div>
    </div>
  );
}

/**
 * Settings (2026-09-18) — reorganized in tabs:
 * Identidade (F2, printed documents); Data e hora (H24/H12 app-wide);
 * Operação (backup runtime config + manual backup + optional example
 * catalog); Conta (who am I + change password). RBAC mirrored from the API.
 */
export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('identidade');

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-lg font-bold text-slate-900">Configurações</h1>
      <p className="mb-4 text-sm text-slate-500">
        Identidade da oficina, formato de data e hora, backup automático e sua conta.
      </p>

      <Tabs active={tab} onChange={setTab} />

      {tab === 'identidade' ? <IdentitySection /> : null}
      {tab === 'data-hora' ? <DateTimeSection /> : null}
      {tab === 'operacao' ? <OperationsSection /> : null}
      {tab === 'conta' ? <AccountSection /> : null}
    </section>
  );
}