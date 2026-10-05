import * as z from 'zod/v4'
import { amountSchema, idSchema, isoDateTimeSchema, limitSchema, pageSchema } from '../shared.js'

export const customerStatusSchema = z.enum(['active', 'inactive', 'churned'])
export type CustomerStatus = z.infer<typeof customerStatusSchema>

export const customerSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  email: z.string().email(),
  country: z.string().min(2),
  totalTransactions: z.number().int().min(0),
  totalAmountSpent: amountSchema,
  lastActivityDate: isoDateTimeSchema,
  status: customerStatusSchema,
})
export type Customer = z.infer<typeof customerSchema>

/**
 * `all` is a filter value, not a status, so it is modelled separately from the
 * customer status enum.
 */
export const customerStatusFilterSchema = customerStatusSchema.or(z.literal('all'))
export type CustomerStatusFilter = z.infer<typeof customerStatusFilterSchema>

export const customerSortFieldSchema = z.enum(['name', 'totalAmountSpent', 'totalTransactions', 'lastActivityDate'])
export type CustomerSortField = z.infer<typeof customerSortFieldSchema>

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().default(''),
  status: customerStatusFilterSchema.default('all'),
  country: z.string().trim().default(''),
  sort: customerSortFieldSchema.default('lastActivityDate'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: pageSchema.default(1),
  limit: limitSchema.default(50),
})
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>

/**
 * A page of customers. The total is part of the response, not computed from the
 * page size, so the client can render the pager without loading everything.
 */
export const customerPageSchema = z.object({
  items: z.array(customerSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})
export type CustomerPage = z.infer<typeof customerPageSchema>

export const newCustomerSchema = customerSchema.omit({ id: true })
export type NewCustomer = z.infer<typeof newCustomerSchema>

/** Bulk CSV import — every row is validated independently so one bad row is not fatal. */
export const importCustomersRequestSchema = z.object({
  customers: z.array(newCustomerSchema).min(1).max(1000),
})
export type ImportCustomersRequest = z.infer<typeof importCustomersRequestSchema>

export const customerImportFailureSchema = z.object({
  row: z.number().int().min(1),
  reason: z.string().min(1),
})
export type CustomerImportFailure = z.infer<typeof customerImportFailureSchema>

export const importCustomersResponseSchema = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  failures: z.array(customerImportFailureSchema),
})
export type ImportCustomersResponse = z.infer<typeof importCustomersResponseSchema>

export const customerKpisSchema = z.object({
  totalCustomers: z.number().int().min(0),
  activeCustomers: z.number().int().min(0),
  totalTransactionValue: amountSchema,
  averageCustomerValue: amountSchema,
})
export type CustomerKpis = z.infer<typeof customerKpisSchema>

export const countrySpendSchema = z.object({
  country: z.string().min(2),
  spend: amountSchema,
})
export type CountrySpend = z.infer<typeof countrySpendSchema>