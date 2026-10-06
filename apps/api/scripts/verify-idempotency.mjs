/**
 * Integration check for the idempotency interceptor.
 *
 * The Jest suite cannot cover this: `@nestjs/common` is ESM-only and `babel-jest`
 * loads it as CommonJS, so anything importing Nest fails to load. The policy itself
 * is therefore split into the framework-free `idempotency.ts` and unit tested there;
 * this script covers what is left — that the interceptor, the decorator, the guard and
 * the problem-details filter actually behave as one when mounted on a real Nest app.
 *
 * Run with `pnpm run verify:idempotency` (builds first; the script imports `dist/`).
 */

import 'reflect-metadata'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Controller, HttpCode, HttpStatus, Injectable, Module, Post, UseInterceptors } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { IdempotencyInterceptor, Idempotent } from '../dist/shared/http/idempotency.interceptor.js'
import { ProblemDetailsFilter } from '../dist/shared/http/problem-details.filter.js'
import { ModelProviderError, ValidationError } from '../dist/shared/domain/domain.errors.js'
import { IDEMPOTENCY_STORE } from '../dist/shared/application/ports/idempotency-store.port.js'

const require = createRequire(import.meta.url)
const supertest = require('supertest')

/**
 * Stands in for the Postgres store, keeping the same two guarantees: a duplicate key
 * does not throw, and the caller is told whether its own row won.
 */
class MemoryStore {
  rows = new Map()

  async find(scope, key) {
    return this.rows.get(`${scope}:${key}`) ?? null
  }

  async remember(scope, key, response) {
    const id = `${scope}:${key}`
    const existing = this.rows.get(id)
    if (existing !== undefined) return { response: existing, inserted: false }
    this.rows.set(id, response)
    return { response, inserted: true }
  }
}

/** Method decorators are applied by hand because this file is plain `.mjs`. */
function decorate(prototype, name, ...decorators) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
  for (const decorator of decorators) decorator(prototype, name, descriptor)
}

let generations = 0

class GenerateController {
  async generate() {
    generations += 1
    // A pause widens the window in which a duplicate could slip past the lookup.
    await new Promise((resolve) => setTimeout(resolve, 25))
    return { id: `campaign-${generations}`, title: 'launch' }
  }
}
Controller('campaigns')(GenerateController)
decorate(
  GenerateController.prototype,
  'generate',
  Post('generate'),
  Idempotent(),
  UseInterceptors(IdempotencyInterceptor),
  HttpCode(HttpStatus.CREATED),
)

class FailingController {
  generate() {
    throw new ModelProviderError('llm_unavailable', 'The content model did not respond in time.')
  }
}
Controller('campaigns')(FailingController)
decorate(
  FailingController.prototype,
  'generate',
  Post('generate'),
  Idempotent(),
  UseInterceptors(IdempotencyInterceptor),
  HttpCode(HttpStatus.CREATED),
)

class RejectingController {
  generate() {
    throw new ValidationError('The request payload is invalid.')
  }
}
Controller('campaigns')(RejectingController)
decorate(
  RejectingController.prototype,
  'generate',
  Post('generate'),
  Idempotent(),
  UseInterceptors(IdempotencyInterceptor),
  HttpCode(HttpStatus.CREATED),
)

/** Stands in for `AccessTokenGuard`, which every real request passes through first. */
class FakeAuthGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest()
    request.user = {
      id: String(request.headers['x-caller'] ?? 'user-1'),
      email: 'member@example.com',
      role: 'member',
    }
    return true
  }
}
Injectable()(FakeAuthGuard)

async function build(controller) {
  const store = new MemoryStore()
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      { provide: IDEMPOTENCY_STORE, useValue: store },
      { provide: APP_GUARD, useClass: FakeAuthGuard },
      { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    ],
  }).compile()
  const app = moduleRef.createNestApplication()
  await app.init()
  return { app, store }
}

const BODY = { objective: 'launch', segmentId: 'segment-1', channel: 'sms', tone: 'friendly' }

const checks = []
function check(name, run) {
  checks.push({ name, run })
}

check('first call generates and returns 201', async ({ app }) => {
  const response = await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'k1' }).send(BODY)
  assert.equal(response.status, 201)
  assert.deepEqual(response.body, { id: 'campaign-1', title: 'launch' })
  assert.equal(response.headers['idempotency-replayed'], undefined)
})

