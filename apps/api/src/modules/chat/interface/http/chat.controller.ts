import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import * as z from 'zod/v4'
import { createThreadRequestSchema, sendMessageRequestSchema } from '@dme/contracts'
import { zodBody, zodParams } from '../../../../shared/http/zod-validation.pipe'
import {
  CreateThread,
  DeleteThread,
  ListMessages,
  ListThreads,
  SendMessage,
  StreamMessage,
} from '../../application/use-cases/chat.use-cases'
import type { ChatStreamEvent, SendMessageInput } from '../../application/use-cases/chat.use-cases'
import { ChatMessage, ChatThread } from '../../domain/chat.entity'

const idParamSchema = z.object({ id: z.string().uuid() })
const threadMessagesParamSchema = z.object({ threadId: z.string().uuid() })

type SendBody = z.infer<typeof sendMessageRequestSchema>
type ThreadId = z.infer<typeof threadMessagesParamSchema>

function threadToResponse(thread: ChatThread) {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messageCount: thread.messageCount,
  }
}

/** Serialises a domain message into the shape `chatMessageSchema` requires. */
function messageToResponse(message: ChatMessage) {
  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role,
    content: message.content,
    ...(message.model === undefined ? {} : { model: message.model }),
    createdAt: message.createdAt.toISOString(),
  }
}

type ThreadResponse = ReturnType<typeof threadToResponse>
type MessageResponse = ReturnType<typeof messageToResponse>

@Controller('chat/threads')
export class ChatController {
  public constructor(
    private readonly listThreads: ListThreads,
    private readonly createThreadUseCase: CreateThread,
    private readonly deleteThreadUseCase: DeleteThread,
    private readonly listMessages: ListMessages,
    private readonly sendMessage: SendMessage,
    private readonly streamMessage: StreamMessage,
  ) {}

  @Get()
  public async threads(): Promise<ThreadResponse[]> {
    return (await this.listThreads.execute()).map(threadToResponse)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createThread(
    @Body(zodBody(createThreadRequestSchema)) body: z.infer<typeof createThreadRequestSchema>,
  ): Promise<ThreadResponse> {
    return threadToResponse(await this.createThreadUseCase.execute(body.title))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteThread(@Param(zodParams(idParamSchema)) params: z.infer<typeof idParamSchema>): Promise<void> {
    await this.deleteThreadUseCase.execute(params.id)
  }

  @Get(':threadId/messages')
  public async messages(@Param(zodParams(threadMessagesParamSchema)) params: ThreadId): Promise<MessageResponse[]> {
    return (await this.listMessages.execute(params.threadId)).map(messageToResponse)
  }

  /** Non-streaming send, used when the client prefers one JSON response. */
  @Post(':threadId/messages')
  @HttpCode(HttpStatus.CREATED)
  public async send(
    @Param(zodParams(threadMessagesParamSchema)) params: ThreadId,
    @Body(zodBody(sendMessageRequestSchema)) body: SendBody,
  ) {
    const result = await this.sendMessage.execute(params.threadId, toInput(body))
    return {
      userMessage: messageToResponse(result.userMessage),
      assistantMessage: messageToResponse(result.assistantMessage),
    }
  }

  /**
   * Streams a reply as server-sent events.
   *
   * Written directly to the response because SSE frames must be flushed as they
   * are produced; the shared client parses `data:` lines and validates each frame
   * against `chatStreamEventSchema`.
   */
  @Post(':threadId/messages/stream')
  public async sendStream(
    @Param(zodParams(threadMessagesParamSchema)) params: ThreadId,
    @Body(zodBody(sendMessageRequestSchema)) body: SendBody,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.writeHead(HttpStatus.OK, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Stops nginx buffering the stream in front of the API.
      'x-accel-buffering': 'no',
    })

    // Closing the socket must cancel the provider call, not leave it running.
    const controller = new AbortController()
    request.on('close', () => controller.abort())

    try {
      for await (const event of this.streamMessage.execute(params.threadId, toInput(body), controller.signal)) {
        response.write(`data: ${JSON.stringify(toStreamPayload(event))}\n\n`)
      }
    } catch (error) {
      response.write(
        `data: ${JSON.stringify({ type: 'error', code: 'stream_failed', message: describe(error) })}\n\n`,
      )
    } finally {
      response.end()
    }
  }
}

function toInput(body: SendBody): SendMessageInput {
  return { content: body.content, language: body.language }
}

/**
 * Maps a domain stream event onto the wire shape declared in the contract: the
 * nested message has to be serialised too, so it cannot be passed straight through.
 */
function toStreamPayload(event: ChatStreamEvent): unknown {
  if (event.type === 'done') {
    return { type: 'done', assistantMessage: messageToResponse(event.assistantMessage) }
  }
  return event
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'The assistant could not finish its reply.'
}