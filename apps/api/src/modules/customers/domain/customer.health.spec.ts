import { computeCustomerHealth, type CustomerHealthInput } from './customer.entity'

/**
 * The composite health score is the only number the dashboard trusts to summarise
 * the customer base, so the weights and their behaviour on pure bases are pinned
 * here. Anything that changes the score/level of these samples changes what the
 * UI tells the owner about their base — deliberately.
 */

function sample(overrides: Partial<CustomerHealthInput>): CustomerHealthInput {
  return { total: 100, active: 100, inactive: 0, churned: 0, staleActives: 0, ...overrides }
}

describe('computeCustomerHealth', () => {
  it('reports an empty base as critical with no signal', () => {
    expect(computeCustomerHealth(sample({ total: 0, active: 0 }))).toEqual({
      score: 0,
      level: 'critical',
      activeShare: 0,
      churnedShare: 0,
      inactiveCount: 0,
      staleActives: 0,
    })
  })

  it('scores a fully active and recent base a perfect 100', () => {
    const report = computeCustomerHealth(sample({}))
    expect(report.score).toBe(100)
    expect(report.level).toBe('healthy')
    expect(report.activeShare).toBe(100)
    expect(report.churnedShare).toBe(0)
  })

  it('treats an entirely inactive base as attention', () => {
    const report = computeCustomerHealth(sample({ active: 0, inactive: 100 }))
    expect(report.score).toBe(50)
    expect(report.level).toBe('attention')
  })

  it('treats a base that is active but dormant as critical', () => {
    const report = computeCustomerHealth(sample({ active: 100, staleActives: 100 }))
    expect(report.score).toBe(30)
    expect(report.level).toBe('critical')
  })

  it('treats an entirely churned base as critical', () => {
    const report = computeCustomerHealth(sample({ active: 0, churned: 100 }))
    expect(report.score).toBe(20)
    expect(report.level).toBe('critical')
  })

  it('reports the churned share', () => {
    const report = computeCustomerHealth(sample({ active: 60, churned: 25, inactive: 15 }))
    expect(report.churnedShare).toBe(25)
    expect(report.activeShare).toBe(60)
  })

  it('blends realistic attrition into the middle band', () => {
    // Roughly the seeded shape: 60% active, 20% inactive, 20% churned,
    // two thirds of the actives gone quiet (dormant).
    const report = computeCustomerHealth(sample({ active: 60, inactive: 20, churned: 20, staleActives: 40 }))
    expect(report.level).toBe('attention')
    expect(report.score).toBeGreaterThanOrEqual(40)
    expect(report.score).toBeLessThan(60)
  })

  it('clamps the score to the 0-100 band', () => {
    expect(computeCustomerHealth(sample({ active: 0, churned: 100, inactive: 0, staleActives: 100 })).score).toBe(0)
    expect(computeCustomerHealth(sample({})).score).toBe(100)
  })

  it('rounds shares to one decimal place', () => {
    const report = computeCustomerHealth(sample({ active: 33, inactive: 67 }))
    expect(report.activeShare).toBe(33)
    // Inactive share is only reported in the score, not as a share field.
    expect(report.inactiveCount).toBe(67)
  })
})