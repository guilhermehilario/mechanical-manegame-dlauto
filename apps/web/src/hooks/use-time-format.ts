import { useQuery } from '@tanstack/react-query';
import { getShopSettings } from '../services/settings.service';
import type { TimeFormat } from '@mechanic-system/types';

const DEFAULT_TIME_FORMAT: TimeFormat = 'H24';

/**
 * Expõe o formato de data/hora configurado pela oficina (Configurações →
 * "Formato de data e hora"). A consulta usa a mesma chave de cache da tela
 * de Configurações (`['settings']`), então salvar o formato atualiza o app
 * inteiro imediatamente. Se as configurações ainda não carregaram, usa o
 * padrão H24 — nunca bloqueia a renderização.
 *
 * Fora de um QueryClientProvider (testes isolados), cai no padrão H24
 * em vez de quebrar a renderização.
 */
export function useTimeFormat(): TimeFormat {
  try {
    const settingsQuery = useQuery({
      queryKey: ['settings'],
      queryFn: getShopSettings,
      staleTime: Infinity, // muda só quando a oficina salva Configurações
    });
    return settingsQuery.data?.timeFormat ?? DEFAULT_TIME_FORMAT;
  } catch {
    // useQuery lança quando não há QueryClientProvider acima na árvore.
    return DEFAULT_TIME_FORMAT;
  }
}
