# API image. Single stage on purpose: the deploy scripts run the seed (and any
# future one-off job) from this same image, so devDependencies such as the
# TypeScript compiler have to be present at runtime — exactly the trade the
# NNACT Pro API image makes.
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Manifests first: this layer only invalidates when a workspace manifest or the
# lockfile moves, so a source-only edit never re-resolves the dependency tree.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm fetch --ignore-scripts

COPY . .
RUN pnpm install --frozen-lockfile --offline --reporter=silent \
  && pnpm --filter @dme/api... build \
  && pnpm --filter @dme/api build:seed

# After the install, so NODE_ENV=production never makes pnpm skip
# devDependencies while the tree is being assembled.
ENV NODE_ENV=production

WORKDIR /app/apps/api
EXPOSE 4000

# The app writes nothing to disk, so a non-root user costs nothing.
USER node

CMD ["node", "dist/main.js"]
