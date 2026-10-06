#!/usr/bin/env bash
# Remote production deploy — invoked by GitHub Actions over SSH.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Fail loudly before touching anything if the git object store is not writable
# by the deploy user (e.g. when a manual root-side git command left root-owned
# objects behind). A missing write permission would otherwise abort the fetch
# below in a way that the CI poll loop can mistake for a successful deploy.
if ! ( cd .git/objects && mkdir .dme-write-probe 2>/dev/null ); then
  echo "ERROR: .git is not writable by $(id -un). Fix ownership on the VPS (chown -R <deploy-user> .git) and retry." >&2
  exit 1
fi
rmdir .git/objects/.dme-write-probe

if [ -n "${DME_CAMPAIGN_ENV:-}" ]; then
  umask 077

  # Preserve any manually-added keys (e.g. a secret added directly on the VPS)
  # that are not managed by the CI secret. Key names are compared so the
  # CI-managed values always win, but server-side additions survive deploys.
  ENV_PREV=".env.prev"
  if [ -f .env ]; then
    cp .env "$ENV_PREV"
  fi

  printf '%s\n' "$DME_CAMPAIGN_ENV" > .env

  if [ -f "$ENV_PREV" ]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      key="${line%%=*}"
      if ! grep -q "^${key}=" .env 2>/dev/null; then
        echo "$line" >> .env
      fi
    done < "$ENV_PREV"
    rm -f "$ENV_PREV"
  fi
fi

if [ ! -f .env ]; then
  echo "Missing .env. Set DME_CAMPAIGN_ENV secret or create .env on the server." >&2
  exit 1
fi

# The model resolver falls back to the offline generator when the configured
# provider has no key — a tempting silent default locally, but a 503-shaped
# brick in production. This deploy refuses to ship a stack that cannot talk to a
# real model.
if grep -Eq '^(ANTHROPIC_API_KEY|OPENCODE_API_KEY|GEMINI_API_KEY)=\S+' .env; then
  : # at least one provider key is present
else
  echo "ERROR: .env must set ANTHROPIC_API_KEY, OPENCODE_API_KEY or GEMINI_API_KEY. Without one, generation would silently use the offline scripted generator." >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  echo "Docker is required on the VPS." >&2
  exit 1
fi

if [ "${CI_DEPLOY_SKIP_GIT:-}" != "true" ]; then
  echo "Fetching latest main..."
  git fetch --quiet origin main
  git reset --hard --quiet origin/main
else
  echo "Skipping git pull (CI rsync deploy)."
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export ALLOW_SCHEMA_PUSH=true

# Compose's `:?` overrides on the mandatory secrets do the real validation here.
"${COMPOSE[@]}" -f infra/compose.prod.yml config >/dev/null

# ---------------------------------------------------------------------------
# Change-aware builds: rebuild only the images whose source actually moved, so
# an api-only commit deploys in seconds instead of minutes. `data/.deployed-sha`
# records the last successfully deployed commit; the first deploy (or a missing
# image) falls back to building everything.
# ---------------------------------------------------------------------------
API_IMG="${CAMPAIGN_API_IMAGE:-dme/campaign-api:prod}"
WEB_IMG="${CAMPAIGN_WEB_IMAGE:-dme/campaign-web:prod}"

DEPLOY_MARKER="data/.deployed-sha"
mkdir -p "$(dirname "$DEPLOY_MARKER")"
LAST_SHA="$(cat "$DEPLOY_MARKER" 2>/dev/null || true)"

build_all=false
needs_api=false
needs_web=false
needs_schema=false

if [ -z "$LAST_SHA" ] || ! git cat-file -e "$LAST_SHA^{commit}" 2>/dev/null; then
  build_all=true
else
  DETECT_OUT="$(git diff --name-only "$LAST_SHA"..HEAD \
    | docker run -i --rm \
        -v "$ROOT_DIR/scripts:/scripts:ro" \
        node:22-alpine node /scripts/change-detect.mjs)" || true
  eval "$DETECT_OUT"
  if [ -z "${API:-}" ]; then
    echo "Change detection failed — falling back to a full rebuild."
    build_all=true
  else
    needs_api="$API"
    needs_web="$WEB"
    needs_schema="$SCHEMA"
  fi
fi

if [ "$build_all" = true ]; then
  needs_api=true
  needs_web=true
  needs_schema=true
  echo "No previous deploy marker — building all images."
