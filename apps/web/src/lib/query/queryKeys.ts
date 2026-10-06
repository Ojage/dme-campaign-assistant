/**
 * Every cache key in one place.
 *
 * Centralised so an invalidation after a write cannot drift from the key a read
 * subscribed to — the usual cause of a list that silently goes stale.
 */
export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (filters: Record<string, unknown>) => ['customers', 'list', filters] as const,
    kpis: ['customers', 'kpis'] as const,
    countries: ['customers', 'countries'] as const,
    countrySpend: ['customers', 'country-spend'] as const,
    activityTrend: (months: number) => ['customers', 'activity-trend', months] as const,
    health: ['customers', 'health'] as const,
    top: ['customers', 'top'] as const,
  },
  segments: {
    all: ['segments'] as const,
    summary: ['segments', 'summary'] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
  },
  chat: {
    threads: ['chat', 'threads'] as const,
    messages: (threadId: string) => ['chat', 'messages', threadId] as const,
  },
} as const
