import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import * as z from 'zod/v4'
import {
  generateCampaignFromConditionsRequestSchema,
  generateCampaignRequestSchema,
  updateCampaignStatusRequestSchema,
} from '@dme/contracts'
import { zodBody, zodParams } from '../../../../shared/http/zod-validation.pipe'
import {
  DeleteCampaign,
  GenerateCampaign,
  ListCampaigns,
  UpdateCampaignStatus,
} from '../../application/use-cases/campaign.use-cases'
import type { GenerateCampaignInput } from '../../application/use-cases/campaign.use-cases'
import type { Campaign } from '../../domain/campaign.entity'

const idParamSchema = z.object({ id: z.string().uuid() })

function toResponse(campaign: Campaign) {
  return {
    id: campaign.id,
    title: campaign.title,
    message: campaign.message,
    callToAction: campaign.callToAction,
    segmentId: campaign.segmentId,
    segmentName: campaign.segmentName,
    channel: campaign.channel,
    tone: campaign.tone,
    status: campaign.status,
    objective: campaign.objective,
    generatedAt: campaign.generatedAt.toISOString(),
  }
}

type CampaignResponse = ReturnType<typeof toResponse>

type GenerateBody = z.infer<typeof generateCampaignRequestSchema>
type GenerateFromConditionsBody = z.infer<typeof generateCampaignFromConditionsRequestSchema>

@Controller('campaigns')
export class CampaignsController {
  public constructor(
    private readonly listCampaigns: ListCampaigns,
    private readonly generateCampaign: GenerateCampaign,
    private readonly updateStatus: UpdateCampaignStatus,
    private readonly deleteCampaign: DeleteCampaign,
  ) {}

  @Get()
  public async list(): Promise<CampaignResponse[]> {
    return (await this.listCampaigns.execute()).map(toResponse)
  }

  /** Generation from an already-saved segment. */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  public async generate(@Body(zodBody(generateCampaignRequestSchema)) body: GenerateBody) {
    return toResponse(await this.generateCampaign.execute(toInput(body, { segmentId: body.segmentId })))
  }

  /** Generation from ad-hoc conditions; the API saves them as a segment first. */
  @Post('generate-from-conditions')
  @HttpCode(HttpStatus.CREATED)
  public async generateFromConditions(
    @Body(zodBody(generateCampaignFromConditionsRequestSchema)) body: GenerateFromConditionsBody,
  ) {
    return toResponse(await this.generateCampaign.execute(toInput(body, { conditions: body.conditions })))
  }

  @Patch(':id/status')
  public async setStatus(
    @Param(zodParams(idParamSchema)) params: z.infer<typeof idParamSchema>,
    @Body(zodBody(updateCampaignStatusRequestSchema)) body: z.infer<typeof updateCampaignStatusRequestSchema>,
  ): Promise<CampaignResponse> {
    return toResponse(await this.updateStatus.execute(params.id, body.status))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(@Param(zodParams(idParamSchema)) params: z.infer<typeof idParamSchema>): Promise<void> {
    await this.deleteCampaign.execute(params.id)
  }
}

/** Narrows the two request shapes to the one shape the use case accepts. */
function toInput(
  body: GenerateBody | GenerateFromConditionsBody,
  target: { segmentId?: string; conditions?: GenerateFromConditionsBody['conditions'] },
): GenerateCampaignInput {
  return {
    objective: body.objective,
    channel: body.channel,
    tone: body.tone,
    language: body.language,
    includeDiscount: body.includeDiscount,
    ...target,
  }
}