import assert from 'node:assert/strict'
import test from 'node:test'

import { HttpClient } from '../dist/http/client.js'
import { operations } from '../dist/http/api.js'
import { API_VERSION } from '../dist/http/version.js'

const BASE_URL = 'http://localhost:4000/api'

/** A token store that holds nothing, so calls stay unauthenticated. */
function emptyStore() {
  return {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    setSession() {},
    clear() {},
  }
}

/**
 * Records what the transport was actually asked to send. Returns the client plus
 * the log, so a test can assert on the request without a live server.
 */
function recordingClient() {
  const sent = []
  let received = 0
  const client = new HttpClient({
    baseUrl: BASE_URL,
    tokens: emptyStore(),
    fetchImpl: (input, init) => {
      received += 1
      const request = input instanceof Request ? input : new Request(input, init)
      // Mirror the real transport: an aborted signal rejects before any bytes move.
      if (request.signal?.aborted === true) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
      }
      sent.push({ method: request.method, url: request.url, headers: request.headers, signal: request.signal })
      // An empty JSON object is enough to reach the response check, which is
      // where the contract deliberately rejects it. Method, URL and signal are
      // already recorded by then.
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    },
  })
  return { client, sent, received: () => received }
}

/**
 * One valid body per operation that declares one. Each entry is checked against
 * the registry below, so a schema change fails here rather than silently
 * skipping an operation.
 */
const CUSTOMER = {
  name: 'Aicha Njoya',
  email: 'aicha.njoya@dme.cm',
  country: 'Cameroon',
  totalTransactions: 12,
  totalAmountSpent: 250000,
  lastActivityDate: '2026-09-01',
  status: 'active',
}

const CONDITIONS = [{ field: 'totalTransactions', operator: 'lt', value: 5 }]

const VALID_BODIES = {
  'auth.signIn': { email: 'aicha.njoya@dme.cm', password: 'campaigns' },
  'auth.refresh': { refreshToken: 'refresh-token' },
  'auth.signOut': { refreshToken: 'refresh-token' },
  'customers.create': CUSTOMER,
  'customers.import': { customers: [CUSTOMER] },
  'segments.create': { name: 'Low activity', conditions: CONDITIONS },
  'segments.preview': { conditions: CONDITIONS },
  'campaigns.generate': {
    objective: 'Win back dormant customers',
    segmentId: '00000000-0000-4000-8000-000000000001',
    channel: 'email',
    tone: 'friendly',
    language: 'en',
    includeDiscount: false,
  },
  'campaigns.updateStatus': { status: 'sent' },
  'chat.threads.create': { title: 'Churn review' },
  'chat.messages.send': { content: 'Which segments are churning?', language: 'en' },
}

function bodyFor(name, spec) {
  if (spec.body === undefined) return undefined
  const body = VALID_BODIES[name]
  assert.ok(body !== undefined, `no fixture body registered for ${name}`)
  const parsed = spec.body.safeParse(body)
  assert.ok(parsed.success, `fixture body for ${name} does not match its schema: ${parsed.error?.message}`)
  return body
}

test('every operation is sent with its declared HTTP method', async () => {
  for (const [name, spec] of Object.entries(operations)) {
    const { client, sent } = recordingClient()
    await client.call(name, { body: bodyFor(name, spec), params: pathParamsFor(spec) }).catch(() => {})
    assert.equal(sent.length, 1, `${name} sent ${sent.length} requests, expected 1`)
    assert.equal(sent[0].method, spec.method, `${name} must be sent as ${spec.method}`)
  }
})

test('a request with a body carries JSON, and one without does not', async () => {
  const withBody = recordingClient()
  await withBody.client.call('auth.signIn', { body: VALID_BODIES['auth.signIn'] }).catch(() => {})
  assert.equal(withBody.sent[0].headers.get('content-type'), 'application/json')

  const readOnly = recordingClient()
  await readOnly.client.call('segments.list').catch(() => {})
  assert.equal(readOnly.sent[0].headers.get('content-type'), null)
})

test('a GET is never built with a body', async () => {
  // The `Request` constructor rejects this outright, which is how a hardcoded
  // GET surfaced as a network error in the sign-in form.
  const { client, sent } = recordingClient()
  await client.call('segments.list').catch(() => {})
  assert.equal(sent.length, 1)
})

test('every operation is sent under the version prefix', async () => {
  const prefix = `${BASE_URL}/${API_VERSION}/`

  for (const [name, spec] of Object.entries(operations)) {
    const { client, sent } = recordingClient()
    await client.call(name, { body: bodyFor(name, spec), params: pathParamsFor(spec) }).catch(() => {})

    assert.ok(sent[0].url.startsWith(prefix), `${name} was sent to ${sent[0].url}, which is outside ${prefix}`)

    // The registry uses `:name` segments; each must be replaced by a value.
    const staticPrefix = spec.path.slice(0, spec.path.search(/:[^/]+/)) || spec.path
    if (staticPrefix !== spec.path) {
      assert.ok(sent[0].url.includes(`${prefix.slice(0, -1)}${staticPrefix}`), `${name} lost its path prefix: ${sent[0].url}`)
      assert.ok(!/(^|\/):[^/]+/.test(new URL(sent[0].url).pathname), `${name} left an uninterpolated path segment: ${sent[0].url}`)
    }
  }
})

