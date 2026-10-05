import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import * as z from 'zod/v4'
import { createSegmentRequestSchema, segmentPreviewRequestSchema } from '@dme/contracts'
import { zodBody, zodParams } from '../../../../shared/http/zod-validation.pipe'
import {
  CreateSegment,
  DeleteSegment,
  ListSegments,
  PreviewSegment,
} from '../../application/use-cases/segment.use-cases'
import type { Segment } from '../../domain/segment.entity'

/** The only identifier coming from a URL; validated before the use case sees it. */
const idParamSchema = z.object({ id: z.string().uuid() })

function toResponse(segment: Segment) {
  return {
    id: segment.id,
    name: segment.name,
    conditions: segment.conditions.map((condition) => condition.toJSON()),
    matchCount: segment.matchCount,
    createdAt: segment.createdAt.toISOString(),
  }
}

type SegmentResponse = ReturnType<typeof toResponse>

@Controller('segments')
export class SegmentsController {
  public constructor(
    private readonly listSegments: ListSegments,
    private readonly createSegment: CreateSegment,
    private readonly deleteSegment: DeleteSegment,
    private readonly previewSegment: PreviewSegment,
  ) {}

  @Get()
  public async list(): Promise<SegmentResponse[]> {
    return (await this.listSegments.execute()).map(toResponse)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Body(zodBody(createSegmentRequestSchema)) body: z.infer<typeof createSegmentRequestSchema>) {
    return toResponse(await this.createSegment.execute(body))
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  public async preview(
    @Body(zodBody(segmentPreviewRequestSchema)) body: z.infer<typeof segmentPreviewRequestSchema>,
  ): Promise<{ matchCount: number }> {
    return this.previewSegment.execute(body.conditions)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(@Param(zodParams(idParamSchema)) params: z.infer<typeof idParamSchema>): Promise<void> {
    await this.deleteSegment.execute(params.id)
  }
}