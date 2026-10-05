# Configuration

Every variable the API reads, its default, and what happens when it is wrong.
Read at boot by `apps/api/src/config/env.ts`; the process refuses to start on an
invalid value rather than failing later inside an adapter.

## Server

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | TCP port, 1–65535. |
| `API_PREFIX` | `api` | First path segment. Exists so the API can share an origin with the static web app. |
| `API_VERSION` | — | Taken from the contract package (`v1`). Set explicitly only when running a deployment that speaks a different version. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins. Credentials are enabled, so `*` is not accepted. |
| `NODE_ENV` | `development` | `development`, `test` or `production`. |

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
| `ANTHROPIC_API_KEY` | empty | When empty, the deterministic local generator is used and a warning is logged. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Model identifier for generation. |
| `ANTHROPIC_MAX_TOKENS` | `1024` | Upper bound on a single generation. |

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
