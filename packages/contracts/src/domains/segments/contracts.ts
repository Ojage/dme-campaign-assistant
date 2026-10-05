import * as z from 'zod/v4'
import { idSchema, isoDateTimeSchema } from '../shared.js'

export const segmentFieldSchema = z.enum([
  'totalAmountSpent',
  'totalTransactions',
  'lastActivityDays',
  'country',
])
export type SegmentField = z.infer<typeof segmentFieldSchema>

export const segmentOperatorSchema = z.enum(['gt', 'lt', 'eq'])
export type SegmentOperator = z.infer<typeof segmentOperatorSchema>

/**
 * `country` compares strings, the other fields compare numbers. The schema is a
 * discriminated union so an invalid pairing cannot be constructed.
 */
const numericFieldSchema = z.enum(['totalAmountSpent', 'totalTransactions', 'lastActivityDays'])

const numericConditionSchema = z.object({
  field: numericFieldSchema,
  operator: segmentOperatorSchema,
  value: z.number().finite(),
})

const countryConditionSchema = z.object({
  field: z.literal('country'),
  operator: segmentOperatorSchema,
  value: z.string().min(1),
})

export const createSegmentConditionSchema = z.discriminatedUnion('field', [
  numericConditionSchema,
  countryConditionSchema,
])
export type CreateSegmentCondition = z.infer<typeof createSegmentConditionSchema>

export const segmentConditionSchema = z.discriminatedUnion('field', [
  numericConditionSchema.extend({ id: idSchema }),
  countryConditionSchema.extend({ id: idSchema }),
])
export type SegmentCondition = z.infer<typeof segmentConditionSchema>

export const segmentSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  conditions: z.array(segmentConditionSchema).min(1),
  matchCount: z.number().int().min(0),
  createdAt: isoDateTimeSchema,
})
export type Segment = z.infer<typeof segmentSchema>

export const createSegmentRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  conditions: z.array(createSegmentConditionSchema).min(1).max(10),
})
export type CreateSegmentRequest = z.infer<typeof createSegmentRequestSchema>

export const segmentPreviewRequestSchema = z.object({
  conditions: z.array(createSegmentConditionSchema).min(1).max(10),
})
export type SegmentPreviewRequest = z.infer<typeof segmentPreviewRequestSchema>

export const segmentPreviewResponseSchema = z.object({
  matchCount: z.number().int().min(0),
})
export type SegmentPreviewResponse = z.infer<typeof segmentPreviewResponseSchema>