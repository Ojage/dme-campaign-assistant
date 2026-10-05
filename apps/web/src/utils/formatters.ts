/** Currency, number, and date formatters shared across features. */

/** Formats an integer amount of XAF with thousands separators, e.g. "52,300 XAF". */
export function formatXaf(amount: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} XAF`
}

/** Compact currency for KPI tiles, e.g. "1.2M XAF". */
export function formatXafCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M XAF`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K XAF`
  return `${amount} XAF`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Whole days between the given ISO date and today. */
export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - then) / 86_400_000))
}
