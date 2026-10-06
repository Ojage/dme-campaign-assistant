import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository, type SelectQueryBuilder, LessThan } from 'typeorm'
import type { CustomerRepository } from '../application/ports/customer.ports'
import {
  isCustomerStatus,
  Customer,
  STALE_ACTIVITY_DAYS,
  type ActivityTrendPoint,
  type CountrySpend,
  type CustomerHealthInput,
  type CustomerKpis,
  type CustomerSortField,
  type CustomerStatus,
  type ListCustomersQuery,
  type TopCustomer,
} from '../domain/customer.entity'
import { CustomerOrmEntity } from '../../../shared/infrastructure/persistence/customer.orm-entity'

function toDomain(row: CustomerOrmEntity): Customer {
  return Customer.reconstitute({
    id: row.id,
    name: row.name,
    email: row.email,
    country: row.country,
    totalTransactions: row.totalTransactions,
    totalAmountSpent: Number(row.totalAmountSpent),
    lastActivityDate: row.lastActivityDate,
    status: isCustomerStatus(row.status) ? row.status : 'active',
  })
}

function toOrm(customer: Customer): CustomerOrmEntity {
  const row = new CustomerOrmEntity()
  row.name = customer.name
  row.email = customer.email
  row.country = customer.country
  row.totalTransactions = customer.totalTransactions
  row.totalAmountSpent = customer.totalAmountSpent.toFixed(2)
  row.lastActivityDate = customer.lastActivityDate
  row.status = customer.status
  return row
}

/** Maps a validated sort field onto the column it orders. */
const SORT_COLUMNS: Readonly<Record<CustomerSortField, string>> = {
  name: 'name',
  totalAmountSpent: 'totalAmountSpent',
  totalTransactions: 'totalTransactions',
  lastActivityDate: 'lastActivityDate',
}

/** TypeORM adapter for customers. Sorting uses a whitelist, never raw input. */
@Injectable()
export class TypeOrmCustomerRepository implements CustomerRepository {
  public constructor(
    @InjectRepository(CustomerOrmEntity) private readonly repository: Repository<CustomerOrmEntity>,
  ) {}

