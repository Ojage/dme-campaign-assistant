import type { NewSegmentCondition } from '../../../segments/domain/segment.entity'
import { NotFoundError } from '../../../../shared/domain/domain.errors'
import { Campaign, campaignDraftSchema } from '../../domain/campaign.entity'
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
  readonly segmentId?: string
  readonly conditions?: readonly NewSegmentCondition[]
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

  /** Either an existing segment or a set of conditions saved as one. */
  async #resolveTarget(input: GenerateCampaignInput): Promise<{ id: string; name: string }> {
    if (input.segmentId !== undefined) {
      const name = await this.segments.resolveName(input.segmentId)
      if (name === null) throw new NotFoundError('That segment no longer exists.')
      return { id: input.segmentId, name }
    }

    if (input.conditions !== undefined && input.conditions.length > 0) {
      return this.segments.persistConditions(input.conditions)
    }

    throw new NotFoundError('Choose a segment before generating a campaign.')
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
const CHANNEL_GUIDANCE: Readonly<Record<CampaignChannel, string>> = {
  sms: 'SMS. Hard limit 160 characters for the body. No subject line. Write for a small screen.',
  push: 'Push notification. Hard limit 120 characters. Lead with the hook, one clear benefit.',
  email: 'Email. Hard limit 900 characters for the body. Structure it as an opening line, one benefit, then the call to action.',
}
function systemPrompt(input: GenerateCampaignInput): string {
  const channel = CHANNEL_GUIDANCE[input.channel]

  return [
    'You are a senior lifecycle marketer writing copy for a bank in Cameroon.',
    `Write one ${input.channel.toUpperCase()} campaign in a ${input.tone} tone.`,
    channel,
    input.language === 'fr'
      ? 'Write the copy in natural French (Français). No English words.'
      : 'Write the copy in natural English. No French words.',
    input.includeDiscount
      ? 'A discount is available. Mention it concretely with a percentage or amount.'
      : 'No discount is running. Do not invent one.',
    'Return only: a short internal title, the body copy, and a call to action of at most 6 words.',
    'Never invent account numbers, balances or interest rates.',
  ].join('\n')
}

function userPrompt(input: GenerateCampaignInput, target: { id: string; name: string }): string {
  return [
    `Segment: ${target.name}`,
    `Conditions: ${describeConditions(target.id)}`,
    `Objective: ${input.objective}`,
    'Produce the title, message and call to action.',
  ].join('\n')
}

/**
 * The conditions of an existing segment are not loaded for the prompt; the
 * segment name is the meaningful summary the copy needs.
 */
function describeConditions(segmentId: string): string {
  return segmentId === '' ? 'n/a' : 'as defined by the segment'
}
