/**
 * Fonte única de formatação de data/hora do app (spec §23 — a formatação
 * mora na borda de UI; a API sempre devolve valores canônicos).
 *
 * O formato (24h ou 12h) vem das Configurações da oficina
 * (`ShopSettings.timeFormat`) e é lido pelo hook `useTimeFormat`
 * (`hooks/use-time-format.ts`, react-query). Todas as funções abaixo
 * recebem o formato explícito — nada aqui consulta rede.
 *
 *   H24 → dd/mm/aaaa HH:mm (24h, padrão brasileiro)
 *   H12 → dd/mm/aaaa hh:mm AM/PM
 */

import type { TimeFormat } from '@mechanic-system/types';

const DEFAULT_FORMAT: TimeFormat = 'H24';

const DATE_LOCALE = 'pt-BR';
const TZ_UTC = 'UTC'; // datas "só de dia" (createdAt etc.) são UTC puro

function formatTimeOfDay(date: Date, timeFormat: TimeFormat): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === 'H12',
  }).format(date);
}

function formatDateNumeric(date: Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** `dd/mm/aaaa` — datas de calendário armazenadas em UTC (createdAt, paidAt…). */
export function formatDate(
  iso: string,
  // A data não exibe hora; o parâmetro existe para uniformizar a assinatura
  // de todos os helpers de data (códigos que chamam formatDate com o formato).
  _timeFormat: TimeFormat = DEFAULT_FORMAT,
): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, { dateStyle: 'short', timeZone: TZ_UTC }).format(
    new Date(iso),
  );
}

/** `dd/mm/aaaa HH:mm` (ou hh:mm AM/PM) no fuso local — instantes de agenda. */
export function formatDateTime(iso: string, timeFormat: TimeFormat = DEFAULT_FORMAT): string {
  const date = new Date(iso);
  return `${formatDateNumeric(date)} ${formatTimeOfDay(date, timeFormat)}`;
}

/** `HH:mm` ou `hh:mm AM/PM` no fuso local (agenda, dashboard). */
export function formatTime(date: Date, timeFormat: TimeFormat = DEFAULT_FORMAT): string {
  return formatTimeOfDay(date, timeFormat);
}

/** Label de exemplo para o formulário de Configurações, ex.: 25/12/2026 14:30. */
export function formatTimeExample(timeFormat: TimeFormat, now: Date = new Date()): string {
  return `${formatDateNumeric(now)} ${formatTimeOfDay(now, timeFormat)}`;
}
