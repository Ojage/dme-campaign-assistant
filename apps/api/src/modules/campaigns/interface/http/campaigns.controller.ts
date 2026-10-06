import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common'
import * as z from 'zod/v4'
import {
  generateCampaignRequestSchema,
  updateCampaignStatusRequestSchema,
} from '@dme/contracts'
import { zodBody, zodParams } from '../../../../shared/http/zod-validation.pipe'
import { IdempotencyInterceptor, Idempotent } from '../../../../shared/http/idempotency.interceptor'
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

  /**
   * Generation always targets a saved segment: one audience definition, referenced
   * by campaigns, rather than a second way to express the same conditions.
   *
   * Marked idempotent because a client is allowed to repeat this: generation costs
   * money and creates a record, so a retry after a 503 must return the first
   * campaign rather than a second one.
   */
  @Post('generate')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  public async generate(@Body(zodBody(generateCampaignRequestSchema)) body: GenerateBody) {
    return toResponse(await this.generateCampaign.execute(toInput(body)))
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

/** Maps the request body onto the use case input. */
function toInput(body: GenerateBody): GenerateCampaignInput {
  return {
    objective: body.objective,
    channel: body.channel,
    tone: body.tone,
    language: body.language,
    includeDiscount: body.includeDiscount,
    segmentId: body.segmentId,
  }
}