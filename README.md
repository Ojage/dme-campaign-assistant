# Campaign Assistant

An internal marketing workspace for DME: segment a customer base, draft a campaign
with a language model, review it, and ask questions about the data in a chat.

The interesting part is not the screens. It is that the browser and the API agree
on every request and response because both import **one** contract package, and that
the published API reference is generated from that same contract — so it cannot
describe an endpoint that does not exist.

```
apps/web                React 19 · Vite · Zustand · TanStack Query
apps/api                NestJS · TypeORM · PostgreSQL · Anthropic / OpenCode
packages/contracts      zod schemas · typed client · OpenAPI generator
```

## Quick start

```bash
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm db:up          # PostgreSQL in Docker
pnpm seed            # two accounts, 280 customers, two segments
pnpm dev             # API on :4000, web app on :5173
```

Sign in with `aicha.njoya@dme.cm` / `campaigns`.

Then follow **[Your first campaign](docs/tutorials/first-campaign.md)** — about ten
minutes from a cold start to a drafted campaign.

The API reference is at <http://localhost:4000/api/docs>.

## Documentation

Documentation is organised by
[Diátaxis](https://diataxis.fr), because the four kinds of document answer different
questions and only work when kept apart. Start at **[docs/README.md](docs/README.md)**.

| | |
| --- | --- |
| [Tutorial](docs/tutorials/first-campaign.md) | From nothing to a drafted campaign. Learning-oriented. |
| [How-to](docs/how-to/) | Add a customer, build a segment, generate a campaign, add an endpoint. |
| [Reference](docs/reference/api.md) | [API](docs/reference/api.md) · [configuration](docs/reference/configuration.md) · [scripts](docs/reference/scripts.md) · [errors](docs/reference/errors.md) |
| [Explanation](docs/explanation/architecture.md) | [Architecture](docs/explanation/architecture.md) · [contracts](docs/explanation/contracts.md) · [versioning](docs/explanation/api-versioning.md) · [auth](docs/explanation/authentication.md) · [state](docs/explanation/state.md) · [generation](docs/explanation/generative-pipeline.md) |

## The API

Versioned in the path, documented by generation:

- `/api/v1/...` — every endpoint. An unversioned path is a 404, not a fallback.
- `/api/openapi.json` — the OpenAPI 3.1 description.
- `/api/docs` — Swagger UI over that description, served from the installed
  package rather than a CDN.
- `x-api-version` on every response.

The specification is generated from the operation registry in
`packages/contracts/src/http/api.ts` by `buildOpenApiDocument()`. Adding a
registry entry gives you a typed client method, the request and response types, and
the documented endpoint at once. `packages/contracts/test/openapi.test.mjs` asserts
the document and the registry still agree.

Regenerate the committed snapshot with `pnpm openapi:write`.

## Development

```bash
pnpm typecheck        # contracts, API and web app
pnpm test             # every suite
pnpm build            # all three packages
pnpm openapi:write    # refresh docs/reference/openapi.json
```

Conventions the codebase holds to:

- **No `any`.** The boundary is already typed and runtime-checked, so the
  application code has no excuse for casting.
- **The contract is the contract.** No hand-written response interfaces; the
  registry entry is the type.
- **Framework types stop at the controller.** Use cases depend on ports, not on
  TypeORM.
- **Comments explain why.** What the code does is legible; why it is shaped that
  way is not.

## Without a model key

`ANTHROPIC_API_KEY` and `OPENCODE_API_KEY` are both optional, and neither is
required: with no key the API uses a deterministic local generator that implements
the same port, so the whole application — including streaming chat — works offline
and in tests. The provider and model actually in use are logged at boot; set
`MODEL_PROVIDER` to pin one explicitly. See
[run without a model key](docs/how-to/run-without-a-model-key.md).

## Requirements

Node ≥ 20.19, pnpm ≥ 9, Docker (for PostgreSQL).