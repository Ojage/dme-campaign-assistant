import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CHAT_PORTS } from './application/ports/chat.ports'
import {
  CreateThread,
  DeleteThread,
  ListMessages,
  ListThreads,
  SendMessage,
  StreamMessage,
} from './application/use-cases/chat.use-cases'
import {
  TypeOrmChatMessageCounter,
  TypeOrmChatMessageRepository,
  TypeOrmChatThreadRepository,
} from './infrastructure/typeorm-chat.repository'
import { ChatController } from './interface/http/chat.controller'
import { LlmModule } from '../../shared/infrastructure/llm/llm.module'
import { ChatMessageOrmEntity } from '../../shared/infrastructure/persistence/chat-message.orm-entity'
import { ChatThreadOrmEntity } from '../../shared/infrastructure/persistence/chat-thread.orm-entity'

/** Composition root for the chat module. */
@Module({
  imports: [TypeOrmModule.forFeature([ChatThreadOrmEntity, ChatMessageOrmEntity]), LlmModule],
  controllers: [ChatController],
  providers: [
    ListThreads,
    CreateThread,
    DeleteThread,
    ListMessages,
    SendMessage,
    StreamMessage,
    { provide: CHAT_PORTS.threadRepository, useClass: TypeOrmChatThreadRepository },
    { provide: CHAT_PORTS.messageRepository, useClass: TypeOrmChatMessageRepository },
    { provide: CHAT_PORTS.messageCounter, useClass: TypeOrmChatMessageCounter },
  ],
})
export class ChatModule {}
