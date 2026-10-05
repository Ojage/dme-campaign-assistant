# Scripts

Run from the repository root.

## Day to day

| Command | Does |
| --- | --- |
| `pnpm install` | Installs every workspace. |
| `pnpm seed` | Compiles the seed script and fills the database. Idempotent. |
| `pnpm dev:api` | API with reload on change. |
| `pnpm dev:web` | Vite dev server on 5173, proxying `/api` to the API. |
| `pnpm dev` | Both of the above. |

## Checks

| Command | Does |
| --- | --- |
| `pnpm typecheck` | Typechecks contracts, API and web app. |
| `pnpm build` | Builds all three in dependency order. |
| `pnpm test` | Runs every test suite. |
| `pnpm openapi:write` | Regenerates `docs/reference/openapi.json`. Run after any contract change. |

## Infrastructure

| Command | Does |
| --- | --- |
| `docker compose up -d postgres` | Starts PostgreSQL. |
| `docker compose down -v` | Stops it and deletes the volume — every customer is lost. |

## Per package

Each package is a workspace, so its own scripts work too:

```bash
pnpm --filter @dme/contracts test       # specification invariants (node:test)
pnpm --filter @dme/api test             # domain and HTTP unit tests (jest)
pnpm --filter @dme/api build:seed       # compile the seed script only
pnpm --filter @dme/web build            # production web build
```

## How the tests are run

The API compiles to CommonJS, so its tests run on Jest. TypeScript 7 is a native
compiler and does not expose the JavaScript compiler API that `ts-jest` needs, so
`babel.config.cjs` transforms test files and `pnpm typecheck` does the type
checking — the two responsibilities are separate, and types are checked over test
files too because `tsconfig.json` includes `src/**/*.ts`.

Contracts are ESM and use the built-in test runner instead:

```bash
pnpm --filter @dme/contracts test
```

It imports from `dist/`, so build first — `pnpm build` or
`pnpm --filter @dme/contracts build`.

## What CI should run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Then assert that `pnpm openapi:write` leaves no diff: a specification that changed
without being committed is an unreviewed contract change.
