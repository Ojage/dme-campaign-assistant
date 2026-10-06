import * as z from 'zod/v4'
import { ModelProviderError } from '../../domain/domain.errors'
import type { StructuredModel } from '../../application/ports/structured-model.port'
import type { TextGenerationRequest, TextModel } from '../../application/ports/text-model.port'
import { RetryingModel } from './retrying-model'
import type { RetryPolicy } from './retry'

/**
 * The decorator owns retry for every provider, so these tests use a scriptable
 * stand-in rather than a real gateway. What matters is the contract: which faults
 * are repeated, and — the part that is easy to get wrong — when a stream may be
 * started again.
 */

const unavailable = (): ModelProviderError => new ModelProviderError(undefined, 'llm_unavailable')
const rejected = (): ModelProviderError => new ModelProviderError(undefined, 'llm_error')

const REQUEST: TextGenerationRequest = { system: 's', turns: [{ role: 'user', content: 'hi' }] }

/**
 * A model whose three capabilities are scripted independently.
 *
 * It does not declare `implements`: `generateStructured` is generic in its schema,
 * which a concrete mock cannot reproduce. The single cast in `model()` covers that.
 */
class ScriptedModel {
  public readonly modelId = 'scripted-test'
  public generate = jest.fn<Promise<{ text: string; model: string }>, []>()
  public stream = jest.fn<AsyncGenerator<string, void, undefined>, []>()
  public generateStructured = jest.fn<Promise<{ data: unknown; model: string }>, []>()

  /** Streams the given deltas, then throws `failure` if one is supplied. */
  static deltas(deltas: readonly string[], failure?: () => Error): () => AsyncGenerator<string, void, undefined> {
    return async function* stream(): AsyncGenerator<string, void, undefined> {
      for (const delta of deltas) yield delta
      if (failure !== undefined) throw failure()
    }
  }
}

function policy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
  return {
    maxAttempts: 3,
    baseDelayMs: 1,
    maxDelayMs: 2,
    jitter: () => 0,
    sleep: async () => undefined,
    ...overrides,
  }
}

function model(inner: ScriptedModel, overrides: Partial<RetryPolicy> = {}): RetryingModel {
  return new RetryingModel(inner as unknown as TextModel & StructuredModel, policy(overrides))
}

async function collect(generator: AsyncGenerator<string, void, undefined>): Promise<string[]> {
  const parts: string[] = []
  for await (const delta of generator) parts.push(delta)
  return parts
}

describe('a buffered call', () => {
  it('retries a transient fault and returns the recovered answer', async () => {
    const inner = new ScriptedModel()
    inner.generate = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue({ text: 'recovered', model: 'scripted-test' })

    await expect(model(inner).generate(REQUEST)).resolves.toEqual({ text: 'recovered', model: 'scripted-test' })
    expect(inner.generate).toHaveBeenCalledTimes(2)
  })

  it('retries a structured call too, since nothing has been saved yet', async () => {
    const inner = new ScriptedModel()
    inner.generateStructured = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue({ data: { title: 'T' }, model: 'scripted-test' })

    const result = await model(inner).generateStructured({
      system: 's',
      turns: [],
      schema: z.object({ title: z.string() }),
    })
    expect(result.data).toEqual({ title: 'T' })
    expect(inner.generateStructured).toHaveBeenCalledTimes(2)
  })

  it('surfaces a permanent fault without repeating it', async () => {
    const inner = new ScriptedModel()
    inner.generate = jest.fn().mockRejectedValue(rejected())

    await expect(model(inner).generate(REQUEST)).rejects.toThrow(ModelProviderError)
    expect(inner.generate).toHaveBeenCalledTimes(1)
  })

  it('fails once the budget is spent, leaving the caller a 503 to report', async () => {
    const inner = new ScriptedModel()
    inner.generate = jest.fn().mockRejectedValue(unavailable())

    await expect(model(inner).generate(REQUEST)).rejects.toThrow(
      'The content model is unavailable. Try again shortly.',
    )
    expect(inner.generate).toHaveBeenCalledTimes(3)
  })

  it('reports the inner model id, so the client still learns what answered', () => {
    expect(model(new ScriptedModel()).modelId).toBe('scripted-test')
  })
})

describe('a stream', () => {
  it('retries when it failed before producing any text', async () => {
    const inner = new ScriptedModel()
    inner.stream = jest
      .fn()
      .mockImplementationOnce(ScriptedModel.deltas([], unavailable))
      .mockImplementationOnce(ScriptedModel.deltas(['hello']))

    await expect(collect(model(inner).stream(REQUEST))).resolves.toEqual(['hello'])
    expect(inner.stream).toHaveBeenCalledTimes(2)
  })

  it('does not retry once text has reached the browser', async () => {
    const inner = new ScriptedModel()
    inner.stream = jest.fn().mockImplementation(ScriptedModel.deltas(['partial'], unavailable))

    // Replaying would duplicate what the user is already reading, so the partial
    // answer stands and the failure is the caller's to handle.
    await expect(collect(model(inner).stream(REQUEST))).rejects.toThrow(ModelProviderError)
    expect(inner.stream).toHaveBeenCalledTimes(1)
  })

  it('never duplicates text when a retry does happen', async () => {
    const inner = new ScriptedModel()
    inner.stream = jest
      .fn()
      .mockImplementationOnce(ScriptedModel.deltas([], unavailable))
      .mockImplementationOnce(ScriptedModel.deltas(['one', 'two']))

    await expect(collect(model(inner).stream(REQUEST))).resolves.toEqual(['one', 'two'])
  })

  it('spends its whole budget retrying an empty stream', async () => {
    const inner = new ScriptedModel()
    inner.stream = jest.fn().mockImplementation(ScriptedModel.deltas([], unavailable))

    await expect(collect(model(inner).stream(REQUEST))).rejects.toThrow(ModelProviderError)
    expect(inner.stream).toHaveBeenCalledTimes(3)
  })

  it('does not retry a permanent fault', async () => {
    const inner = new ScriptedModel()
    inner.stream = jest.fn().mockImplementation(ScriptedModel.deltas([], rejected))

    await expect(collect(model(inner).stream(REQUEST))).rejects.toThrow(ModelProviderError)
    expect(inner.stream).toHaveBeenCalledTimes(1)
  })

  it('stops retrying when the caller disconnects mid-retry', async () => {
    const controller = new AbortController()
    const inner = new ScriptedModel()
    inner.stream = jest.fn().mockImplementation(() => {
      controller.abort()
      return ScriptedModel.deltas([], unavailable)()
    })

    await expect(collect(model(inner).stream({ ...REQUEST, signal: controller.signal }))).rejects.toThrow(
      ModelProviderError,
    )
    expect(inner.stream).toHaveBeenCalledTimes(1)
  })

  it('passes a healthy stream through untouched', async () => {
    const inner = new ScriptedModel()
    inner.stream = jest.fn().mockImplementation(ScriptedModel.deltas(['a', 'b']))

    await expect(collect(model(inner).stream(REQUEST))).resolves.toEqual(['a', 'b'])
    expect(inner.stream).toHaveBeenCalledTimes(1)
  })
})