  public async list(query: ListCustomersQuery): Promise<{ items: Customer[]; total: number }> {
    const builder = this.#filtered(query)
    // `getManyAndCount` runs the row query and the count query consistently, which
    // a hand-written skip/take pair does not guarantee.
    const [rows, total] = await builder
      .orderBy(`customer.${SORT_COLUMNS[query.sort]}`, query.direction.toUpperCase() as 'ASC' | 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount()

    return { items: rows.map(toDomain), total }
  }

  public async findByEmail(email: string): Promise<Customer | null> {
    const row = await this.repository.findOne({ where: { email: email.trim().toLowerCase() } })
    return row === null ? null : toDomain(row)
  }

  public async create(customer: Customer): Promise<Customer> {
    return toDomain(await this.repository.save(toOrm(customer)))
  }

  public async createMany(customers: Customer[]): Promise<{ stored: Customer[]; duplicates: string[] }> {
    const emails = customers.map((customer) => customer.email)
    const existing = await this.repository.find({ where: { email: In(emails) } })
    const existingEmails = new Set(existing.map((row) => row.email))

    const fresh = customers.filter((customer) => !existingEmails.has(customer.email))
    // Deduplicate within the same payload, keeping the first occurrence.
    const seen = new Set<string>()
    const unique = fresh.filter((customer) => {
      if (seen.has(customer.email)) return false
      seen.add(customer.email)
      return true
    })

    const inserted = await this.repository.save(unique.map(toOrm))
    const duplicates = customers
      .filter((customer) => !unique.some((candidate) => candidate.email === customer.email))
      .map((customer) => customer.email)

    return { stored: inserted.map(toDomain), duplicates }
  }

  public async kpis(): Promise<CustomerKpis> {
    const [total, active, aggregate, byStatus] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { status: 'active' } }),
      this.repository
        .createQueryBuilder('customer')
        .select('COALESCE(SUM(customer.totalAmountSpent), 0)', 'spend')
        .getRawOne<{ spend: string }>(),
      this.repository
        .createQueryBuilder('customer')
        .select('customer.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('customer.status')
        .getRawMany<{ status: string; count: string }>(),
    ])

    const counts = { active: 0, inactive: 0, churned: 0 }
    for (const row of byStatus) {
      if (isCustomerStatus(row.status)) counts[row.status] = Number(row.count)
    }

    const totalValue = Number(aggregate?.spend ?? 0)
    return {
      totalCustomers: total,
      activeCustomers: active,
      totalTransactionValue: totalValue,
      averageCustomerValue: total === 0 ? 0 : Math.round((totalValue / total) * 100) / 100,
      statusCounts: counts,
    }
  }

  public async activityTrend(months: number): Promise<ActivityTrendPoint[]> {
    // Bucketing by month of `lastActivityDate` defines the trailing window; the
    // literal interval keeps the window closed, so a 12-month trend is genuinely
    // the last twelve calendar months.
    const rows = await this.repository
      .createQueryBuilder('customer')
      .select("to_char(customer.lastActivityDate, 'YYYY-MM')", 'month')
      .addSelect('COALESCE(SUM(customer.totalAmountSpent), 0)', 'value')
      .addSelect('COUNT(*)', 'customers')
      .addSelect("COUNT(*) FILTER (WHERE customer.status = 'churned')", 'churned')
      .where("customer.lastActivityDate >= (now() - make_interval(months => :months))", { months })
      .groupBy("to_char(customer.lastActivityDate, 'YYYY-MM')")
      .orderBy("to_char(customer.lastActivityDate, 'YYYY-MM')", 'ASC')
      .getRawMany<{ month: string; value: string; customers: string; churned: string }>()

    return rows.map((row) => ({
      month: row.month,
      value: Number(row.value),
      customers: Number(row.customers),
      churned: Number(row.churned),
    }))
  }

  public async healthCounts(): Promise<CustomerHealthInput> {
    const [total, active, inactive, churned, staleActives] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { status: 'active' } }),
      this.repository.count({ where: { status: 'inactive' } }),
      this.repository.count({ where: { status: 'churned' } }),
      this.repository.count({
        where: {
          status: 'active',
          lastActivityDate: LessThan(new Date(Date.now() - STALE_ACTIVITY_DAYS * 86_400_000)),
        },
      }),
    ])

    return { total, active, inactive, churned, staleActives }
  }

  public async top(limit: number): Promise<{ items: TopCustomer[]; totalValue: number }> {
    const [rows, aggregate] = await Promise.all([
      this.repository
        .createQueryBuilder('customer')
        .orderBy('customer.totalAmountSpent', 'DESC')
        .addOrderBy('customer.lastActivityDate', 'DESC')
        .take(limit)
        .getMany(),
      this.repository
        .createQueryBuilder('customer')
        .select('COALESCE(SUM(customer.totalAmountSpent), 0)', 'spend')
        .getRawOne<{ spend: string }>(),
    ])

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        country: row.country,
        status: isCustomerStatus(row.status) ? row.status : 'active',
        totalAmountSpent: Number(row.totalAmountSpent),
        totalTransactions: row.totalTransactions,
      })),
      totalValue: Number(aggregate?.spend ?? 0),
    }
  }

  public async countries(): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('customer')
      .select('DISTINCT customer.country', 'country')
      .orderBy('customer.country', 'ASC')
      .getRawMany<{ country: string }>()
    return rows.map((row) => row.country)
  }

  public async spendByCountry(): Promise<CountrySpend[]> {
    const rows = await this.repository
      .createQueryBuilder('customer')
      .select('customer.country', 'country')
      .addSelect('SUM(customer.totalAmountSpent)', 'spend')
      .groupBy('customer.country')
      .orderBy('spend', 'DESC')
      .getRawMany<{ country: string; spend: string }>()

    return rows.map((row) => ({ country: row.country, spend: Number(row.spend) }))
  }

  public async countByStatus(status: CustomerStatus): Promise<number> {
    return this.repository.count({ where: { status } })
  }

  /**
   * Applies the search/status/country filters. Search matches name *or* email,
   * which a flat `where` object cannot express because TypeORM ANDs its keys.
   */
  #filtered(query: ListCustomersQuery): SelectQueryBuilder<CustomerOrmEntity> {
    const builder = this.repository.createQueryBuilder('customer')

    if (query.search.length > 0) {
      builder.andWhere('(customer.name ILIKE :search OR customer.email ILIKE :search)', {
        search: `%${query.search}%`,
      })
    }
    if (query.status !== 'all') {
      builder.andWhere('customer.status = :status', { status: query.status })
    }
    if (query.country.length > 0) {
      builder.andWhere('customer.country = :country', { country: query.country })
    }

    return builder
  }
}