fi

# A missing image must always be (re)built even when nothing changed on disk.
for pair in "api:$API_IMG" "web:$WEB_IMG"; do
  key="${pair%%:*}"; img="${pair#*:}"
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    echo "Image $img missing — forcing a rebuild."
    case "$key" in
      api) needs_api=true ;;
      web) needs_web=true ;;
    esac
  fi
done

TO_BUILD=()
[ "$needs_api" = true ] && TO_BUILD+=(campaign-api)
[ "$needs_web" = true ] && TO_BUILD+=(campaign-web)

echo "Affected images: ${TO_BUILD[*]:-none} (previous commit: ${LAST_SHA:-none})"
if [ "${#TO_BUILD[@]}" -gt 0 ]; then
  echo "Building production images..."
  "${COMPOSE[@]}" -f infra/compose.prod.yml build "${TO_BUILD[@]}"
else
  echo "No image sources changed — reusing existing images."
fi

echo "Starting the database..."
"${COMPOSE[@]}" -f infra/compose.prod.yml up -d campaign-postgres

if [ "$needs_schema" = true ]; then
  echo "Applying schema and seed..."
  # The seed refuses to run in production without ALLOW_SCHEMA_PUSH=true, which
  # is exported above and passed through by compose interpolation.
  "${COMPOSE[@]}" -f infra/compose.prod.yml --profile tools run --rm campaign-seed
else
  echo "No schema or seed changes — skipping."
fi

echo "Starting application stack..."
"${COMPOSE[@]}" -f infra/compose.prod.yml up -d campaign-api campaign-web --remove-orphans

echo "Waiting for services to become healthy..."
healthy=false
for _attempt in $(seq 1 60); do
  any_unhealthy=false
  all_ready=true
  for svc in campaign-api campaign-web; do
    cid="$(${COMPOSE[@]} -f infra/compose.prod.yml ps -q "$svc" 2>/dev/null | tr -d '[:space:]')"
    if [ -z "$cid" ]; then
      all_ready=false
      continue
    fi
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null)"
    case "$state" in
      healthy) ;;
      running) ;; # no healthcheck configured -> Up is good enough
      starting | "")
        all_ready=false ;;
      *)
        echo "Service $svc is in bad state ($state)." >&2
        any_unhealthy=true ;;
    esac
  done
  if [ "$any_unhealthy" = true ]; then
    echo "A service became unhealthy — aborting." >&2
    "${COMPOSE[@]}" -f infra/compose.prod.yml ps >&2
    exit 1
  fi
  if [ "$all_ready" = true ]; then
    healthy=true
    break
  fi
  sleep 3
done

if [ "$healthy" != true ]; then
  echo "Services did not reach the expected running state." >&2
  "${COMPOSE[@]}" -f infra/compose.prod.yml ps >&2
  exit 1
fi

# Optional end-to-end check through the public reverse proxy. Off by default so
# the first deploy still succeeds before DNS has propagated; once the records
# exist, set VERIFY_PUBLIC=true in .env.
if [ "${VERIFY_PUBLIC:-false}" = "true" ]; then
  command -v curl >/dev/null || { echo "VERIFY_PUBLIC=true but curl is not installed on the VPS." >&2; exit 1; }
  curl -fsS "https://${CAMPAIGN_API_ADDRESS:-api.campaign.ojage.org}/api/health" >/dev/null && echo "public API OK: https://${CAMPAIGN_API_ADDRESS:-api.campaign.ojage.org}/api/health"
  curl -fsS -o /dev/null "https://${CAMPAIGN_SITE_ADDRESS:-campaign.ojage.org}/" && echo "public site OK: https://${CAMPAIGN_SITE_ADDRESS:-campaign.ojage.org}/"
fi

# Write the commit now on disk so the NEXT deploy can skip images that did not
# change. Written only after every step above succeeded.
if [ "${CI_DEPLOY_SKIP_GIT:-}" != "true" ]; then
  printf '%s\n' "$(git rev-parse HEAD)" > "$DEPLOY_MARKER"
  echo "Deploy marker updated to $(cat "$DEPLOY_MARKER")."
fi

echo "Deploy complete."
echo "Web:  https://${CAMPAIGN_SITE_ADDRESS:-campaign.ojage.org}"
echo "API:  https://${CAMPAIGN_API_ADDRESS:-api.campaign.ojage.org}/api/health"