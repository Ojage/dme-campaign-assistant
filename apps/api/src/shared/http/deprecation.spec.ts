import { apiRegistry, responseHeadersFor } from './deprecation'
import { operations, streamingOperations } from '@dme/contracts'

/**
 * The registry is the single source of truth for deprecation, so these tests check
 * both directions: headers are emitted when the registry says an operation is
 * deprecated, and stay silent for a live or undocumented route.
 */

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

describe('the documented API', () => {
  it('covers every operation, streaming included', () => {
    expect(Object.keys(apiRegistry)).toHaveLength(Object.keys(operations).length + Object.keys(streamingOperations).length)
  })

  it('carries no deprecation headers today', () => {
    const marked = Object.values(apiRegistry).filter((operation) => operation.deprecated === true)
    expect(marked).toEqual([])
  })
})

describe('a live operation', () => {
  it('gets no headers', () => {
    expect(responseHeadersFor({ method: 'GET', routePath: '/things' }, REGISTRY)).toEqual({})
  })
})

describe('a deprecated operation', () => {
  it('is marked deprecated', () => {
    expect(responseHeadersFor({ method: 'POST', routePath: '/things/legacy' }, REGISTRY)).toEqual({
      deprecation: 'true',
    })
  })

  it('publishes the sunset date when the registry declares one', () => {
    expect(responseHeadersFor({ method: 'DELETE', routePath: '/things/legacy/:id' }, REGISTRY)).toEqual({
      deprecation: 'true',
      sunset: 'Wed, 01 Jan 2027 00:00:00 GMT',
    })
  })

  it('matches the method, not just the path', () => {
    expect(responseHeadersFor({ method: 'GET', routePath: '/things/legacy' }, REGISTRY)).toEqual({})
  })
})

describe('a route that is not part of the documented API', () => {
  it('stays silent', () => {
    expect(responseHeadersFor({ method: 'GET', routePath: '/internal/metrics' }, REGISTRY)).toEqual({})
  })

  it('stays silent when the request never reached a route', () => {
    expect(responseHeadersFor({ method: 'GET' }, REGISTRY)).toEqual({})
  })

  it('falls back to the request path when there is no route pattern', () => {
    expect(responseHeadersFor({ method: 'POST', path: '/api/v1/things/legacy' }, REGISTRY)).toEqual({})
  })
})

describe('the real API', () => {
  it('answers every documented route without deprecation headers', () => {
    for (const operation of Object.values(apiRegistry)) {
      expect(responseHeadersFor({ method: operation.method, routePath: operation.path })).toEqual({})
    }
  })
})