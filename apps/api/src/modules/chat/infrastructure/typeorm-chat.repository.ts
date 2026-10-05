import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import type {
  ChatMessageCounter,
  ChatMessageRepository,
  ChatThreadRepository,
} from '../application/ports/chat.ports'
import { ChatMessage, ChatThread, isChatRole } from '../domain/chat.entity'
import type { ChatMessage as DomainMessage, ChatThread as DomainThread } from '../domain/chat.entity'
import { ChatMessageOrmEntity } from '../../../shared/infrastructure/persistence/chat-message.orm-entity'
import { ChatThreadOrmEntity } from '../../../shared/infrastructure/persistence/chat-thread.orm-entity'

function threadToDomain(row: ChatThreadOrmEntity, messageCount = 0): DomainThread {
  return ChatThread.reconstitute({
    id: row.id,
    title: row.title,
    messageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

function messageToDomain(row: ChatMessageOrmEntity): DomainMessage {
  return ChatMessage.reconstitute({
    id: row.id,
    threadId: row.threadId,
    role: isChatRole(row.role) ? row.role : 'user',
    content: row.content,
    model: row.model ?? undefined,
    createdAt: row.createdAt,
  })
}

@Injectable()
export class TypeOrmChatThreadRepository implements ChatThreadRepository {
  public constructor(
    @InjectRepository(ChatThreadOrmEntity) private readonly repository: Repository<ChatThreadOrmEntity>,
  ) {}

  public async list(): Promise<DomainThread[]> {
    const rows = await this.repository.find({ order: { updatedAt: 'DESC' } })
    return rows.map((row) => threadToDomain(row))
  }

  public async findById(id: string): Promise<DomainThread | null> {
    const row = await this.repository.findOne({ where: { id } })
    return row === null ? null : threadToDomain(row)
  }

  public async create(thread: DomainThread): Promise<DomainThread> {
    const row = new ChatThreadOrmEntity()
    row.title = thread.title
    return threadToDomain(await this.repository.save(row))
  }

  public async rename(id: string, title: string): Promise<DomainThread | null> {
    const row = await this.repository.findOne({ where: { id } })
    if (row === null) return null
    row.title = title
    return threadToDomain(await this.repository.save(row))
  }

  public async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id })
    return (result.affected ?? 0) > 0
  }
}

@Injectable()
export class TypeOrmChatMessageRepository implements ChatMessageRepository {
  public constructor(
    @InjectRepository(ChatMessageOrmEntity) private readonly repository: Repository<ChatMessageOrmEntity>,
  ) {}

  public async list(threadId: string): Promise<DomainMessage[]> {
    const rows = await this.repository.find({ where: { threadId }, order: { createdAt: 'ASC' } })
    return rows.map(messageToDomain)
  }

  public async append(message: DomainMessage): Promise<DomainMessage> {
    const row = new ChatMessageOrmEntity()
    row.threadId = message.threadId
    row.role = message.role
    row.content = message.content
    row.model = message.model ?? null
    return messageToDomain(await this.repository.save(row))
  }
}

/** One grouped query instead of one count per thread. */
@Injectable()
export class TypeOrmChatMessageCounter implements ChatMessageCounter {
  public constructor(
    @InjectRepository(ChatMessageOrmEntity) private readonly repository: Repository<ChatMessageOrmEntity>,
  ) {}

  public async countsByThread(threadIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (threadIds.length === 0) return new Map()

    const rows = await this.repository
      .createQueryBuilder('message')
      .select('message.threadId', 'threadId')
      .addSelect('COUNT(message.id)', 'total')
      .where('message.threadId IN (:...threadIds)', { threadIds })
      .groupBy('message.threadId')
      .getRawMany<{ threadId: string; total: string }>()

    return new Map(rows.map((row) => [row.threadId, Number(row.total)]))
  }
}