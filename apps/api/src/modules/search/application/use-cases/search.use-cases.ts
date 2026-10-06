import { Inject, Injectable } from '@nestjs/common'
import { SEARCH_PORTS } from '../ports/search.ports'
import type { SearchRepository } from '../ports/search.ports'
import type { GlobalSearchQuery, GlobalSearchResult } from '../../domain/search.types'

/**
 * Global search. Measures its own cost so the palette can surface latency, and
 * reports the number of hits actually returned (`.total`) rather than a count
 * that ignores the page cap.
 */
@Injectable()
export class SearchGlobal {
  public constructor(@Inject(SEARCH_PORTS.repository) private readonly search: SearchRepository) {}

  public async execute(query: GlobalSearchQuery): Promise<GlobalSearchResult> {
    const started = performance.now()
    const results = await this.search.search(query)
    return {
      query: query.q,
      total: results.length,
      tookMs: Math.round(performance.now() - started),
      results,
    }
  }
}