import { Inject, Injectable } from '@nestjs/common'
import * as z from 'zod/v4'
import { newCustomerSchema } from '@dme/contracts'
import { CUSTOMER_PORTS } from '../ports/customer.ports'
import type { CustomerRepository } from '../ports/customer.ports'
import { Customer, computeCustomerHealth } from '../../domain/customer.entity'
import type {
  ActivityTrendPoint,
  CountrySpend,
  CustomerHealth,
  CustomerKpis,
  CustomerStatus,
  ListCustomersQuery,
  TopCustomer,
} from '../../domain/customer.entity'
import { ConflictError, ValidationError } from '../../../../shared/domain/domain.errors'

@Injectable()
export class ListCustomers {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public async execute(query: ListCustomersQuery): Promise<{ items: Customer[]; total: number }> {
    return this.customers.list(query)
  }
}

@Injectable()
export class GetCustomerKpis {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public execute(): Promise<CustomerKpis> {
    return this.customers.kpis()
  }
}

@Injectable()
export class GetActivityTrend {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public execute(months: number): Promise<ActivityTrendPoint[]> {
    return this.customers.activityTrend(months)
  }
}

/**
 * Fetches the raw counts, then folds them into the derived score. The report is
 * domain logic, so it stays in the pure `computeCustomerHealth` function rather
 * than leaking into the controller or the adapter.
 */
@Injectable()
export class GetCustomerHealth {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public async execute(): Promise<CustomerHealth> {
    return computeCustomerHealth(await this.customers.healthCounts())
  }
}

@Injectable()
export class GetTopCustomers {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public execute(limit: number): Promise<{ items: TopCustomer[]; totalValue: number }> {
    return this.customers.top(limit)
  }
}

@Injectable()
export class ListCountries {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public execute(): Promise<string[]> {
    return this.customers.countries()
  }
}

@Injectable()
export class GetSpendByCountry {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public execute(): Promise<CountrySpend[]> {
    return this.customers.spendByCountry()
  }
}

@Injectable()
export class CreateCustomer {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public async execute(input: z.input<typeof newCustomerSchema>): Promise<Customer> {
    const candidate = Customer.create({
      name: input.name,
      email: input.email,
      country: input.country,
      totalTransactions: input.totalTransactions,
      totalAmountSpent: input.totalAmountSpent,
      lastActivityDate: new Date(input.lastActivityDate),
      status: input.status as CustomerStatus,
    })

    if (await this.customers.findByEmail(candidate.email)) {
      throw new ConflictError('A customer with that email already exists.', )
    }
    return this.customers.create(candidate)
  }
}

/**
 * Bulk import. Rows are validated one at a time so a single malformed row is
 * reported instead of failing the whole file — which is what a CSV upload needs.
 */
/** Turns a validation failure into one human-readable reason for the import report. */
function describeFailure(error: unknown): string {
  if (!(error instanceof ValidationError)) return 'Invalid row.'
  const messages = Object.values(error.fieldErrors ?? {}).flat()
  return messages[0] ?? error.message
}

@Injectable()
export class ImportCustomers {
  public constructor(@Inject(CUSTOMER_PORTS.repository) private readonly customers: CustomerRepository) {}

  public async execute(inputs: readonly z.input<typeof newCustomerSchema>[]): Promise<{
    imported: number
    skipped: number
    failures: { row: number; reason: string }[]
  }> {
    const candidates: Customer[] = []
    const failures: { row: number; reason: string }[] = []

    inputs.forEach((input, index) => {
      try {
        candidates.push(
          Customer.create({
            name: input.name,
            email: input.email,
            country: input.country,
            totalTransactions: input.totalTransactions,
            totalAmountSpent: input.totalAmountSpent,
            lastActivityDate: new Date(input.lastActivityDate),
            status: input.status as CustomerStatus,
          }),
        )
      } catch (error) {
        failures.push({ row: index + 1, reason: describeFailure(error) })
      }
    })

    if (candidates.length === 0) {
      return { imported: 0, skipped: inputs.length, failures }
    }

    const stored = await this.customers.createMany(candidates)
    for (const email of stored.duplicates) {
      failures.push({ row: this.#rowOf(candidates, email), reason: `A customer with the email ${email} already exists.` })
    }

    return {
      imported: stored.stored.length,
      skipped: inputs.length - stored.stored.length,
      failures,
    }
  }

  #rowOf(candidates: readonly Customer[], email: string): number {
    const index = candidates.findIndex((candidate) => candidate.email === email)
    return index + 1
  }
}