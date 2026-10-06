/**
 * Channel insights for the campaign preview.
 *
 * Every check is derived from data the API actually returned (message, title,
 * call to action, objective). Nothing here invents a score: each insight reports
 * a measurable fact about the copy and how the chosen channel will treat it.
 */

import type { CampaignChannel, GeneratedCampaign } from '../types/campaign.types'

export type InsightSeverity = 'pass' | 'warn' | 'fail'

export interface Insight {
  id: string
  severity: InsightSeverity
  /** Interpolation values for the translated label. */
  values?: Record<string, string | number>
}

interface Limit {
  /** Staying inside the target keeps the copy to one billed unit. */
  target: number
  /** Past this the provider truncates, splits, or drops the message. */
  max: number
}

/**
 * Limits per channel. SMS figures follow GSM-7 segmentation (160 for one part,
 * 153 per part thereafter, four parts commonly allowed). Push figures are the
 * common truncation points on iOS and Android lock screens.
 */
export const CHANNEL_LIMITS: Record<CampaignChannel, { body: Limit; subject?: Limit }> = {
  sms: { body: { target: 160, max: 612 } },
  email: { body: { target: 600, max: 5_000 }, subject: { target: 60, max: 90 } },
  push: { body: { target: 120, max: 240 } },
}

/** Words that make an email more likely to land in a spam folder. */
const SPAM_TRIGGERS = [
  'free',
  'winner',
  'cash',
  'urgent',
  'act now',
  'click here',
  'limited time',
  'guarantee',
  'risk free',
  'no cost',
]

/** Dropped when comparing the objective with the copy, so overlap means something. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on',
  'or', 'our', 'that', 'the', 'this', 'to', 'with', 'campaign', 'customers', 'customer',
])

/** Cut to `max` characters, adding an ellipsis only when something was removed. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Number of SMS parts the carrier would bill for this copy. */
export function smsParts(length: number): number {
  if (length <= 160) return 1
  return Math.ceil(length / 153)
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
}

/** Severity for a body that fits the channel. */
function lengthInsight(channel: CampaignChannel, length: number): Insight {
  const { target, max } = CHANNEL_LIMITS[channel].body

  if (length > max) {
    return { id: 'length', severity: 'fail', values: { length, max } }
  }
  if (length > target) {
    return {
      id: 'length',
      severity: 'warn',
      values: { length, target, parts: channel === 'sms' ? smsParts(length) : 0 },
    }
  }
  return { id: 'length', severity: 'pass', values: { length, target } }
}

/** The call to action only ships on channels that render a button. */
function ctaInsight(campaign: GeneratedCampaign, channel: CampaignChannel): Insight {
  const cta = campaign.callToAction.trim()
  if (cta.length === 0) return { id: 'cta', severity: 'fail' }

  if (channel === 'email') return { id: 'cta', severity: 'pass' }

  // SMS and push carry the message alone, so a CTA that is not in the body text
  // is invisible to the recipient.
  const body = campaign.message.toLowerCase()
  return cta.length > 0 && body.includes(cta.toLowerCase()) ? { id: 'cta', severity: 'pass' } : { id: 'ctaDetached', severity: 'warn' }
}

function subjectInsight(campaign: GeneratedCampaign): Insight | null {
  const subject = CHANNEL_LIMITS.email.subject
  if (subject === undefined) return null

  const length = campaign.title.trim().length
  if (length > subject.max) return { id: 'subject', severity: 'fail', values: { length, max: subject.max } }
  if (length > subject.target) return { id: 'subject', severity: 'warn', values: { length, target: subject.target } }
  return { id: 'subject', severity: 'pass', values: { length, target: subject.target } }
}

function spamInsight(campaign: GeneratedCampaign): Insight | null {
  if (campaign.channel !== 'email') return null

  const body = campaign.message.toLowerCase()
  const hits = SPAM_TRIGGERS.filter((trigger) => body.includes(trigger))
  return hits.length === 0 ? { id: 'spam', severity: 'pass' } : { id: 'spam', severity: 'warn', values: { terms: hits.join(', ') } }
}

function linkInsight(campaign: GeneratedCampaign): Insight | null {
  if (campaign.channel !== 'sms') return null
  return /\bhttps?:\/\//i.test(campaign.message) ? { id: 'link', severity: 'warn' } : { id: 'link', severity: 'pass' }
}

function readabilityInsight(campaign: GeneratedCampaign): Insight {
  const words = campaign.message.trim().split(/\s+/).filter(Boolean)
  const sentences = campaign.message.split(/[.!?]+/).filter((part) => part.trim().length > 0)
  const average = sentences.length === 0 ? words.length : words.length / sentences.length

  return average > 22 ? { id: 'readability', severity: 'warn', values: { average: Math.round(average) } } : { id: 'readability', severity: 'pass', values: { average: Math.round(average) } }
}

function emojiInsight(campaign: GeneratedCampaign): Insight {
  const emojis = campaign.message.match(/\p{Extended_Pictographic}/gu)?.length ?? 0
  if (emojis > 3) return { id: 'emoji', severity: 'warn', values: { count: emojis } }
  return { id: 'emoji', severity: 'pass', values: { count: emojis } }
}

/** A soft signal: does the copy actually speak to the objective that was asked for? */
function objectiveInsight(campaign: GeneratedCampaign): Insight {
  const wanted = new Set(significantWords(campaign.objective))
  if (wanted.size === 0) return { id: 'objective', severity: 'pass' }

  const produced = new Set(significantWords(`${campaign.message} ${campaign.callToAction}`))
  const shared = [...wanted].filter((word) => produced.has(word))
  return shared.length === 0 ? { id: 'objective', severity: 'warn' } : { id: 'objective', severity: 'pass', values: { terms: shared.slice(0, 3).join(', ') } }
}

/** Every check for one campaign on one channel. */
export function analyseCampaign(campaign: GeneratedCampaign, channel: CampaignChannel): Insight[] {
  const insights: (Insight | null)[] = [
    lengthInsight(channel, campaign.message.trim().length),
    ctaInsight(campaign, channel),
    channel === 'email' ? subjectInsight(campaign) : null,
    spamInsight(campaign),
    linkInsight(campaign),
    readabilityInsight(campaign),
    emojiInsight(campaign),
    objectiveInsight(campaign),
  ]

  return insights.filter((insight): insight is Insight => insight !== null)
}

/** Counts that appear as the score in the preview header. */
export function summarise(insights: Insight[]): { passed: number; warnings: number; failures: number } {
  return {
    passed: insights.filter((insight) => insight.severity === 'pass').length,
    warnings: insights.filter((insight) => insight.severity === 'warn').length,
    failures: insights.filter((insight) => insight.severity === 'fail').length,
  }
}