test('the caller abort signal reaches the transport', async () => {
  const controller = new AbortController()
  const { client, sent } = recordingClient()
  await client.call('auth.signIn', { body: VALID_BODIES['auth.signIn'], signal: controller.signal }).catch(() => {})

  assert.equal(sent.length, 1)
  assert.equal(sent[0].signal.aborted, false, 'the call starts un-aborted')

  // `Request` follows the signal it was given rather than storing it, so the
  // link is proved by aborting afterwards and observing the Request.
  controller.abort()
  assert.equal(sent[0].signal.aborted, true, 'aborting the caller signal must abort the Request')
})

/** Drains a stream, ignoring contract failures — only the Request is under test. */
async function drain(stream) {
  try {
    for await (const _event of stream) {
      // Keep reading until the server closes.
    }
  } catch {
    // A frame that does not match the contract is fine here.
  }
}

test('a stream abort signal reaches the transport', async () => {
  const controller = new AbortController()
  const { sent } = recordingClient()
  const frames = new Response('data: {"type":"done"}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })
  const streaming = new HttpClient({
    baseUrl: BASE_URL,
    tokens: emptyStore(),
    fetchImpl: (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      sent.push({ method: request.method, url: request.url, headers: request.headers, signal: request.signal })
      return Promise.resolve(frames)
    },
  })

  await drain(
    streaming.stream('chat.messages.stream', {
      params: { threadId: '00000000-0000-4000-8000-000000000001' },
      body: { content: 'Which segments are churning?' },
      signal: controller.signal,
    }),
  )

  assert.equal(sent.length, 1)
  assert.equal(sent[0].signal.aborted, false, 'the stream starts un-aborted')

  controller.abort()
  assert.equal(sent[0].signal.aborted, true, 'aborting the caller signal must abort the stream Request')
})

test('a signal aborted before the call rejects without reaching the network', async () => {
  const controller = new AbortController()
  controller.abort()

  const { client, sent, received } = recordingClient()
  await assert.rejects(
    client.call('auth.signIn', { body: VALID_BODIES['auth.signIn'], signal: controller.signal }),
    /abort/i,
  )
  assert.equal(received(), 1, 'the transport is asked for the request')
  assert.equal(sent.length, 0, 'an already-aborted call must not put bytes on the wire')
})

/**
 * A refresh token store. Records what the client stores so a test can assert that a
 * rotated token actually replaced the previous one — the bug this guards against is
 * silent, since the session simply stops working fifteen minutes later.
 */
function trackingStore(initial = { accessToken: null, refreshToken: 'refresh-one' }) {
  const state = { ...initial }
  return {
    state,
    getAccessToken: () => state.accessToken,
    getRefreshToken: () => state.refreshToken,
    setAccessToken: (token) => {
      state.accessToken = token
    },
    setRefreshToken: (token) => {
      state.refreshToken = token
    },
    clear: () => {
      state.accessToken = null
      state.refreshToken = null
    },
  }
}

test('a 401 refresh replaces both tokens, because the presented one was consumed', async () => {
  const tokens = trackingStore()
  const requests = []
  const client = new HttpClient({
    baseUrl: BASE_URL,
    tokens,
    fetchImpl: (input) => {
      const request = input instanceof Request ? input : new Request(input)
      requests.push(request.url)
      // The first call is rejected; the refresh answers with a rotated pair; the
      // replay of the original call then succeeds.
      if (requests.length === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'unauthenticated', title: 'unauthenticated', status: 401, detail: 'nope' }), {
            status: 401,
            headers: { 'content-type': 'application/problem+json' },
          }),
        )
      }
      if (request.url.includes('/auth/refresh')) {
        return Promise.resolve(
          new Response(JSON.stringify({ accessToken: 'access-two', refreshToken: 'refresh-two', expiresIn: 900, user: {} }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    },
  })

  await client.call('campaigns.list').catch(() => {})

  assert.equal(tokens.state.accessToken, 'access-two', 'the new access token is stored')
  assert.equal(
    tokens.state.refreshToken,
    'refresh-two',
    'the rotated refresh token must replace the consumed one, or the next refresh fails',
  )
})

test('a refresh answer without a rotated token is treated as a failure', async () => {
  const tokens = trackingStore()
  let call = 0
  const client = new HttpClient({
    baseUrl: BASE_URL,
    tokens,
    fetchImpl: () => {
      call += 1
      if (call === 1) {
        return Promise.resolve(
          new Response('{"code":"unauthenticated"}', {
            status: 401,
            headers: { 'content-type': 'application/problem+json' },
          }),
        )
      }
      // A server that does not rotate: the old shape. Storing nothing would leave a
      // revoked token in place, so this must be rejected rather than half-applied.
      return Promise.resolve(
        new Response(JSON.stringify({ accessToken: 'access-two', expiresIn: 900 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    },
  })

  await client.call('campaigns.list').catch(() => {})
  assert.equal(tokens.state.refreshToken, null, 'a failed refresh clears the session')
})

test('refresh is sent to the versioned path', async () => {
  const { client, sent } = recordingClient()
  await client.call('auth.refresh', { body: VALID_BODIES['auth.refresh'] }).catch(() => {})
  assert.equal(sent.length, 1)
  assert.equal(sent[0].method, 'POST')
  assert.ok(sent[0].url.includes(`/api/${API_VERSION}/auth/refresh`), `refresh went to ${sent[0].url}`)
})

/** Builds params from the registry's own `params` schema, not by parsing the path. */
function pathParamsFor(spec) {
  if (spec.params === undefined) return undefined
  const params = Object.fromEntries(Object.keys(spec.params.def.shape).map((name) => [name, '00000000-0000-4000-8000-000000000001']))
  const parsed = spec.params.safeParse(params)
  assert.ok(parsed.success, `fixture params for ${spec.path} do not match its schema: ${parsed.error?.message}`)
  return params
}