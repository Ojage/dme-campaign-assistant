# Configuration

Every variable the API reads, its default, and what happens when it is wrong.
Read at boot by `apps/api/src/config/env.ts`; the process refuses to start on an
invalid value rather than failing later inside an adapter.

## Server

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | TCP port, 1–65535. |
| `API_PREFIX` | `api` | First path segment. Exists so the API can share an origin with the static web app. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins. Credentials are enabled, so `*` is not accepted. |
| `NODE_ENV` | `development` | `development`, `test` or `production`. |

The API version is not an environment variable: `API_VERSION` in
`packages/contracts/src/http/version.ts` is the single constant that versions the
URL prefix, the client, the response header and the generated specification. It
changes when the API version changes, in one place.

## Database

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_HOST` | required | Host name. Use `127.0.0.1`, not `localhost`, when PostgreSQL runs in a container: `localhost` resolves to IPv6 first on some hosts. |
| `DATABASE_PORT` | `5432` | Published port of the container (`docker-compose.yml` publishes 5433). |
| `DATABASE_NAME` | required | Database name. |
| `DATABASE_USER` | required | Role. |
| `DATABASE_PASSWORD` | required | Password. May be empty for trust authentication. |
| `DATABASE_SSL` | `false` | `true` for a managed database in production. |

## Authentication

| Variable | Default | Meaning |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | required, ≥16 chars | Signing secret for access tokens. |
| `JWT_REFRESH_SECRET` | required, ≥16 chars | Separate secret for refresh tokens, so a leaked access-token secret cannot mint refresh tokens. |
| `JWT_ACCESS_TTL` | `900` | Access token lifetime in seconds (15 minutes). |
| `JWT_REFRESH_TTL` | `604800` | Refresh token lifetime in seconds (7 days). |

Rotating either secret invalidates the tokens signed with it. Refresh tokens are
additionally revoked in the database on rotation, so a stolen token is usable at
most once. See [sessions](../explanation/authentication.md).

## Model provider

| Variable | Default | Meaning |
| --- | --- | --- |
| `MODEL_PROVIDER` | `auto` | `auto`, `anthropic`, `opencode` or `scripted`. `auto` takes the first provider whose key is set, in that order. |
| `ANTHROPIC_API_KEY` | empty | Key for Anthropic. Empty rules the provider out. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Model identifier for generation. |
| `ANTHROPIC_MAX_TOKENS` | `1024` | Upper bound on a single generation. |
| `OPENCODE_API_KEY` | empty | Key for OpenCode Zen. Empty rules the provider out. |
| `OPENCODE_BASE_URL` | `https://opencode.ai/zen/v1` | Gateway root; `/chat/completions` is appended. Point it at any OpenAI-compatible gateway. |
| `OPENCODE_MODEL` | `glm-5.2` | Model identifier. Only the `/chat/completions` family is supported. |
| `OPENCODE_MAX_TOKENS` | `1024` | Upper bound on a single generation. |

### Timeouts and retries

A generation is a network call to someone else's server, so it is bounded and
repeated rather than left to hang.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_TIMEOUT_MS` | `60000` | Deadline for one Anthropic call. |
| `OPENCODE_TIMEOUT_MS` | `60000` | Deadline for one OpenCode call. |
| `LLM_RETRY_MAX_ATTEMPTS` | `3` | Total attempts per call, so `3` means one try and two retries. Between 1 and 5. |
| `LLM_RETRY_BASE_DELAY_MS` | `250` | First wait before retrying. |
| `LLM_RETRY_MAX_DELAY_MS` | `4000` | Ceiling the growing wait is capped at. |

Only a transient failure is repeated: a dropped connection, a `429`, a `5xx`, or a
timeout. A rejected key or a malformed request is not, because repeating it cannot
succeed. The wait grows exponentially with the attempt number and is randomised
across `0`–`delay` (full jitter), so several requests that fail together do not all
return at the same instant.

Retries repeat the *same* provider. They never fall back to another one or to the
local generator: silently answering from a different model would hand back a
campaign that does not match what was asked for. When every attempt fails the caller
gets `503` with `llm_unavailable`.

With no key at all, the deterministic local generator answers, and the boot log
says so. Asking for a provider whose key is missing resolves to the generator and
logs the mismatch rather than binding an adapter that would fail on every call:

```
Content model: scripted local model — MODEL_PROVIDER=anthropic was requested but ANTHROPIC_API_KEY is not set
```

## Web app

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Base URL the browser calls. A relative default lets the dev proxy and a same-origin deployment work unchanged. |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Where the dev server proxies `/api`. Development only. |

## Copying the example file

```bash
cp apps/api/.env.example apps/api/.env
```

`.env` is not committed. The example file must stay in step with the schema above;
a variable added to `env.ts` belongs in it.
