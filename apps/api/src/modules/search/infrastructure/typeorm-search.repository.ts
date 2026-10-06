import { Injectable, type OnModuleInit } from '@nestjs/common'
import { DataSource, In, type EntityTarget, type ObjectLiteral } from 'typeorm'
import type { SearchRepository } from '../application/ports/search.ports'
import type { GlobalSearchQuery, SearchHit } from '../domain/search.types'
import { CustomerOrmEntity } from '../../../shared/infrastructure/persistence/customer.orm-entity'
import { SegmentOrmEntity } from '../../../shared/infrastructure/persistence/segment.orm-entity'
import { SegmentConditionOrmEntity } from '../../../shared/infrastructure/persistence/segment-condition.orm-entity'
import { CampaignOrmEntity } from '../../../shared/infrastructure/persistence/campaign.orm-entity'

/**
 * Search across the three record types.
 *
 * Matching is layered so a palette query is lenient in the ways people actually
 * type: a full contiguous phrase, every word present in any order, a word prefix,
 * and — for three characters or more — trigram similarity for typos. Case and
 * accents are folded with `unaccent`, so `NJOYA` finds `Njoya` and `reseaux`
 * finds `réseaux`. The three layers run as one SQL pass per table and are ranked
 * in-process, so nothing needs an external search engine.
 */
@Injectable()
export class TypeOrmSearchRepository implements SearchRepository, OnModuleInit {
  public constructor(private readonly dataSource: DataSource) {}

