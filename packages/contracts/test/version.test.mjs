import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  API_VERSION,
  API_VERSION_PREFIX,
  DEPRECATION_HEADER,
  SUNSET_HEADER,
  deprecationHeaders,
  findOperation,
  operations,
  streamingOperations,
  versionedPath,
} from '../dist/index.js'

/**
 * The version policy is only useful if the client, the server and the generated
 * specification all read it from here, so these rules are asserted directly.
 */

describe('versioned paths', () => {
  it('puts the version in the path rather than a header', () => {
    assert.equal(API_VERSION, 'v1')
    assert.equal(API_VERSION_PREFIX, '/v1')
    assert.equal(versionedPath('/customers'), '/v1/customers')
    assert.equal(versionedPath('customers'), '/v1/customers')
  })
})

const REGISTRY = {
  'things.live': { method: 'GET', path: '/things' },
  'things.old': { method: 'POST', path: '/things/legacy', deprecated: true },
  'things.removing': {
    method: 'DELETE',
    path: '/things/legacy/:id',
    deprecated: true,
    sunset: 'Wed, 01 Jan 2027 00:00:00 GMT',
  },
}

describe('finding the operation behind a route', () => {
  it('matches on method and path', () => {
    assert.equal(findOperation(REGISTRY, 'get', '/things')?.method, 'GET')
    assert.equal(findOperation(REGISTRY, 'POST', '/things/legacy')?.deprecated, true)
  })

  it('returns nothing for a route outside the documented API', () => {
    assert.equal(findOperation(REGISTRY, 'GET', '/unknown'), undefined)
    assert.equal(findOperation(REGISTRY, 'PATCH', '/things'), undefined)
  })

  it('finds every documented operation of the real API', () => {
    const all = [...Object.values(operations), ...Object.values(streamingOperations)]
    for (const operation of all) {
      assert.ok(findOperation({ ...operations, ...streamingOperations }, operation.method, operation.path) !== undefined)
    }
  })
})

describe('deprecation signalling', () => {
  it('says nothing about an operation that is not deprecated', () => {
    assert.deepEqual(deprecationHeaders(findOperation(REGISTRY, 'GET', '/things')), {})
    assert.deepEqual(deprecationHeaders(undefined), {})
  })

  it('marks a deprecated operation even without a removal date', () => {
    assert.deepEqual(deprecationHeaders(findOperation(REGISTRY, 'POST', '/things/legacy')), {
      [DEPRECATION_HEADER]: 'true',
    })
  })

  it('publishes the sunset date when one is known', () => {
    assert.deepEqual(deprecationHeaders(findOperation(REGISTRY, 'DELETE', '/things/legacy/:id')), {
      [DEPRECATION_HEADER]: 'true',
      [SUNSET_HEADER]: 'Wed, 01 Jan 2027 00:00:00 GMT',
    })
  })

  it('declares a sunset date only on a deprecated operation', () => {
    for (const operation of [...Object.values(operations), ...Object.values(streamingOperations)]) {
      if (operation.sunset !== undefined) assert.equal(operation.deprecated, true)
    }
  })
})