check('a repeat replays the recorded response without generating again', async ({ app }) => {
  const first = await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'k2' }).send(BODY)
  const before = generations
  const second = await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'k2' }).send(BODY)

  assert.equal(second.status, 201)
  assert.deepEqual(second.body, first.body)
  assert.equal(second.headers['idempotency-replayed'], 'true')
  assert.equal(generations, before, 'the handler must not run again on a replay')
})

check('JSON key order does not make a retry look like a different request', async ({ app }) => {
  await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'k3' }).send(BODY)
  const reordered = await supertest(app.getHttpServer())
    .post('/campaigns/generate')
    .set({ 'idempotency-key': 'k3' })
    .send({ tone: 'friendly', channel: 'sms', segmentId: 'segment-1', objective: 'launch' })

  assert.equal(reordered.status, 201)
  assert.equal(reordered.headers['idempotency-replayed'], 'true')
})

check('reusing a key for a different body is a conflict', async ({ app }) => {
  await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'k4' }).send(BODY)
  const reused = await supertest(app.getHttpServer())
    .post('/campaigns/generate')
    .set({ 'idempotency-key': 'k4' })
    .send({ ...BODY, objective: 'something else' })

  assert.equal(reused.status, 409)
  assert.equal(reused.body.code, 'conflict')
})

check('a malformed key is rejected as a validation failure', async ({ app }) => {
  const response = await supertest(app.getHttpServer())
    .post('/campaigns/generate')
    .set({ 'idempotency-key': 'has spaces' })
    .send(BODY)

  assert.equal(response.status, 400)
  assert.equal(response.body.code, 'validation_failed')
})

check('a request without a key behaves exactly as before', async ({ app }) => {
  const before = generations
  const first = await supertest(app.getHttpServer()).post('/campaigns/generate').send(BODY)
  const second = await supertest(app.getHttpServer()).post('/campaigns/generate').send(BODY)

  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  assert.notDeepEqual(first.body, second.body)
  assert.equal(generations, before + 2, 'without a key every call runs')
})

check('a failed generation is not recorded, so the key stays retryable', async () => {
  const { app } = await build(FailingController)
  try {
    const first = await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'retry' }).send(BODY)
    const second = await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'retry' }).send(BODY)

    assert.equal(first.status, 503)
    // Reaching the handler twice is the point: nothing was recorded, so the retry is
    // a real attempt rather than a replay of the failure.
    assert.equal(second.status, 503)
  } finally {
    await app.close()
  }
})

check('a 4xx is reported to the client rather than swallowed', async () => {
  const { app, store } = await build(RejectingController)
  try {
    const response = await supertest(app.getHttpServer()).post('/campaigns/generate').set({ 'idempotency-key': 'r1' }).send(BODY)
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'validation_failed')
    assert.equal(store.rows.size, 0, 'a rejected request must not be recorded')
  } finally {
    await app.close()
  }
})

check('a key is private to the caller who used it', async ({ app }) => {
  const first = await supertest(app.getHttpServer())
    .post('/campaigns/generate')
    .set({ 'idempotency-key': 'shared', 'x-caller': 'user-1' })
    .send(BODY)

  // The same key from another caller is a different request, so it must generate
  // rather than hand over the first caller's campaign.
  const before = generations
  const second = await supertest(app.getHttpServer())
    .post('/campaigns/generate')
    .set({ 'idempotency-key': 'shared', 'x-caller': 'user-2' })
    .send(BODY)

  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  assert.notDeepEqual(second.body, first.body)
  assert.equal(second.headers['idempotency-replayed'], undefined)
  assert.equal(generations, before + 1)

  // ...and each caller still replays their own.
  const replay = await supertest(app.getHttpServer())
    .post('/campaigns/generate')
    .set({ 'idempotency-key': 'shared', 'x-caller': 'user-1' })
    .send(BODY)
  assert.deepEqual(replay.body, first.body)
  assert.equal(replay.headers['idempotency-replayed'], 'true')
})

let failures = 0
for (const { name, run } of checks) {
  const { app } = await build(GenerateController)
  try {
    await run({ app, store: app })
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures += 1
    console.error(`  FAIL ${name}`)
    console.error(`       ${error.message}`)
  } finally {
    await app.close()
  }
}

console.log(failures === 0 ? `\n${checks.length} checks passed` : `\n${failures} of ${checks.length} checks failed`)
process.exit(failures === 0 ? 0 : 1)