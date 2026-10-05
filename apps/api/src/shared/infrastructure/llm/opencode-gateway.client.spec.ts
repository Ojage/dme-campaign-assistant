import * as z from 'zod/v4'
import { envSchema, toAppConfig } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { ModelProviderError } from '../../domain/domain.errors'
import { OpenCodeGatewayClient } from './opencode-gateway.client'

/**
 * This client is the only place that knows the gateway's wire format, so these
 * tests pin that format: what goes out, what comes back, and which failures are
 * worth retrying. Everything else in the app sees the ports.
 */

const BASE = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'dme',
  DATABASE_USER: 'dme',
  DATABASE_PASSWORD: 'dme',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
  OPENCODE_API_KEY: 'sk-zen-test',
} as const

function configFor(overrides: Record<string, unknown> = {}): AppConfig {
  return toAppConfig(envSchema.parse({ ...BASE, ...overrides }))
}

const REQUEST = {
  system: 'You are concise.',
  turns: [{ role: 'user' as const, content: 'Hello' }],
}

/**
 * The client is built directly rather than through the adapter, because the client
 * is where the behaviour is and it needs no Nest container to run.
 */
function adapter(overrides: Record<string, unknown> = {}): OpenCodeGatewayClient {
  const { enabled: _enabled, ...settings } = configFor(overrides).opencode
  return new OpenCodeGatewayClient(settings, { error: () => undefined })
}

/**
 * A `fetch` stand-in that records the request and replays a canned response.
 * `globalThis.fetch` is saved and put back by hand, so the tests do not depend on
 * a Jest global for their only stub.
 */
function stubFetch(response: Response | (() => Promise<Response>)): jest.Mock {
  const impl = typeof response === 'function' ? response : () => Promise.resolve(response)
  const mock = jest.fn(impl) as unknown as jest.Mock
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** An SSE body, given the payload of each frame. */
function sseResponse(frames: readonly string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

async function collect(generator: AsyncGenerator<string, void, undefined>): Promise<string[]> {
  const parts: string[] = []
  for await (const delta of generator) parts.push(delta)
  return parts
}

/** Runs a call that must fail, and hands back the typed domain error it failed with. */
async function captureError(promise: Promise<unknown>): Promise<ModelProviderError> {
  const outcome = await promise.then(
    () => undefined,
    (cause: unknown) => cause,
  )
  expect(outcome).toBeInstanceOf(ModelProviderError)
  return outcome as ModelProviderError
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('a generation request', () => {
  it('posts to /chat/completions with the key as a bearer token', async () => {
    const fetchMock = stubFetch(jsonResponse({ model: 'glm-5.2', choices: [{ message: { content: 'Hi' } }] }))

    await adapter().generate(REQUEST)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://opencode.ai/zen/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-zen-test')
  })

  it('sends the system prompt ahead of the turns', async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await adapter().generate(REQUEST)

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Hello' },
    ])
    expect(body.model).toBe('glm-5.2')
    expect(body.stream).toBeUndefined()
  })

  it('honours the request budget over the configured one', async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await adapter().generate({ ...REQUEST, maxTokens: 64, temperature: 0.2 })

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.max_tokens).toBe(64)
    expect(body.temperature).toBe(0.2)
  })

  it('omits temperature rather than sending a null', async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await adapter().generate(REQUEST)

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect('temperature' in body).toBe(false)
  })

  it('reports the model the gateway resolved', async () => {
    stubFetch(jsonResponse({ model: 'glm-5.2-free', choices: [{ message: { content: 'Hi' } }] }))

    await expect(adapter().generate(REQUEST)).resolves.toEqual({ text: 'Hi', model: 'glm-5.2-free' })
  })

  it('falls back to the configured id when the gateway echoes none', async () => {
    stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await expect(adapter().generate(REQUEST)).resolves.toEqual({ text: 'Hi', model: 'glm-5.2' })
  })

  it('forwards the caller abort signal, so a closed stream cancels upstream', async () => {
    const controller = new AbortController()
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await adapter().generate({ ...REQUEST, signal: controller.signal })

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].signal).toBe(controller.signal)
  })
})

