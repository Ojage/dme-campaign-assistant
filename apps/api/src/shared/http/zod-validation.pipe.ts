import { Injectable, type PipeTransform } from '@nestjs/common'
import * as z from 'zod/v4'
import { ValidationError } from '../domain/domain.errors'

/** Flattens zod issues into the field map carried by problem details. */
function toFieldErrors(error: z.ZodError): Readonly<Record<string, string[]>> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root'
    const bucket = fieldErrors[key] ?? []
    bucket.push(issue.message)
    fieldErrors[key] = bucket
  }
  return fieldErrors
}

/**
 * Validates and *transforms* an incoming payload with the same zod schema the
 * shared contract uses on the client. Because the pipe returns the parsed value,
 * controllers receive coerced types instead of raw strings.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodTypeAny> implements PipeTransform<unknown, z.output<TSchema>> {
  public constructor(private readonly schema: TSchema) {}

  public transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new ValidationError('One or more fields are invalid.', toFieldErrors(result.error))
    }
    return result.data
  }
}

export const zodBody = <TSchema extends z.ZodTypeAny>(schema: TSchema): ZodValidationPipe<TSchema> =>
  new ZodValidationPipe(schema)

export const zodQuery = <TSchema extends z.ZodTypeAny>(schema: TSchema): ZodValidationPipe<TSchema> =>
  new ZodValidationPipe(schema)

export const zodParams = <TSchema extends z.ZodTypeAny>(schema: TSchema): ZodValidationPipe<TSchema> =>
  new ZodValidationPipe(schema)