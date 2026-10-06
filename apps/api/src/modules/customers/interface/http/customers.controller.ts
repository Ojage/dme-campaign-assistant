import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import * as z from 'zod/v4'
import {
  activityTrendQuerySchema,
  importCustomersRequestSchema,
  listCustomersQuerySchema,
  newCustomerSchema,
  topCustomersQuerySchema,
} from '@dme/contracts'
import { zodBody, zodQuery } from '../../../../shared/http/zod-validation.pipe'
import { isCustomerStatus, type ListCustomersQuery } from '../../domain/customer.entity'
import {
  CreateCustomer,
  GetActivityTrend,
  GetCustomerHealth,
  GetCustomerKpis,
  GetSpendByCountry,
  GetTopCustomers,
  ImportCustomers,
  ListCountries,
  ListCustomers,
} from '../../application/use-cases/customer.use-cases'
import type { Customer } from '../../domain/customer.entity'

/** Wire shape: money as a number, dates as ISO strings. */
function toCustomerResponse(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    country: customer.country,
    totalTransactions: customer.totalTransactions,
    totalAmountSpent: customer.totalAmountSpent,
    lastActivityDate: customer.lastActivityDate.toISOString(),
    status: customer.status,
  }
}

@Controller('customers')
export class CustomersController {
  public constructor(
    private readonly listCustomers: ListCustomers,
    private readonly createCustomer: CreateCustomer,
    private readonly importCustomers: ImportCustomers,
    private readonly getKpis: GetCustomerKpis,
    private readonly getActivityTrend: GetActivityTrend,
    private readonly getCustomerHealth: GetCustomerHealth,
    private readonly getTopCustomers: GetTopCustomers,
  ) {}

  @Get()
  public async list(@Query(zodQuery(listCustomersQuerySchema)) query: z.infer<typeof listCustomersQuerySchema>) {
    const command: ListCustomersQuery = {
      ...query,
      status: isCustomerStatus(query.status) ? query.status : 'all',
    }
    const page = await this.listCustomers.execute(command)
    return {
      items: page.items.map(toCustomerResponse),
      total: page.total,
      page: query.page,
      limit: query.limit,
    }
  }

  @Get('kpis')
  public async kpis() {
    return this.getKpis.execute()
  }

  @Get('trend')
  public async trend(@Query(zodQuery(activityTrendQuerySchema)) query: z.infer<typeof activityTrendQuerySchema>) {
    return this.getActivityTrend.execute(query.months)
  }

  @Get('health')
  public async health() {
    return this.getCustomerHealth.execute()
  }

  @Get('top')
  public async top(@Query(zodQuery(topCustomersQuerySchema)) query: z.infer<typeof topCustomersQuerySchema>) {
    return this.getTopCustomers.execute(query.limit)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Body(zodBody(newCustomerSchema)) body: z.infer<typeof newCustomerSchema>) {
    return toCustomerResponse(await this.createCustomer.execute(body))
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  public async import(@Body(zodBody(importCustomersRequestSchema)) body: z.infer<typeof importCustomersRequestSchema>) {
    return this.importCustomers.execute(body.customers)
  }
}

/** Split out because countries are customer reads with their own path. */
@Controller('countries')
export class CountriesController {
  public constructor(
    private readonly listCountries: ListCountries,
    private readonly getSpendByCountry: GetSpendByCountry,
  ) {}

  @Get()
  public list(): Promise<string[]> {
    return this.listCountries.execute()
  }

  @Get('spend')
  public spend() {
    return this.getSpendByCountry.execute()
  }
}