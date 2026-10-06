import { NotFoundError } from '../../../../shared/domain/domain.errors'
import { Campaign, campaignDraftSchema, CAMPAIGN_LIMITS } from '../../domain/campaign.entity'
import type { CampaignChannel, CampaignLanguage, CampaignStatus, CampaignTone } from '../../domain/campaign.entity'
import type { CampaignRepository, SegmentResolver } from '../ports/campaign.ports'
import { CAMPAIGN_PORTS } from '../ports/campaign.ports'
import { STRUCTURED_MODEL } from '../../../../shared/application/ports/structured-model.port'
import type { StructuredModel } from '../../../../shared/application/ports/structured-model.port'
import { Inject, Injectable } from '@nestjs/common'

export interface GenerateCampaignInput {
  readonly objective: string
  readonly channel: CampaignChannel
  readonly tone: CampaignTone
  readonly language: CampaignLanguage
  readonly includeDiscount: boolean
  readonly segmentId: string
}

@Injectable()
export class GenerateCampaign {
  public constructor(
    @Inject(STRUCTURED_MODEL) private readonly model: StructuredModel,
    @Inject(CAMPAIGN_PORTS.segmentResolver) private readonly segments: SegmentResolver,
    @Inject(CAMPAIGN_PORTS.repository) private readonly campaigns: CampaignRepository,
  ) {}

  public async execute(input: GenerateCampaignInput): Promise<Campaign> {
    const target = await this.#resolveTarget(input)
    const result = await this.model.generateStructured({
      system: systemPrompt(input),
      turns: [{ role: 'user', content: userPrompt(input, target) }],
      schema: campaignDraftSchema,
    })

    return this.campaigns.save(
      Campaign.fromDraft(result.data, {
        segmentId: target.id,
        segmentName: target.name,
        channel: input.channel,
        tone: input.tone,
        objective: input.objective,
      }),
    )
  }

  /** A campaign always points at a segment that already exists. */
  async #resolveTarget(input: GenerateCampaignInput): Promise<{ id: string; name: string }> {
    const name = await this.segments.resolveName(input.segmentId)
    if (name === null) throw new NotFoundError('That segment no longer exists.')
    return { id: input.segmentId, name }
  }
}

@Injectable()
export class ListCampaigns {
  public constructor(@Inject(CAMPAIGN_PORTS.repository) private readonly campaigns: CampaignRepository) {}

  public execute(): Promise<Campaign[]> {
    return this.campaigns.list()
  }
}

@Injectable()
export class UpdateCampaignStatus {
  public constructor(@Inject(CAMPAIGN_PORTS.repository) private readonly campaigns: CampaignRepository) {}

  public async execute(id: string, status: CampaignStatus): Promise<Campaign> {
    const updated = await this.campaigns.updateStatus(id, status)
    if (updated === null) throw new NotFoundError('That campaign no longer exists.')
    return updated
  }
}

@Injectable()
export class DeleteCampaign {
  public constructor(@Inject(CAMPAIGN_PORTS.repository) private readonly campaigns: CampaignRepository) {}

  public async execute(id: string): Promise<void> {
    const deleted = await this.campaigns.delete(id)
    if (!deleted) throw new NotFoundError('That campaign no longer exists.')
  }
}

/*
 * Prompt design lives here, in the application layer: the domain decides what a
 * valid campaign is, the adapters decide which model runs it.
 */

/** Channels whose recipient sees only the body copy. */
const TEXT_ONLY: ReadonlySet<CampaignChannel> = new Set<CampaignChannel>(['sms', 'push'])

/**
 * The character budgets are read from the entity rather than repeated here, so the
 * number the model is given is the number the domain enforces.
 */
function channelGuidance(channel: CampaignChannel): string {
  const limits = CAMPAIGN_LIMITS[channel]
  const shape =
    channel === 'email'
      ? 'Structure it as an opening line, one benefit, then the call to action.'
      : 'Write for a small screen.'

  return `${channel.toUpperCase()}. Hard limit ${limits.message} characters for the body. ${shape}`
}

function systemPrompt(input: GenerateCampaignInput): string {
  return [
    'You are a senior lifecycle marketer at DME, a software company that offers digital marketing services to its clients — banks, sports, betting and other businesses. DME is not itself a bank and does not sell financial products.',
    `Write one ${input.channel.toUpperCase()} campaign in a ${input.tone} tone.`,
    channelGuidance(input.channel),
    input.language === 'fr'
      ? 'Write the copy in natural French (Français). No English words.'
      : 'Write the copy in natural English. No French words.',
    input.includeDiscount
      ? 'A discount is available. Mention it concretely with a percentage or amount.'
      : 'No discount is running. Do not invent one.',
    'Return only: a short internal title, the body copy, and a call to action of at most 6 words.',
    // Without this the model treats the call to action as a separate field, and on
    // a channel that only delivers the body the recipient never sees it.
    TEXT_ONLY.has(input.channel)
      ? `The message is the only thing this channel delivers. End the message with the call to action as its own final sentence, and repeat the same words in the call to action field.`
      : 'The call to action is rendered separately as a button, so it need not be repeated inside the message.',
    'Never invent customer names, figures, fees or any other detail the marketer did not provide.',
  ].join('\n')
}

function userPrompt(input: GenerateCampaignInput, target: { id: string; name: string }): string {
  return [
    `Segment: ${target.name}`,
    // Stated here as well as in the system prompt so the task block stands on its
    // own for a model that only reads the final turn.
    `Channel: ${input.channel}`,
    `Tone: ${input.tone}`,
    `Objective: ${input.objective}`,
    `Produce the title, message and call to action.`,
  ].join('\n')
}
