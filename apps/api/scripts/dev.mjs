/**
 * Development runner: compile on change, run on change.
 *
 * `nest start --watch` is unusable in this workspace. TypeScript 7 ships the `tsc`
 * executable only — the programmatic compiler API the Nest CLI reaches for is not
 * available until 7.1 — so the Nest CLI aborts before it compiles anything:
 *
 *   Error  The installed TypeScript version (7.0.2) does not expose the programmatic
 *   compiler API that the Nest CLI requires.
 *
 * The Nest CLI bought us nothing here anyway: `build` is plain `tsc -p tsconfig.build.json`
 * and `nest-cli.json` only points at that same tsconfig. So this runner uses the `tsc`
 * CLI and the Node watcher directly, and no Nest CLI is required to develop the API.
 *
 * Run with `pnpm run dev`.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TSC = path.join(apiRoot, 'node_modules', 'typescript', 'lib', 'tsc.js')
const TSC_PROJECT = 'tsconfig.build.json'
const ENTRY = path.join('dist', 'main.js')

const CODES = {
  tsc: '[36m',
  api: '[32m',
  runner: '[35m',
}
const RESET = '[0m'
const colors = process.stdout.isTTY

const label = (name) =>
  colors ? `${CODES[name] ?? ''}[${name}]${RESET} ` : `[${name}] `

const log = (name, message) => {
  process.stdout.write(`${label(name)}${message}\n`)
}

const children = new Set()

/**
 * Startup failures that cannot be recovered from by saving a file. `node --watch` does
 * not exit when the program under it fails to boot — it prints the error and waits for
 * the next change — so these have to be recognised from the output. Left unchecked, a
 * failed boot leaves a runner that looks alive but serves nothing.
 */
const FATAL = [
  {
    match: /EADDRINUSE/,
    hint: 'another process holds the port. Free it, or start on another: PORT=4100 pnpm run dev',
  },
  {
    match: /The API failed to start/,
    hint: 'the Nest bootstrap rejected startup; see the error above',
  },
  {
    match: /Cannot find module/,
    hint: 'dist is missing or stale; run `pnpm run build` first',
  },
]

/** Forwards a child's stdout/stderr line by line, prefixed and colour-coded. */
function pipe(stream, name, target) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      target.write(`${label(name)}${line}\n`)
      if (name === 'api') {
        const fatal = FATAL.find((candidate) => candidate.match.test(line))
        if (fatal) {
          log('runner', fatal.hint)
          shutdown(1)
        }
      }
    }
  })
  stream.on('end', () => {
    if (buffer.length > 0) {
      target.write(`${label(name)}${buffer}\n`)
    }
  })
}

function start(name, args, { inherit = false } = {}) {
  const child = spawn(process.execPath, args, {
    cwd: apiRoot,
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  children.add(child)

  if (inherit) {
    return child
  }

  pipe(child.stdout, name, process.stdout)
  pipe(child.stderr, name, process.stderr)

  child.on('exit', (code, signal) => {
    children.delete(child)
    const reason = signal ? `signal ${signal}` : `code ${code}`
    log(name, `exited with ${reason}`)
    if (reason === 'code 0') {
      shutdown(0)
    } else {
      shutdown(typeof code === 'number' ? code : 1)
    }
  })

  return child
}

/** Resolves the whole process group once, then stops it. */
let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  for (const child of children) {
    child.kill('SIGTERM')
  }

  // If a child ignores SIGTERM, do not hang the terminal.
  const timer = setTimeout(() => {
    for (const child of children) {
      child.kill('SIGKILL')
    }
    process.exit(code)
  }, 3000)
  timer.unref()

  children.once('close', () => {
    clearTimeout(timer)
    process.exit(code)
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0))
}

/** Compiles once and resolves with the exit code; used to guarantee dist is populated. */
function buildOnce() {
  return new Promise((resolve) => {
    const child = start('tsc', [TSC, '-p', TSC_PROJECT], { inherit: true })
    child.on('exit', (code) => resolve(typeof code === 'number' ? code : 1))
  })
}

log('runner', 'TypeScript 7 exposes no compiler API, so this runner drives the tsc CLI directly.')

const buildCode = await buildOnce()
if (buildCode !== 0) {
  log('runner', `initial build failed with code ${buildCode}; not starting the server`)
  process.exit(buildCode)
}

log('runner', 'initial build succeeded; starting watchers')

start('tsc', [TSC, '-p', TSC_PROJECT, '--watch', '--preserveWatchOutput'])
start('api', ['--watch', '--enable-source-maps', ENTRY])

log('runner', 'watching for changes')