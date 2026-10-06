#!/usr/bin/env node
/**
 * Maps the set of changed file paths to the images that must be rebuilt.
 *
 * A deploy that rebuilds everything on every push makes an api-only fix cost a
 * full web build, so the classifier answers one question — did this commit move
 * anything an image is built from? — and nothing else. Paths that only affect
 * runtime configuration (`infra/`, CI plumbing) deliberately rebuild nothing:
 * `docker compose up -d` recreates containers for those, and there is no image
 * layer that could carry them.
 *
 * Reads one path per line from stdin, prints shell assignments on stdout so the
 * caller can `eval` them. `classify` is pure, so it is unit-tested without a
 * container or a git repository.
 */

import { pathToFileURL } from 'node:url'

/** @typedef {{ API: boolean, WEB: boolean, SCHEMA: boolean, ALL: boolean }} BuildPlan */

/** Nothing in these paths ends up inside an image. */
const IGNORED = [
  /^docs\//,
  /^\.github\//,
  /^scripts\//,
  /^infra\//,
  /^data\//,
  /^(README\.md|CHANGELOG\.md|\.gitignore|\.dockerignore|\.editorconfig|\.env\.example|docker-compose\.yml)$/,
]

/**
 * @param {readonly string[]} paths
 * @returns {BuildPlan}
 */
export function classify(paths) {
  /** @type {BuildPlan} */
  /** @type {BuildPlan} */
  const plan = { API: false, WEB: false, SCHEMA: false, ALL: false }
  let unknown = false

  for (const raw of paths) {
    const path = (raw ?? '').trim().replaceAll('\\', '/')
    if (path.length === 0) continue
    if (IGNORED.some((pattern) => pattern.test(path))) continue

    // A workspace manifest moves the dependency tree for every app, so there is
    // nothing safe to reuse: build the lot.
    if (/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc)$/.test(path)) {
      return { API: true, WEB: true, SCHEMA: true, ALL: true }
    }

    if (/^apps\/api\//.test(path)) {
      plan.API = true
      // The API image owns the seed, and the seed is what pushes schema changes.
      plan.SCHEMA = true
    } else if (/^apps\/web\//.test(path)) {
      plan.WEB = true
    } else if (/^packages\/contracts\//.test(path)) {
      // The contracts are imported by both sides, so a change there cannot be
      // attributed to either app by path alone.
      plan.API = true
      plan.WEB = true
    } else {
      unknown = true
    }
  }

  // A path this script does not recognise is a new part of the tree. Rebuilding
  // everything is the only answer that cannot ship an image missing the change.
  if (unknown) return { API: true, WEB: true, SCHEMA: true, ALL: true }

  return plan
}

/** @param {readonly string[]} paths */
export function toShellAssignments(paths) {
  const plan = classify(paths)
  return ['API', 'WEB', 'SCHEMA', 'ALL'].map((key) => `${key}=${plan[key] ? 'true' : 'false'}`)
}

async function readStdin() {
  // Piped input only; an interactive run would otherwise wait forever.
  if (process.stdin.isTTY) return []
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').split('\n')
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const line of toShellAssignments(await readStdin())) console.log(line)
}
