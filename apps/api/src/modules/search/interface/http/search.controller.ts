import { Controller, Get, Query } from '@nestjs/common'
import * as z from 'zod/v4'
import { searchQuerySchema } from '@dme/contracts'
import { zodQuery } from '../../../../shared/http/zod-validation.pipe'
import { SearchGlobal } from '../../application/use-cases/search.use-cases'
import type { GlobalSearchResult } from '../../domain/search.types'

@Controller('search')
export class SearchController {
  public constructor(private readonly searchGlobal: SearchGlobal) {}

  @Get()
  public async search(@Query(zodQuery(searchQuerySchema)) query: z.infer<typeof searchQuerySchema>): Promise<GlobalSearchResult> {
    return this.searchGlobal.execute({ q: query.q, limit: query.limit })
  }
}