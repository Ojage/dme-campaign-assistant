# Deployment

The Campaign Assistant runs on the same VPS as NNACT Pro. NNACT's Caddy
container owns ports 80 and 443 there, so it also publishes this project's two
hostnames and this repo ships **no reverse proxy of its own**:

| Surface | Hostname | Resolved by |
| --- | --- | --- |
| Web app | `campaign.ojage.org` | NNACT Caddy → `campaign-web:80` (this stack) |
| API | `api.campaign.ojage.org` | NNACT Caddy → `campaign-api:4000` (this stack) |
| Postgres | — | Not published. Reachable only from this stack's private `campaign` network |

The stack joins NNACT Pro's Docker network (`openfieldpro_internal`, the default
`PROXY_NETWORK`) so the proxy can reach its containers by name. Service names are
prefixed with `campaign-` because Docker DNS aliases are shared across that
network — an unprefixed `api` would collide with NNACT Pro's own API.

```
browser ──▶ campaign.ojage.org ──┐
                                 ├──▶ NNACT Caddy (ports 80/443) ──▶ campaign-web / campaign-api
browser ──▶ api.campaign.ojage.org┘                                          │
                                                                            │ (proxy network)
                                             ┌──────────────┬───────────────┘
                                             │ campaign-api │ campaign-postgres
                                             └──────────────┴───────────────┘ (private campaign network)
```

## One-time setup

1. **DNS.** Create two A records pointing at the VPS:
   - `campaign.ojage.org` and `api.campaign.ojage.org`.

2. **Shared reverse proxy.** Add the two vhosts to `nnact-pro/infra/Caddyfile.prod`
   and add matching defaults to the `caddy` service in
   `nnact-pro/infra/compose.prod.yml`. Deploy NNACT Pro once (or run
   `docker compose -f infra/compose.prod.yml up -d --force-recreate caddy` there)
   so Caddy binds the new sites and provisions certificates.

   ```caddy
   {$DMECAMPAIGN_SITE_ADDRESS} {
   	import security_headers
   	reverse_proxy campaign-web:80
   	log {
   		output stdout
   		format json
   	}
   }

   {$DMECAMPAIGN_API_ADDRESS} {
   	import security_headers
   	# Generation answers can take close to a minute, and the chat endpoint
   	# streams. Below the buffering threshold Caddy would hold the response.
   	reverse_proxy campaign-api:4000 {
   		flush_interval -1
   	}
   	log {
   		output stdout
   		format json
   	}
   }
   ```

   ```yaml
   DMECAMPAIGN_SITE_ADDRESS: ${DMECAMPAIGN_SITE_ADDRESS:-campaign.ojage.org}
   DMECAMPAIGN_API_ADDRESS: ${DMECAMPAIGN_API_ADDRESS:-api.campaign.ojage.org}
   ```

3. **Checkout.** On the VPS, clone this repository to the deploy path:
   ```bash
   git clone git@github.com:Ojage/dme-campaigns-ojage-fe.git /srv/dme-campaigns
   ```
   The deploy pipeline pulls `origin/main` and runs from there. `data/` (the
   Postgres volume and the deploy marker) lives inside that checkout and is
   gitignored; give the deploy user ownership of `.git` and `data`.

4. **Secrets.** In GitHub, set repository secrets for this repo:
   - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY` — the same
     values NNACT Pro uses (its deploy already has SSH access to this server).
   - `DME_CAMPAIGN_ENV` — the contents of [infra/production.env.example](../infra/production.env.example)
     with `POSTGRES_PASSWORD`, both JWT secrets and at least one model-provider
     key filled in.

   Keys set directly on the VPS copy of `.env` survive deploys as long as they
   are not also present in the secret: `ci-deploy.sh` merges the two by key name.

## Behaviour

- **Every push to `main`** runs `ci.yml` (typecheck, tests, build, image build,
  OpenAPI freshness) and then `deploy-production.yml`, which deploys only if CI
  is green and fails if the deployed HEAD does not contain the pushed commit.
- **The seed is the schema step.** The API refuses to `synchronize` in
  production (`synchronize: config.env !== 'production'`), and the seed refuses
  to run without `ALLOW_SCHEMA_PUSH=true`, which the pipeline exports. On the
  first deploy (no marker in `data/.deployed-sha`) and whenever an API path
  changes, the pipeline runs the seed: it creates or alters tables to match the
  shipped entities and (re)writes the two demo accounts idempotently.
- **Change-aware builds.** `scripts/change-detect.mjs` maps the changed file set
  to the images that must be rebuilt, so an api-only fix does not rebuild the web
  app. The marker at `data/.deployed-sha` records the last deployed commit.
- **Public verification** is off by default (`VERIFY_PUBLIC=false`). Once DNS
  resolves, set `VERIFY_PUBLIC=true` in `DME_CAMPAIGN_ENV` so every deploy
  asserts both public URLs answer.

## Operations

```bash
# From the VPS checkout:
docker compose -f infra/compose.prod.yml --profile tools run --rm campaign-seed   # re-run seed
docker compose -f infra/compose.prod.yml ps                                       # status
docker compose -f infra/compose.prod.yml logs -f campaign-api                     # API logs
docker compose -f infra/compose.prod.yml logs -f campaign-web                     # web logs
tail -f /tmp/ci-deploy.log                                                        # running deploy
```

The API's liveness probe is `GET /api/health` (public, unversioned). It reports
process liveness only — the database has its own healthcheck in the stack.

## Security notes

- `.env` is never copied into an image (`.dockerignore`), and CI only ever sends
  it to the VPS over SSH.
- `CORS_ORIGINS` is allow-listed to the web origin; the API never echoes an
  arbitrary `Origin`.
- Called once per generation, so an abuse of the demo accounts can burn tokens —
  the demo password is a fixed value by choice. Ship without seeding the demo
  accounts before exposing this publicly.
- The model default is `claude-sonnet-5-5` because `claude-sonnet-4-5` was
  deprecated on 2026-09-30 (retirement 2026-11-30). Pin a different model with
  `ANTHROPIC_MODEL`.