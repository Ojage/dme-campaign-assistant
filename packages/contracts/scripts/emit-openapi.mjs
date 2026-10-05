#!/usr/bin/env node
/**
 * Writes the OpenAPI description to `docs/reference/openapi.json`.
 *
 * The committed file lets reviewers see a specification change in a diff, and
 * lets external tooling consume the contract without starting the API. It is
 * generated output: never edit it by hand, run `pnpm openapi:write` instead.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpenApiDocument, operations, operationsByTag, streamingOperations } from '../dist/http/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', '..', '..', 'docs', 'reference', 'openapi.json')

const document = buildOpenApiDocument({
  serverUrl: 'http://localhost:4000/api/v1',
  title: 'Campaign Assistant API',
})

await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

const count = Object.keys({ ...operations, ...streamingOperations }).length
const perTag = Object.entries(operationsByTag())
  .map(([tag, ops]) => `  ${tag}: ${ops.length}`)
  .join('\n')

console.log(`Wrote ${Object.keys(document.paths).length} paths / ${count} operations to ${target}`)
console.log(perTag)