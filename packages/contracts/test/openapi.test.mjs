import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOpenApiDocument,
  errorCodeStatus,
  operations,
  operationsByTag,
  streamingOperations,
  versionedPath,
} from '../dist/http/index.js'

/**
 * Invariants the generated specification must satisfy.
 *
 * These are the failure modes a reader would actually notice: a missing
 * endpoint, an undocumented failure, a reference that points nowhere. The
 * document is generated, so it cannot be wrong about the schema shapes — but it
 * can be wrong about coverage, which is what is asserted here.
 */

const document = buildOpenApiDocument({ serverUrl: '/api/v1' })
const paths = document.paths
const components = document.components

test('declares OpenAPI 3.1 with a title and a version', () => {
  assert.equal(document.openapi, '3.1.0')
  assert.equal(document.info.version, 'v1')
  assert.ok(document.info.title.length > 0)
})

test('serves itself at the deployment URL', () => {
  assert.deepEqual(document.servers, [{ url: '/api/v1', description: 'This deployment' }])
})

test('every registered operation appears exactly once', () => {
  const declared = Object.entries({ ...operations, ...streamingOperations }).flatMap(([name, spec]) => {
    const path = versionedPath(spec.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}'))
    const method = spec.method.toLowerCase()
    return [{ name, path, method }]
  })

  assert.equal(declared.length, 24)

  for (const { name, path, method } of declared) {
    const entry = paths[path]
    assert.ok(entry, `missing path ${path} for ${name}`)
    assert.ok(entry[method], `missing ${method.toUpperCase()} ${path} for ${name}`)
    assert.equal(entry[method].operationId, name, `operationId mismatch on ${name}`)
  }
})

test('operation paths are versioned and templated, never Express-style', () => {
  for (const [path, item] of Object.entries(paths)) {
    assert.ok(path.startsWith('/v1/'), `${path} is missing its version segment`)
    assert.doesNotMatch(path, /:[A-Za-z]/, `${path} still uses Express parameter syntax`)
    for (const operation of Object.values(item)) {
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in === 'path') {
          assert.ok(path.includes(`{${parameter.name}}`), `${parameter.name} is not in ${path}`)
          assert.equal(parameter.required, true)
        }
      }
    }
  }
})

test('every operation documents a summary, a tag and a 200 response', () => {
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const where = `${method.toUpperCase()} ${path}`
      assert.ok(operation.summary?.length > 0, `${where} has no summary`)
      assert.ok(operation.tags?.length > 0, `${where} has no tag`)
      assert.ok(operation.responses['200'], `${where} has no 200 response`)
    }
  }
})

test('authenticated operations require a bearer token, public ones do not', () => {
  for (const [name, spec] of Object.entries({ ...operations, ...streamingOperations })) {
    const entry = paths[versionedPath(spec.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}'))][spec.method.toLowerCase()]
    if (spec.auth) {
      assert.deepEqual(entry.security, [{ bearerAuth: [] }], `${name} is missing bearer security`)
      assert.ok(entry.responses['401'], `${name} can answer 401 but does not document it`)
    } else {
      assert.deepEqual(entry.security, [], `${name} should be reachable without a token`)
    }
  }
})

test('every declared error code is documented with its status and problem schema', () => {
  for (const [name, spec] of Object.entries({ ...operations, ...streamingOperations })) {
    const entry = paths[versionedPath(spec.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}'))][spec.method.toLowerCase()]
    for (const code of spec.errors ?? []) {
      const status = String(errorCodeStatus[code])
      assert.ok(entry.responses[status], `${name} can fail with ${code} (${status}) but does not document it`)
      const schema = entry.responses[status].content['application/problem+json'].schema
      assert.deepEqual(schema, { $ref: '#/components/schemas/Problem' })
    }
    // Any endpoint can fail unexpectedly, so that case is always documented.
    assert.ok(entry.responses['500'], `${name} does not document a 500`)
  }
})

test('the streaming operation is described as an event stream', () => {
  const stream = paths['/v1/chat/threads/{threadId}/messages/stream'].post
  assert.ok(stream.responses['200'].content['text/event-stream'], 'stream must advertise text/event-stream')
  assert.equal(stream.requestBody.content['application/json'].schema.type, 'object')
})

test('request bodies accept input shapes, responses declare output shapes', () => {
  const create = paths['/v1/customers'].post
  const body = create.requestBody.content['application/json'].schema
  assert.ok(body.required.includes('email'), 'email must be required')
  assert.ok(body.required.includes('name'))
  assert.equal(body.properties.status.enum.length, 3)

  const list = paths['/v1/customers'].get
  const response = list.responses['200'].content['application/json'].schema
  for (const field of ['items', 'total', 'page', 'limit']) {
    assert.ok(field in response.properties, `the page envelope must document ${field}`)
  }
})

test('pagination and filter parameters are described as optional query parameters', () => {
  const parameters = paths['/v1/customers'].get.parameters
  const byName = Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter]))
  assert.equal(byName.page.in, 'query')
  assert.equal(byName.page.required, false, 'page has a default, so it is optional')
  assert.equal(byName.search.required, false)
  assert.equal(byName.limit.schema.maximum, 200)
})

test('the shared problem document and error codes are described once', () => {
  assert.ok(components.schemas.Problem.properties.code)
  assert.ok(components.schemas.Problem.properties.traceId)
  assert.ok(components.schemas.ErrorCode.enum.includes('not_found'))
  assert.ok(components.headers.ApiVersion.schema.const === 'v1')
})

test('every internal reference resolves', () => {
  const references = []
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
    } else if (node !== null && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string') references.push(value)
        else walk(value)
      }
    }
  }
  walk(document)

  assert.ok(references.length > 0, 'expected the document to use references')
  for (const reference of references) {
    const pointer = reference.replace(/^#\//, '').split('/')
    let node = document
    for (const segment of pointer) node = node?.[segment]
    assert.ok(node !== undefined, `dangling reference: ${reference}`)
  }
})

test('no embedded schema declares its own JSON Schema dialect', () => {
  const walk = (node, path = '') => {
    if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${path}/${index}`))
    if (node === null || typeof node !== 'object') return
    assert.equal(node.$schema, undefined, `$schema leaked into ${path}`)
    Object.entries(node).forEach(([key, value]) => walk(value, `${path}/${key}`))
  }
  walk(document)
})

test('the operations can be listed per tag for the written reference', () => {
  const grouped = operationsByTag()
  assert.deepEqual(Object.keys(grouped).sort(), ['Authentication', 'Campaigns', 'Chat', 'Customers', 'Search', 'Segments'])
  assert.equal(grouped.Chat.length, 6)
  assert.equal(grouped.Search.length, 1)
})