describe('a stream', () => {
  it('yields the text of each frame', async () => {
    stubFetch(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":", world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    await expect(collect(adapter().stream(REQUEST))).resolves.toEqual(['Hello', ', world'])
  })

  it('reassembles a frame split across reads', async () => {
    const encoder = new TextEncoder()
    const payload = 'data: {"choices":[{"delta":{"content":"split"}}]}\n\n'
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(payload.slice(0, 12)))
        controller.enqueue(encoder.encode(payload.slice(12)))
        controller.close()
      },
    })
    stubFetch(new Response(body, { status: 200 }))

    await expect(collect(adapter().stream(REQUEST))).resolves.toEqual(['split'])
  })

  it('skips frames that carry no text, such as a usage footer', async () => {
    stubFetch(
      sseResponse([
        'event: ping\n\n',
        'data: {"choices":[]}\n\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    await expect(collect(adapter().stream(REQUEST))).resolves.toEqual(['ok'])
  })

  it('stops at the terminator rather than waiting for the socket', async () => {
    // A terminator followed by a frame that must never be read.
    const encoder = new TextEncoder()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"late"}}]}\n\n'))
      },
      cancel() {
        cancelled = true
      },
    })
    stubFetch(new Response(body, { status: 200 }))

    await expect(collect(adapter().stream(REQUEST))).resolves.toEqual(['a'])
    expect(cancelled).toBe(true)
  })

  it('asks for a stream on the wire', async () => {
    const fetchMock = stubFetch(sseResponse(['data: [DONE]\n\n']))

    await collect(adapter().stream(REQUEST))

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.stream).toBe(true)
  })
})

describe('a structured generation', () => {
  const schema = z.object({ title: z.string(), message: z.string() })

  it('asks for the schema and returns validated data', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ choices: [{ message: { content: '{"title":"T","message":"M"}' } }] }),
    )

    await expect(
      adapter().generateStructured({ system: 's', turns: REQUEST.turns, schema }),
    ).resolves.toEqual({ data: { title: 'T', message: 'M' }, model: 'glm-5.2' })
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).response_format).toEqual(
      {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: {
            type: 'object',
            properties: { title: { type: 'string' }, message: { type: 'string' } },
            required: ['title', 'message'],
            additionalProperties: false,
          },
        },
      },
    )
  })

  it('rejects a response that does not satisfy the schema', async () => {
    stubFetch(jsonResponse({ choices: [{ message: { content: '{"title":"T"}' } }] }))

    await expect(
      adapter().generateStructured({ system: 's', turns: REQUEST.turns, schema }),
    ).rejects.toThrow(ModelProviderError)
  })

  it('rejects prose where JSON was promised', async () => {
    stubFetch(jsonResponse({ choices: [{ message: { content: 'I could not help with that.' } }] }))

    await expect(
      adapter().generateStructured({ system: 's', turns: REQUEST.turns, schema }),
    ).rejects.toThrow('The content model returned a malformed response.')
  })
})

describe('a provider fault', () => {
  async function expectError(response: Response | (() => Promise<Response>)) {
    stubFetch(response)
    return captureError(adapter().generate(REQUEST))
  }

  // `llm_unavailable` is the code callers treat as worth retrying; `llm_error` is
  // not. The taxonomy has no separate retryable flag, and this client mirrors the
  // Anthropic adapter's mapping.
  it('marks a rejected key as permanent, not retryable', async () => {
    const error = await expectError(jsonResponse({ error: 'invalid api key' }, 401))
    expect(error.code).toBe('llm_error')
    expect(error.status).toBe(503)
  })

  it('marks a rate limit and a server fault as retryable', async () => {
    expect((await expectError(jsonResponse({}, 429))).code).toBe('llm_unavailable')
    expect((await expectError(jsonResponse({}, 503))).code).toBe('llm_unavailable')
  })

  it('marks a rejected request as permanent', async () => {
    expect((await expectError(jsonResponse({}, 400))).code).toBe('llm_error')
  })

  it('treats an unreachable gateway as retryable', async () => {
    const error = await expectError(() => Promise.reject(new Error('ECONNREFUSED')))
    expect(error.code).toBe('llm_unavailable')
  })

  it('treats an unreadable envelope as permanent', async () => {
    stubFetch(new Response('not json', { status: 200 }))
    await expect(adapter().generate(REQUEST)).rejects.toThrow('The content model returned an unreadable response.')
  })

  it('does not mistake a cancelled request for an outage', async () => {
    const controller = new AbortController()
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    stubFetch(() => Promise.reject(abortError))

    const error = await captureError(adapter().generate({ ...REQUEST, signal: controller.signal }))
    expect(error.code).toBe('llm_error')
    expect(error.message).toBe('The request was cancelled.')
  })

  it('never echoes the key into the client-facing message', async () => {
    const error = await expectError(jsonResponse({ error: 'sk-zen-test is invalid' }, 401))
    expect(error.message).not.toContain('sk-zen-test')
  })
})

describe('a custom gateway', () => {
  it('is reachable through the base URL alone', async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await adapter({ OPENCODE_BASE_URL: 'https://gw.example.com/v1' }).generate(REQUEST)

    expect((fetchMock.mock.calls[0] as [string, string])[0]).toBe('https://gw.example.com/v1/chat/completions')
  })

  it('sends the configured model', async () => {
    const fetchMock = stubFetch(jsonResponse({ choices: [{ message: { content: 'Hi' } }] }))

    await adapter({ OPENCODE_MODEL: 'kimi-k2.5' }).generate(REQUEST)

    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).model).toBe('kimi-k2.5')
  })
})