  public async onModuleInit(): Promise<void> {
    // Both extensions are included with every PostgreSQL distribution and are
    // "trusted" (safe for the application role). They are optional: a database
    // that refuses them falls back to plain substring matching.
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS unaccent')
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    } catch {
      // Unaccent and pg_trgm are not available; the queries degrade to ILIKE.
    }
  }

  public async search(query: GlobalSearchQuery): Promise<SearchHit[]> {
    const phrase = query.q.trim()
    const tokens = phrase.split(/\s+/).filter((token) => token.length > 0)
    if (tokens.length === 0) return []
    const { params, prefix, likePhrase, tokenLikes } = buildPatterns(phrase, tokens)

    const [customers, segments, campaigns] = await Promise.all([
      this.#matchCustomers(params, prefix, likePhrase, tokenLikes, query.limit),
      this.#matchSegments(params, prefix, likePhrase, tokenLikes, query.limit),
      this.#matchCampaigns(params, prefix, likePhrase, tokenLikes, query.limit),
    ])

    const ranked = [...customers, ...segments, ...campaigns]
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, query.limit)

    return ranked
  }

  async #matchCustomers(
    params: Record<string, string>,
    prefix: string,
    likePhrase: string,
    tokenLikes: string[],
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.#rawHits({
      entity: CustomerOrmEntity,
      alias: 'c',
      titleColumn: '"c"."name"',
      subtitleSql: '"c"."email"',
      metaSql: '"c"."status"',
      columns: [
        { expression: '"c"."name"', weight: 1.0 },
        { expression: '"c"."email"', weight: 0.6 },
        { expression: '"c"."country"', weight: 0.3 },
      ],
      params,
      prefix,
      likePhrase,
      tokenLikes,
      limit,
    })
    return rows.map((row) => ({
      type: 'customer' as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? null,
      meta: row.meta ?? null,
      score: Number(row.score),
    }))
  }

  async #matchSegments(
    params: Record<string, string>,
    prefix: string,
    likePhrase: string,
    tokenLikes: string[],
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.#rawHits({
      entity: SegmentOrmEntity,
      alias: 's',
      titleColumn: '"s"."name"',
      metaSql: '"s"."matchCount"::text',
      subtitleSql: 'NULL::text',
      columns: [{ expression: '"s"."name"', weight: 1.0 }],
      params,
      prefix,
      likePhrase,
      tokenLikes,
      limit,
    })

    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    const segments = await this.dataSource.getRepository(SegmentOrmEntity).find({
      where: { id: In(ids) },
    })
    const byId = new Map(segments.map((segment) => [segment.id, segment]))

    return rows.map((row) => {
      const segment = byId.get(row.id)
      return {
        type: 'segment' as const,
        id: row.id,
        title: row.title,
        subtitle: segment ? summarizeConditions(segment.conditions) : null,
        meta: row.meta ?? null,
        score: Number(row.score),
      }
    })
  }

  async #matchCampaigns(
    params: Record<string, string>,
    prefix: string,
    likePhrase: string,
    tokenLikes: string[],
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.#rawHits({
      entity: CampaignOrmEntity,
      alias: 'c',
      titleColumn: '"c"."title"',
      subtitleSql: '"c"."segmentName"',
      metaSql: '"c"."channel"',
      columns: [
        { expression: '"c"."title"', weight: 1.0 },
        { expression: '"c"."segmentName"', weight: 0.6 },
        { expression: '"c"."objective"', weight: 0.3 },
        { expression: '"c"."callToAction"', weight: 0.2 },
        { expression: '"c"."message"', weight: 0.2 },
      ],
      params,
      prefix,
      likePhrase,
      tokenLikes,
      limit,
    })
    return rows.map((row) => ({
      type: 'campaign' as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? null,
      meta: row.meta ?? null,
      score: Number(row.score),
    }))
  }

  /**
   * Runs the shared matcher for one table and returns its raw hit rows
   * (`id`, `title`, `subtitle`, `meta`, `score`).
   */
  async #rawHits(opts: {
    entity: EntityTarget<ObjectLiteral>
    alias: string
    titleColumn: string
    subtitleSql?: string
    metaSql?: string
    columns: Array<{ expression: string; weight: number }>
    params: Record<string, string>
    prefix: string
    likePhrase: string
    tokenLikes: string[]
    limit: number
  }): Promise<Array<{ id: string; title: string; subtitle: string | null; meta: string | null; score: number }>> {
    const haystack = `unaccent(concat_ws(' ', ${opts.columns.map((f) => `unaccent(${f.expression})`).join(', ')}))`

    const weightedTerms = opts.columns.flatMap(({ expression, weight }) => [
      `CASE WHEN unaccent(${expression}) = unaccent(:phrase) THEN ${1.2 + weight} ELSE 0 END`,
      `CASE WHEN unaccent(${expression}) ILIKE unaccent(:likePhrase) THEN ${0.8 + weight} ELSE 0 END`,
      `CASE WHEN unaccent(${expression}) ILIKE unaccent(:prefix) THEN ${0.5 + weight} ELSE 0 END`,
      `CASE WHEN unaccent(${expression}) % unaccent(:phrase) THEN similarity(unaccent(${expression}), unaccent(:phrase)) * ${0.25 + weight} ELSE 0 END`,
    ])

    const tokenTerms = opts.tokenLikes.map(
      (_, index) => `CASE WHEN ${haystack} ILIKE unaccent(:tl${index}) THEN 0.15 ELSE 0 END`,
    )

    const scoreExpression = `GREATEST(${[...weightedTerms, ...tokenTerms].join(', ')})`

    // Match when every word is present anywhere in the record, the whole phrase
    // appears as a substring, or a field is trigram-similar (typo tolerance).
    const tokenAnd = opts.tokenLikes.map((_, index) => `${haystack} ILIKE unaccent(:tl${index})`).join(' AND ')
    const trigramOr = opts.columns
      .map(({ expression }) => `unaccent(${expression}) % unaccent(:phrase)`)
      .join(' OR ')
    const whereClause = `(${tokenAnd}) OR (${haystack} ILIKE unaccent(:likePhrase)) OR (${trigramOr})`

    const qb = this.dataSource
      .getRepository(opts.entity)
      .createQueryBuilder(opts.alias)
      .select(`${opts.alias}.id`, 'id')
      .addSelect(opts.titleColumn, 'title')
      .addSelect(opts.subtitleSql ?? 'NULL::text', 'subtitle')
      .addSelect(opts.metaSql ?? 'NULL::text', 'meta')
      .addSelect(scoreExpression, 'score')
      .where(whereClause)
      .setParameters(opts.params)
      .orderBy('score', 'DESC')
      .addOrderBy('title', 'ASC')
      .limit(opts.limit)

    const rows = await qb.getRawMany<{ id: string; title: string; subtitle: string | null; meta: string | null; score: number }>()
    return rows
  }
}

/**
 * Builds the LIKE patterns shared by every table query. Both the phrase and the
 * tokens are used as substring patterns (never exact equality), so a query
 * matches wherever the text appears rather than only when it is the whole value.
 */
function buildPatterns(
  phrase: string,
  tokens: string[],
): { params: Record<string, string>; prefix: string; likePhrase: string; tokenLikes: string[] } {
  const tokenLikes = tokens.map((token) => `%${token}%`)
  const prefix = `${phrase}%`
  const likePhrase = `%${phrase}%`
  const tokenParams: Record<string, string> = { phrase }
  tokenLikes.forEach((pattern, index) => {
    tokenParams[`tl${index}`] = pattern
  })
  return { params: { phrase, prefix, likePhrase, ...tokenParams }, prefix, likePhrase, tokenLikes }
}

const OPERATOR_SYMBOL: Readonly<Record<string, string>> = { gt: '>', lt: '<', eq: '=' }

/** One-line description of a segment's conditions, used as its search subtitle. */
function summarizeConditions(conditions: SegmentConditionOrmEntity[]): string {
  return conditions
    .map((condition) => `${condition.field} ${OPERATOR_SYMBOL[condition.operator] ?? condition.operator} ${condition.value}`)
    .join(' · ')
}