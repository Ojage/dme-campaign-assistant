import {
  SEGMENT_FIELDS,
  SEGMENT_OPERATORS,
  Segment,
  SegmentCondition,
  isSegmentField,
  isSegmentOperator,
  matchesAll,
  type AudienceMember,
} from './segment.entity'
import { ValidationError } from '../../../shared/domain/domain.errors'

/**
 * Comparison semantics for every audience query the application makes.
 *
 * These are the rules a saved segment, a live preview and campaign targeting all
 * depend on, so they are asserted here rather than left to whichever adapter
 * happens to be under test.
 */

const MEMBER: AudienceMember = {
  country: 'Cameroon',
  totalAmountSpent: 300_000,
  totalTransactions: 12,
  lastActivityDays: 30,
}

function condition(field: (typeof SEGMENT_FIELDS)[number], operator: (typeof SEGMENT_OPERATORS)[number], value: number | string) {
  return SegmentCondition.create({ field, operator, value }, 'c1')
}

describe('segment field and operator guards', () => {
  it('accepts only the fields the audience model actually carries', () => {
    expect(SEGMENT_FIELDS).toEqual(['totalAmountSpent', 'totalTransactions', 'lastActivityDays', 'country'])
    expect(isSegmentField('country')).toBe(true)
    expect(isSegmentField('email')).toBe(false)
  })

  it('accepts only the three comparison operators', () => {
    expect(isSegmentOperator('gt')).toBe(true)
    expect(isSegmentOperator('gte')).toBe(false)
  })
})

describe('numeric conditions', () => {
  it('compares with greater-than, less-than and equals', () => {
    expect(condition('totalAmountSpent', 'gt', 300_000).matches(MEMBER)).toBe(false)
    expect(condition('totalAmountSpent', 'gt', 299_999).matches(MEMBER)).toBe(true)
    expect(condition('totalTransactions', 'lt', 12).matches(MEMBER)).toBe(false)
    expect(condition('totalTransactions', 'lt', 13).matches(MEMBER)).toBe(true)
    expect(condition('lastActivityDays', 'eq', 30).matches(MEMBER)).toBe(true)
  })

  it('rejects a non-numeric threshold when the condition is built', () => {
    // Storage keeps condition values as text, so conversion happens at the
    // boundary. A value that cannot be converted must fail loudly there rather
    // than quietly matching nobody.
    expect(() => condition('totalAmountSpent', 'gt', 'lots')).toThrow(ValidationError)
    expect(() => condition('totalAmountSpent', 'gt', Number.NaN)).toThrow(ValidationError)
  })
})

describe('country conditions', () => {
  it('compares text case-insensitively', () => {
    expect(condition('country', 'eq', 'cameroon').matches(MEMBER)).toBe(true)
    expect(condition('country', 'eq', 'CAMEROON').matches(MEMBER)).toBe(true)
    expect(condition('country', 'eq', 'Senegal').matches(MEMBER)).toBe(false)
  })

  it('refuses an ordering operator, matching the contract and the builder UI', () => {
    expect(() => SegmentCondition.create({ field: 'country', operator: 'gt', value: 'Cameroon' }, 'c1')).toThrow(ValidationError)
    expect(() => SegmentCondition.create({ field: 'country', operator: 'lt', value: 'Cameroon' }, 'c1')).toThrow(ValidationError)
  })

  it('refuses an empty country name', () => {
    expect(() => SegmentCondition.create({ field: 'country', operator: 'eq', value: '   ' }, 'c1')).toThrow(ValidationError)
  })
})

describe('combining conditions', () => {
  it('requires every condition to hold', () => {
    const all = [
      condition('totalAmountSpent', 'gt', 250_000),
      condition('lastActivityDays', 'lt', 45),
      condition('totalTransactions', 'gt', 100),
    ]

    expect(matchesAll(all, MEMBER)).toBe(false)
    expect(matchesAll(all.slice(0, 2), MEMBER)).toBe(true)
  })

  it('matches everyone when given no conditions, which the API cannot request', () => {
    expect(matchesAll([], MEMBER)).toBe(true)
  })
})

describe('creating a segment', () => {
  it('refuses an empty condition list', () => {
    expect(() => Segment.create({ name: 'Everyone', conditions: [] }, 0)).toThrow(ValidationError)
  })

  it('refuses a name too short to read', () => {
    expect(() => Segment.create({ name: 'x', conditions: [{ field: 'country', operator: 'eq', value: 'CM' }] }, 0)).toThrow(
      ValidationError,
    )
  })

  it('trims the name and keeps the conditions in the order they were written', () => {
    const segment = Segment.create(
      {
        name: '  Recent spenders  ',
        conditions: [
          { field: 'country', operator: 'eq', value: 'Cameroon' },
          { field: 'totalAmountSpent', operator: 'gt', value: 100_000 },
        ],
      },
      42,
      'segment-1',
    )

    expect(segment.name).toBe('Recent spenders')
    expect(segment.conditions.map((c) => c.field)).toEqual(['country', 'totalAmountSpent'])
    expect(segment.matchCount).toBe(42)
  })
})