import { getI18n } from 'react-i18next'

/** Currency, number, and date formatters shared across features. */

const MISSING = '—'

function activeLocale(): string {
  const instance = getI18n()
  return instance?.resolvedLanguage ?? instance?.language ?? 'en'
}

/** True only for finite numbers; NaN and Infinity render as a missing placeholder. */
function isFiniteNumber(value: number): value is number {
  return Number.isFinite(value)
}

/** Parses an ISO string to a valid timestamp, or NaN when the input is unparseable. */
function toTimestamp(isoDate: string): number {
  if (isoDate === '') return NaN
  return new Date(isoDate).getTime()
}

/** Formats an integer amount of XAF with thousands separators, e.g. "52,300 XAF". */
export function formatXaf(amount: number): string {
  if (!isFiniteNumber(amount)) return MISSING
  return `${new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: 0 }).format(amount)} XAF`
}

/** Compact currency for KPI tiles, e.g. "1.2M XAF". */
export function formatXafCompact(amount: number): string {
  if (!isFiniteNumber(amount)) return MISSING
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M XAF`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K XAF`
  return `${new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: 0 }).format(amount)} XAF`
}

export function formatNumber(value: number): string {
  if (!isFiniteNumber(value)) return MISSING
  return new Intl.NumberFormat(activeLocale()).format(value)
}

export function formatDate(isoDate: string): string {
  const timestamp = toTimestamp(isoDate)
  if (!Number.isFinite(timestamp)) return MISSING
  return new Date(timestamp).toLocaleDateString(activeLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(isoDate: string): string {
  const timestamp = toTimestamp(isoDate)
  if (!Number.isFinite(timestamp)) return MISSING
  return new Date(timestamp).toLocaleString(activeLocale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Whole days between the given ISO date and today, clamped to zero. */
export function daysSince(isoDate: string): number {
  const timestamp = toTimestamp(isoDate)
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
}