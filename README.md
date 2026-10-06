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

Then follow **[Your first campaign](docs/tutorials/first-campaign.mdx)** — about ten
minutes from a cold start to a drafted campaign.

A hosted, always-current copy of the documentation is published with Mintlify from
this `docs/` folder — every push to the default branch redeploys it.

The API reference is at <http://localhost:4000/api/docs>.

## Documentation

Documentation is organised by
[Diátaxis](https://diataxis.fr), because the four kinds of document answer different
questions and only work when kept apart. Start at **[docs/README.md](docs/README.md)**.

| | |
| --- | --- |
| [Tutorial](docs/tutorials/first-campaign.mdx) | From nothing to a drafted campaign. Learning-oriented. |
| [How-to](docs/how-to/) | Add a customer, build a segment, generate a campaign, add an endpoint, add an LLM provider. |
| [Reference](docs/reference/conventions.mdx) | [Conventions](docs/reference/conventions.mdx) · [configuration](docs/reference/configuration.mdx) · [scripts](docs/reference/scripts.mdx) · [errors](docs/reference/errors.mdx) |
| [Explanation](docs/explanation/architecture.mdx) | [Architecture](docs/explanation/architecture.mdx) · [contracts](docs/explanation/contracts.mdx) · [versioning](docs/explanation/api-versioning.mdx) · [auth](docs/explanation/authentication.mdx) · [state](docs/explanation/state.mdx) · [generation](docs/explanation/generative-pipeline.mdx) |

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

`OPENCODE_API_KEY`, `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` are all optional, and
none is required: with no key the API uses a deterministic local generator that
implements the same port, so the whole application — including streaming chat —
works offline and in tests. The provider and model actually in use are logged at
boot; set `MODEL_PROVIDER` to pin one explicitly. See
[run without a model key](docs/how-to/run-without-a-model-key.mdx).

## Requirements

Node ≥ 20.19, pnpm ≥ 9, Docker (for PostgreSQL).

## AI usage

This project was built with AI assistance, and it also ships its own AI features.
Those are two different things, and this section covers both honestly.

### Which AI tools were used

To build the project:

- **opencode** — a terminal-based AI coding agent (powered by the *big-pickle*
  model) used across the whole repository: the API modules, the React app, the
  shared contracts package, the Docker/CI infrastructure, and this documentation.

The product itself runs hosted models at runtime — OpenAI-compatible gateways
(Anthropic, Gemini, OpenCode Zen) or a deterministic local generator with no key.
That is a shipped feature, not a development tool, and is covered below in
[Without a model key](#without-a-model-key).

### What they were used for

- Implementing features end to end: the five brief requirements — dashboard KPIs,
  the segment condition builder, the campaign form tied to a segment, AI campaign
  output, and the AI service-layer separation — plus auth, streaming chat,
  idempotency and error boundaries.
- Writing the documentation set in `docs/` and this README.
- Infrastructure: Dockerfiles, compose files, CI workflows, and the production
  deploy pipeline.
- Debugging: reproducing provider failures against real gateways and diagnosing
  machine-level causes — for example a dead IPv6 route that made Node's fetch time
  out while `curl` succeeded.

### Where an AI-generated suggestion was modified

The first draft of the assistant's system prompt described the company as "a bank
in Cameroon." That framing was wrong — DME is a software company that provides
digital marketing to clients in banking, sports, betting and other industries,
and is not itself a bank. The suggestion was rejected and rewritten: the prompts
now state DME's role explicitly, and the "never invent" guardrail was changed from
banking terms ("account numbers, balances, interest rates") to neutral ones
("customer names, figures, fees"). See `campaign.use-cases.ts` and
`chat.use-cases.ts`.

A second example: the default Gemini model was initially `gemini-2.5-flash`. The
gateway answered `404` saying that model was retired, so the default moved to
`gemini-3.8-flash` — the replacement the gateway itself suggested — and the change
was covered by tests.

### How AI-generated code was verified

- **Type checking.** `pnpm typecheck` compiles the contracts, API and web app;
  the boundary is typed and the codebase holds `no-any`.
- **Tests.** `pnpm test` runs the jest suites — domain rules, use cases, the AI
  adapters, request validation, idempotency: 13 suites, ~200 tests.
- **Builds.** `pnpm build` produces production builds for all three packages, and
  CI additionally builds both Docker images so Dockerfile drift fails before it
  ships.
- **Contract enforcement.** Both halves of the wire import the same zod schemas,
  so an AI-written change cannot make the client and server disagree without
  failing compilation.
- **CI on every push.** Typecheck, tests, build and an OpenAPI drift check
  (`pnpm openapi:write` plus `git diff --exit-code`) gate `main`.
- **Runtime checks.** Boot logs state which model is bound; failure paths were
  reproduced live (the `UND_ERR_CONNECT_TIMEOUT` chain and the retired-model
  `404`), and the error boundary UI was smoke-tested against a running dev server.
- **Human review.** Every commit was reviewed as a diff before it was pushed.