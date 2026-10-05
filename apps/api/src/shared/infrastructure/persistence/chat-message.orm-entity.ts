import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { ChatThreadOrmEntity } from './chat-thread.orm-entity'

/** A single turn in a conversation. */
@Entity({ name: 'chat_messages' })
@Index(['threadId', 'createdAt'])
export class ChatMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @ManyToOne(() => ChatThreadOrmEntity, (thread) => thread.messages, { onDelete: 'CASCADE' })
  public thread?: ChatThreadOrmEntity

  @Column({ type: 'uuid' })
  public threadId!: string

  @Column({ type: 'varchar', length: 16 })
  public role!: string

  @Column({ type: 'text' })
  public content!: string

  /** Which model produced an assistant turn. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public model!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date
}
