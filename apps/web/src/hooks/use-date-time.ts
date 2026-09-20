import { useQuery } from '@tanstack/react-query';
import { getShopSettings } from '../services/settings.service';
import type { DateFormat, TimeFormat } from '@mechanic-system/types';

const DEFAULTS: { dateFormat: DateFormat; timeFormat: TimeFormat } = {
  dateFormat: 'DD_MM_YYYY',
  timeFormat: 'H24',
};

/**
 * Expõe os formatos de data e hora configurados pela oficina (Configurações →
 * "Data e hora"). A consulta usa a mesma chave de cache da tela de
 * Configurações (`['settings']`), então salvar o formato atualiza o app
 * inteiro imediatamente. Se as configurações ainda não carregaram, usa os
 * padrões (DD/MM/AAAA · 24h) — nunca bloqueia a renderização.
 *
 * Fora de um QueryClientProvider (testes isolados), cai nos padrões em vez
 * de quebrar a renderização.
 */
export function useDateTime(): { dateFormat: DateFormat; timeFormat: TimeFormat } {
  try {
    const settingsQuery = useQuery({
      queryKey: ['settings'],
      queryFn: getShopSettings,
      staleTime: Infinity, // muda só quando a oficina salva Configurações
    });
    return {
      dateFormat: settingsQuery.data?.dateFormat ?? DEFAULTS.dateFormat,
      timeFormat: settingsQuery.data?.timeFormat ?? DEFAULTS.timeFormat,
    };
  } catch {
    // useQuery lança quando não há QueryClientProvider acima na árvore.
    return DEFAULTS;
  }
}