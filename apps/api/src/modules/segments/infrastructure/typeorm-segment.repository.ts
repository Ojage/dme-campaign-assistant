import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import type { SegmentRepository } from '../application/ports/segment.ports'
import { isSegmentField, isSegmentOperator, Segment, SegmentCondition, type SegmentField } from '../domain/segment.entity'
import { SegmentOrmEntity } from '../../../shared/infrastructure/persistence/segment.orm-entity'
import { SegmentConditionOrmEntity } from '../../../shared/infrastructure/persistence/segment-condition.orm-entity'

/** The persistence value column holds text, so the domain types it on the way out. */
function readConditionValue(field: SegmentField, raw: string): number | string {
  if (field === 'country') return raw
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function toDomain(row: SegmentOrmEntity): Segment {
  const conditions = (row.conditions ?? []).map((condition) => {
    const field = isSegmentField(condition.field) ? condition.field : 'totalTransactions'
    return SegmentCondition.reconstitute({
      id: condition.id,
      field,
      operator: isSegmentOperator(condition.operator) ? condition.operator : 'eq',
      value: readConditionValue(field, condition.value),
    })
  })

  return Segment.reconstitute({
    id: row.id,
    name: row.name,
    conditions,
    matchCount: row.matchCount,
    createdAt: row.createdAt,
  })
}

/** TypeORM adapter for saved segments. */
@Injectable()
export class TypeOrmSegmentRepository implements SegmentRepository {
  public constructor(
    @InjectRepository(SegmentOrmEntity) private readonly repository: Repository<SegmentOrmEntity>,
  ) {}

  public async list(): Promise<Segment[]> {
    const rows = await this.repository.find({ order: { createdAt: 'DESC' } })
    return rows.map(toDomain)
  }

  public async findById(id: string): Promise<Segment | null> {
    const row = await this.repository.findOne({ where: { id } })
    return row === null ? null : toDomain(row)
  }

  public async create(segment: Segment): Promise<Segment> {
    const row = new SegmentOrmEntity()
    row.name = segment.name
    row.matchCount = segment.matchCount

    row.conditions = segment.conditions.map((condition) => {
      const child = new SegmentConditionOrmEntity()
      child.field = condition.field
      child.operator = condition.operator
      child.value = String(condition.value)
      return child
    })

    return toDomain(await this.repository.save(row))
  }

  public async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id })
    return (result.affected ?? 0) > 0
  }
}