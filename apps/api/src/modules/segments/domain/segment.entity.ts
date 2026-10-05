import { ValidationError } from '../../../shared/domain/domain.errors'

export const SEGMENT_FIELDS = ['totalAmountSpent', 'totalTransactions', 'lastActivityDays', 'country'] as const
export type SegmentField = (typeof SEGMENT_FIELDS)[number]

export const SEGMENT_OPERATORS = ['gt', 'lt', 'eq'] as const
export type SegmentOperator = (typeof SEGMENT_OPERATORS)[number]

/** Guards values arriving from storage, where the column is a plain string. */
export function isSegmentField(value: string): value is SegmentField {
  return (SEGMENT_FIELDS as readonly string[]).includes(value)
}

export function isSegmentOperator(value: string): value is SegmentOperator {
  return (SEGMENT_OPERATORS as readonly string[]).includes(value)
}

/**
 * What the matcher needs to know about a customer. Declaring it here rather than
 * importing the customers module keeps the two domains independent: the segment
 * rules depend on a read model, not on another module's entity.
 */
export interface AudienceMember {
  readonly totalAmountSpent: number
  readonly totalTransactions: number
  readonly lastActivityDays: number
  readonly country: string
}

export interface SegmentCondition {
  readonly id: string
  readonly field: SegmentField
  readonly operator: SegmentOperator
  readonly value: number | string
  matches(member: AudienceMember): boolean
}

/** Plain data shape of a condition, used for API responses. */
export interface SegmentConditionView {
  readonly id: string
  readonly field: SegmentField
  readonly operator: SegmentOperator
  readonly value: number | string
}

/** Incoming conditions are data only — behaviour is attached when they are built. */
export type NewSegmentCondition = Omit<SegmentConditionView, 'id'>

export interface NewSegment {
  readonly name: string
  readonly conditions: readonly NewSegmentCondition[]
}

export class Segment {
  public constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly conditions: readonly SegmentCondition[],
    public readonly matchCount: number,
    public readonly createdAt: Date,
  ) {}

  public static reconstitute(input: {
    id: string
    name: string
    conditions: readonly SegmentCondition[]
    matchCount: number
    createdAt: Date
  }): Segment {
    return new Segment(input.id, input.name, input.conditions, input.matchCount, input.createdAt)
  }

  public static create(input: NewSegment, matchCount: number, id = ''): Segment {
    if (input.name.trim().length < 2) {
      throw new ValidationError('The segment could not be saved.', {
        name: ['Give the segment a name of at least 2 characters.'],
      })
    }
    if (input.conditions.length === 0) {
      throw new ValidationError('The segment could not be saved.', {
        conditions: ['Add at least one condition.'],
      })
    }

    const conditions = input.conditions.map((condition, index) =>
      SegmentCondition.create(condition, `condition-${index}`),
    )

    return new Segment(id, input.name.trim(), conditions, matchCount, new Date())
  }
}

/**
 * One clause of a segment. Comparison semantics live here so every consumer —
 * preview, saved segments and campaign targeting — agrees on them.
 */
export class SegmentCondition {
  private constructor(
    public readonly id: string,
    public readonly field: SegmentField,
    public readonly operator: SegmentOperator,
    public readonly value: number | string,
  ) {}

  /** Rebuilds a condition read from storage, where the value column is text. */
  public static reconstitute(condition: SegmentConditionView): SegmentCondition {
    return SegmentCondition.create(
      { field: condition.field, operator: condition.operator, value: condition.value },
      condition.id,
    )
  }

  public static create(condition: NewSegmentCondition, id: string): SegmentCondition {
    if (condition.field === 'country') {
      // Mirrors the contract: a country is either kept or dropped, never ordered.
      if (condition.operator !== 'eq') {
        throw new ValidationError('A country condition can only test equality.', {
          conditions: ['Choose “is” for a country instead of a greater/less comparison.'],
        })
      }
      if (typeof condition.value !== 'string' || condition.value.trim().length === 0) {
        throw new ValidationError('A country condition needs a country name.', {
          conditions: ['A country condition needs a country name.'],
        })
      }
      return new SegmentCondition(id, condition.field, condition.operator, condition.value.trim())
    }

    if (typeof condition.value !== 'number' || !Number.isFinite(condition.value)) {
      throw new ValidationError('A numeric condition needs a numeric threshold.', {
        conditions: ['A numeric condition needs a numeric threshold.'],
      })
    }
    return new SegmentCondition(id, condition.field, condition.operator, condition.value)
  }

  /** Evaluates this clause against one audience member. */
  public matches(member: AudienceMember): boolean {
    switch (this.field) {
      case 'country': {
        const left = member.country.toLowerCase()
        const right = String(this.value).toLowerCase()
        return compare(left, right, this.operator)
      }
      case 'lastActivityDays':
      case 'totalAmountSpent':
      case 'totalTransactions':
        return compare(member[this.field], this.value as number, this.operator)
      default: {
        // Unreachable: `field` is constrained by the union in the constructor.
        const exhaustive: never = this.field
        return exhaustive
      }
    }
  }

  public toJSON(): SegmentConditionView {
    return { id: this.id, field: this.field, operator: this.operator, value: this.value }
  }
}

function compare(left: number | string, right: number | string, operator: SegmentOperator): boolean {
  switch (operator) {
    case 'gt':
      return left > right
    case 'lt':
      return left < right
    case 'eq':
      return left === right
    default: {
      const exhaustive: never = operator
      return exhaustive
    }
  }
}

/**
 * All clauses must hold — conjunction, matching how the UI presents them.
 *
 * An empty list matches every member, which is what `every` means; it is
 * unreachable through the API because both the request schemas and
 * `Segment.create` refuse a segment with no conditions.
 */
export function matchesAll(conditions: readonly SegmentCondition[], member: AudienceMember): boolean {
  return conditions.every((condition) => condition.matches(member))
}