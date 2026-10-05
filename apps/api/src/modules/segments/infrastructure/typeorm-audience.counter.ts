import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import type { SelectQueryBuilder } from 'typeorm'
import type { AudienceCounter } from '../application/ports/segment.ports'
import type { NewSegmentCondition } from '../domain/segment.entity'
import { CustomerOrmEntity } from '../../../shared/infrastructure/persistence/customer.orm-entity'

/**
 * Counts matching customers in SQL.
 *
 * This adapter reads the customers table on behalf of the segments module, which
 * is what the `AudienceCounter` port exists for: the segments domain asks the
 * question and never learns how customer data is stored. Adding a condition field
 * means editing `#clause`, and nothing else.
 */
@Injectable()
export class TypeOrmAudienceCounter implements AudienceCounter {
  public constructor(
    @InjectRepository(CustomerOrmEntity) private readonly customers: Repository<CustomerOrmEntity>,
  ) {}

  public async countMatching(conditions: readonly NewSegmentCondition[]): Promise<number> {
    if (conditions.length === 0) return 0

    let builder: SelectQueryBuilder<CustomerOrmEntity> = this.customers.createQueryBuilder('customer')
    conditions.forEach((condition, index) => {
      builder = this.#clause(builder, condition, `c${index}`)
    })

    return builder.getCount()
  }

  #clause(
    builder: SelectQueryBuilder<CustomerOrmEntity>,
    condition: NewSegmentCondition,
    alias: string,
  ): SelectQueryBuilder<CustomerOrmEntity> {
    // Parameters are bound, never interpolated — the condition comes from a request.
    switch (condition.field) {
      case 'totalAmountSpent':
        return builder.andWhere(`customer.totalAmountSpent ${operator(condition.operator)} :${alias}`, {
          [alias]: condition.value as number,
        })
      case 'totalTransactions':
        return builder.andWhere(`customer.totalTransactions ${operator(condition.operator)} :${alias}`, {
          [alias]: condition.value as number,
        })
      case 'lastActivityDays':
        // Expressed as a window rather than a column so the threshold reads as
        // "at least N days ago".
        return builder.andWhere(`customer.lastActivityDate ${reversed(condition.operator)} :${alias} * interval '1 day'`, {
          [alias]: condition.value as number,
        })
      case 'country':
        return builder.andWhere(`LOWER(customer.country) ${operator(condition.operator)} LOWER(:${alias})`, {
          [alias]: condition.value as string,
        })
      default: {
        const exhaustive: never = condition.field
        return exhaustive
      }
    }
  }
}

/** Maps the domain operator onto SQL. The values are a closed set, never input. */
function operator(value: NewSegmentCondition['operator']): string {
  switch (value) {
    case 'gt':
      return '>'
    case 'lt':
      return '<'
    case 'eq':
      return '='
    default: {
      const exhaustive: never = value
      return exhaustive
    }
  }
}

/**
 * "More days since last activity" inverts the comparison on the date column, so
 * `gt 30` becomes `lastActivityDate < now() - 30 days`.
 */
function reversed(value: NewSegmentCondition['operator']): string {
  switch (value) {
    case 'gt':
      return '<'
    case 'lt':
      return '>'
    case 'eq':
      return '='
    default: {
      const exhaustive: never = value
      return exhaustive
    }
  }
}
