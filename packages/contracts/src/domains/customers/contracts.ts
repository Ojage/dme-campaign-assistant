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
  statusCounts: z.object({
    active: z.number().int().min(0),
    inactive: z.number().int().min(0),
    churned: z.number().int().min(0),
  }),
})
export type CustomerKpis = z.infer<typeof customerKpisSchema>

/**
 * One month of customer activity, bucketed by the month of `lastActivityDate`.
 * `value` is the lifetime spend of the customers whose last activity falls in
 * that month — a proxy for the value they carried, since the API stores no
 * per-transaction history. `churned` counts the churned customers among them,
 * which is what makes the shape readable as a churn curve.
 */
export const activityTrendPointSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  value: amountSchema,
  customers: z.number().int().min(0),
  churned: z.number().int().min(0),
})
export type ActivityTrendPoint = z.infer<typeof activityTrendPointSchema>

export const activityTrendQuerySchema = z.object({
  months: z.coerce.number().int().min(3).max(24).default(6),
})
export type ActivityTrendQuery = z.infer<typeof activityTrendQuerySchema>

/**
 * Composite health of the customer base. `staleActives` counts customers whose
 * status is still `active` but whose last activity is older than 60 days —
 * accounts heading for churn before the status catches up. The score and level
 * are derived server-side so every renderer agrees on what "healthy" means.
 */
export const customerHealthLevelSchema = z.enum(['healthy', 'attention', 'critical'])
export type CustomerHealthLevel = z.infer<typeof customerHealthLevelSchema>

export const customerHealthSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: customerHealthLevelSchema,
  activeShare: z.number().min(0).max(100),
  churnedShare: z.number().min(0).max(100),
  inactiveCount: z.number().int().min(0),
  staleActives: z.number().int().min(0),
})
export type CustomerHealth = z.infer<typeof customerHealthSchema>

export const topCustomerSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  country: z.string().min(2),
  status: customerStatusSchema,
  totalAmountSpent: amountSchema,
  totalTransactions: z.number().int().min(0),
})
export type TopCustomer = z.infer<typeof topCustomerSchema>

export const customerTopListSchema = z.object({
  /** Total lifetime value of the whole base, so the client can render shares. */
  totalValue: amountSchema,
  items: z.array(topCustomerSchema),
})
export type CustomerTopList = z.infer<typeof customerTopListSchema>

export const topCustomersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(5),
})
export type TopCustomersQuery = z.infer<typeof topCustomersQuerySchema>

export const countrySpendSchema = z.object({
  country: z.string().min(2),
  spend: amountSchema,
})
export type CountrySpend = z.infer<typeof countrySpendSchema>