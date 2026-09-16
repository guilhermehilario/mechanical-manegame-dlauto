import { type FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shopSettingsSchema } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import { getShopSettings, updateShopSettings } from '../../services/settings.service';
import { useAuth } from '../auth/use-auth';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

/**
 * Shop settings (Bloco F2 mínimo): identity used by the printed OS and pickup
 * receipt. Everyone can read; ADMIN/MANAGER can edit (API enforces).
 */
export function SettingsPage() {
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
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    saveMutation.mutate(parsed.data);
  }

  return (
    <section className="mx-auto max-w-lg">
      <h1 className="text-lg font-bold text-slate-900">Configurações</h1>
      <p className="mb-4 text-sm text-slate-500">
        Dados da oficina impressos na OS e no comprovante de retirada.
      </p>

      {settingsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
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
      )}
    </section>
  );
}
