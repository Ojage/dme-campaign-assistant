import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { ChatMessageOrmEntity } from './chat-message.orm-entity'

/** A conversation. Messages hang off it and are deleted with it. */
@Entity({ name: 'chat_threads' })
@Index(['updatedAt'])
export class ChatThreadOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @Column({ type: 'varchar', length: 120 })
  public title!: string

  @OneToMany(() => ChatMessageOrmEntity, (message) => message.thread)
  public messages!: ChatMessageOrmEntity[]

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date
}
