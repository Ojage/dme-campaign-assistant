import * as z from 'zod/v4'
import { ConflictError, ModelProviderError, ValidationError } from '../../../shared/domain/domain.errors'

export const CAMPAIGN_CHANNELS = ['sms', 'email', 'push'] as const
export const CAMPAIGN_TONES = ['professional', 'friendly', 'urgent', 'promotional'] as const
export const CAMPAIGN_STATUSES = ['draft', 'ready', 'sent'] as const

export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number]
export type CampaignTone = (typeof CAMPAIGN_TONES)[number]
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]
export type CampaignLanguage = 'en' | 'fr'

/** Hard caps per channel. Enforced here so the model can never overshoot SMS. */
const LIMITS: Readonly<Record<CampaignChannel, { readonly message: number; readonly cta: number; readonly title: number }>> =
  {
    sms: { message: 320, cta: 40, title: 60 },
    push: { message: 140, cta: 40, title: 60 },
    email: { message: 1200, cta: 60, title: 120 },
  }

export const isCampaignChannel = (value: string): value is CampaignChannel =>
  (CAMPAIGN_CHANNELS as readonly string[]).includes(value)

export const isCampaignTone = (value: string): value is CampaignTone =>
  (CAMPAIGN_TONES as readonly string[]).includes(value)

export const isCampaignStatus = (value: string): value is CampaignStatus =>
  (CAMPAIGN_STATUSES as readonly string[]).includes(value)

/**
 * The shape the model is asked to fill. Kept beside the entity so the schema and
 * the validation of its output live together.
 */
export const campaignDraftSchema = z.object({
  title: z.string(),
  message: z.string(),
  callToAction: z.string(),
})
export type CampaignDraft = z.infer<typeof campaignDraftSchema>

/** Everything a campaign needs besides the generated copy. */
export interface CampaignContext {
  readonly segmentId: string
  readonly segmentName: string
  readonly channel: CampaignChannel
  readonly tone: CampaignTone
  readonly objective: string
}

export class Campaign {
  private constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly message: string,
    public readonly callToAction: string,
    public readonly segmentId: string,
    public readonly segmentName: string,
    public readonly channel: CampaignChannel,
    public readonly tone: CampaignTone,
    public status: CampaignStatus,
    public readonly objective: string,
    public readonly generatedAt: Date,
  ) {}

  public static reconstitute(input: {
    id: string
    title: string
    message: string
    callToAction: string
    segmentId: string
    segmentName: string
    channel: CampaignChannel
    tone: CampaignTone
    status: CampaignStatus
    objective: string
    generatedAt: Date
  }): Campaign {
    return new Campaign(
      input.id,
      input.title,
      input.message,
      input.callToAction,
      input.segmentId,
      input.segmentName,
      input.channel,
      input.tone,
      input.status,
      input.objective,
      input.generatedAt,
    )
  }

  /**
   * A generated campaign starts as `draft`. Nothing reaches a customer until a
   * human explicitly marks it `ready`, then `sent`.
   */
  public static fromDraft(draft: CampaignDraft, context: CampaignContext): Campaign {
    const limit = LIMITS[context.channel]
    const title = clamp(draft.title.trim(), limit.title)
    const message = clamp(draft.message.trim(), limit.message)
    const callToAction = clamp(draft.callToAction.trim(), limit.cta)

    if (title.length === 0 || message.length === 0 || callToAction.length === 0) {
      throw new ModelProviderError(
        'The assistant could not produce usable campaign copy. Please try again with a more specific objective.',
        'llm_error',
      )
    }

    return new Campaign(
      '',
      title,
      message,
      callToAction,
      context.segmentId,
      context.segmentName,
      context.channel,
      context.tone,
      'draft',
      context.objective.trim(),
      new Date(),
    )
  }

  /** Legal moves only: draft → ready → sent, and sent is final. */
  public changeStatus(next: CampaignStatus): void {
    if (this.status === next) return

    const allowed: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
      draft: ['ready'],
      ready: ['draft', 'sent'],
      sent: [],
    }

    if (!allowed[this.status].includes(next)) {
      const permitted = allowed[this.status]
      throw new ConflictError(`A ${this.status} campaign cannot become ${next}.`, {
        status: [`Allowed transitions from ${this.status}: ${permitted.join(', ') || 'none'}.`],
      })
    }

    this.status = next
  }
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value
  // Cut on a word boundary so a truncated SMS still reads as a sentence.
  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
}

export function assertChannel(value: string): CampaignChannel {
  if (isCampaignChannel(value)) return value
  throw new ValidationError('Unsupported channel.', { channel: ['Use sms, email or push.'] })
}