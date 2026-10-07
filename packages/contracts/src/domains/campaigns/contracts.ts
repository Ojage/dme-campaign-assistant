import * as z from 'zod/v4'
import { idSchema, isoDateTimeSchema, limitSchema, pageSchema } from '../shared.js'

export const campaignChannelSchema = z.enum(['sms', 'email', 'push'])
export type CampaignChannel = z.infer<typeof campaignChannelSchema>

export const campaignToneSchema = z.enum(['professional', 'friendly', 'urgent', 'promotional'])
export type CampaignTone = z.infer<typeof campaignToneSchema>

export const campaignStatusSchema = z.enum(['draft', 'ready', 'sent'])
export type CampaignStatus = z.infer<typeof campaignStatusSchema>

export const campaignSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  callToAction: z.string().min(1),
  segmentId: idSchema,
  segmentName: z.string().min(1),
  channel: campaignChannelSchema,
  tone: campaignToneSchema,
  status: campaignStatusSchema,
  objective: z.string().min(1),
  generatedAt: isoDateTimeSchema,
})
export type Campaign = z.infer<typeof campaignSchema>

export const generateCampaignRequestSchema = z.object({
  objective: z.string().trim().min(10).max(600),
  segmentId: idSchema,
  channel: campaignChannelSchema,
  tone: campaignToneSchema,
  /** Optional guardrails layered on top of the workspace defaults. */
  language: z.enum(['en', 'fr']).default('en'),
  includeDiscount: z.boolean().default(false),
})
export type GenerateCampaignRequest = z.infer<typeof generateCampaignRequestSchema>

export const updateCampaignStatusRequestSchema = z.object({
  status: campaignStatusSchema,
})
export type UpdateCampaignStatusRequest = z.infer<typeof updateCampaignStatusRequestSchema>

export const listCampaignsQuerySchema = z.object({
  page: pageSchema.default(1),
  limit: limitSchema.default(50),
})
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>

/**
 * A page of campaigns, so the history list stays bounded however many generations
 * the workspace has produced.
 */
export const campaignPageSchema = z.object({
  items: z.array(campaignSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})
export type CampaignPage = z.infer<typeof campaignPageSchema>