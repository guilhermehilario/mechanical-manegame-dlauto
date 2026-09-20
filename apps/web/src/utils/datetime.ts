/**
 * Fonte única de formatação de data/hora do app (spec §23 — a formatação
 * mora na borda de UI; a API sempre devolve valores canônicos).
 *
 * Os formatos (data: DD/MM/AAAA | AAAA/MM/DD | MM/DD/AAAA; hora: 24h ou 12h)
 * vêm das Configurações da oficina (`ShopSettings.dateFormat`/`timeFormat`) e
 * são lidos pelo hook `useDateTime` (`hooks/use-date-time.ts`, react-query).
 * Todas as funções abaixo recebem o formato explícito — nada aqui consulta rede.
 *
 *   DD_MM_YYYY + H24 → dd/mm/aaaa HH:mm (padrão brasileiro)
 *   YYYY_MM_DD + H12 → aaaa/mm/dd hh:mm AM/PM
 */

import type { DateFormat, TimeFormat } from '@mechanic-system/types';

const DEFAULT_DATE_FORMAT: DateFormat = 'DD_MM_YYYY';
const DEFAULT_TIME_FORMAT: TimeFormat = 'H24';
const DATE_LOCALE = 'pt-BR';
// Datas "só de dia" (createdAt, paidAt, datas de relatório) são armazenadas
// como UTC puro: a data exibida nunca deve sofrer shift de fuso.

function formatTimeOfDay(date: Date, timeFormat: TimeFormat): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === 'H12',
  }).format(date);
}

/**
 * Pede a parte de data nos componentes em `dateFormat`. `useUtc: true`
 * preserva o dia "só de data" (formatDate); `false` usa o fuso local (que é
 * o mesmo relógio exibido ao lado, em formatDateTime).
 */
function formatDateParts(date: Date, dateFormat: DateFormat, useUtc: boolean): string {
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
  const month = String((useUtc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
  const day = String(useUtc ? date.getUTCDate() : date.getDate()).padStart(2, '0');
  switch (dateFormat) {
    case 'YYYY_MM_DD':
      return `${year}/${month}/${day}`;
    case 'MM_DD_YYYY':
      return `${month}/${day}/${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * `dd/mm/aaaa`, `aaaa/mm/dd` ou `mm/dd/aaaa` — dias de calendário guardados
 * em UTC (createdAt, paidAt, datas de relatório). Valores inválidos voltam
 * intactos (nunca quebram a renderização).
 */
export function formatDate(
  iso: string,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
  // A data não exibe hora; o parâmetro existe para uniformizar a assinatura
  // de todos os helpers de data (códigos que chamam formatDate com o formato).
  _timeFormat: TimeFormat = DEFAULT_TIME_FORMAT,
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return formatDateParts(date, dateFormat, true);
}

/** `dd/mm/aaaa HH:mm` (ou outro formato/AM-PM) no fuso local — instantes. */
export function formatDateTime(
  iso: string,
  dateFormat: DateFormat = DEFAULT_DATE_FORMAT,
  timeFormat: TimeFormat = DEFAULT_TIME_FORMAT,
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return `${formatDateParts(date, dateFormat, false)} ${formatTimeOfDay(date, timeFormat)}`;
}

/** `HH:mm` ou `hh:mm AM/PM` no fuso local (agenda, dashboard). */
export function formatTime(date: Date, timeFormat: TimeFormat = DEFAULT_TIME_FORMAT): string {
  return formatTimeOfDay(date, timeFormat);
}

/** Label de exemplo de data para o formulário (ex.: 06/03/2026). */
export function formatDateExample(dateFormat: DateFormat): string {
  return formatDate('2026-03-06', dateFormat);
}

/** Label de exemplo de data+hora para Configurações (ex.: 25/12/2026 14:30). */
export function formatTimeExample(
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
  now: Date = new Date(),
): string {
  return `${formatDateParts(now, dateFormat, false)} ${formatTimeOfDay(now, timeFormat)}`;
}