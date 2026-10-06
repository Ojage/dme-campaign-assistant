# Web image. The bundle is static, so the runtime is nothing but nginx.
FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm fetch --ignore-scripts

COPY . .

RUN pnpm install --frozen-lockfile --offline --reporter=silent

# Baked into the bundle at build time: the browser has to know the API origin
# before it makes its first request, so this cannot be read from the environment
# at runtime. Vite exposes VITE_* variables from process.env during the build.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @dme/web... build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
