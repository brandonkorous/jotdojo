# syntax=docker/dockerfile:1
#
# apps/web. Build from the REPO ROOT:
#   docker build -f infra/docker/web.Dockerfile -t <registry>/jotacular-web:<tag> .
#
# No AKS-specific coupling. docs/03-architecture.md requires that a move to
# Container Apps or a single VM is a re-run of this file, not a rewrite.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- dependencies ---------------------------------------------------------
# Manifests first, source second. Editing a component then rebuilds from here
# instead of reinstalling the whole workspace.
FROM base AS deps
# EVERY manifest in the workspace is copied, not just this service's subgraph,
# and the INSTALL is what narrows things down (`--filter <app>...`). Copying a
# subset looks tighter and is a trap: `--frozen-lockfile` validates the lockfile
# against the importers it can see, so a missing package.json is not a missing
# dependency -- it is a lockfile that no longer matches the workspace. The
# manifests are a few kB and change rarely, so this layer still caches well.
#
# The subgraph is also not what it looks like. `@jotacular/domain` pulls in db,
# embeddings AND storage, so a service that only declares `domain` still needs
# all four present at install and at runtime.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/embeddings/package.json packages/embeddings/
COPY packages/ink-render/package.json packages/ink-render/
COPY packages/speech/package.json packages/speech/
COPY packages/storage/package.json packages/storage/
COPY packages/vision/package.json packages/vision/
# The icon kit comes from npm.fontawesome.com, which `.npmrc` authenticates
# with this token. A BuildKit secret rather than an ARG, so it never lands in a
# layer or in `docker history`. ADR-083.
RUN --mount=type=secret,id=fontawesome_npm_token     FONTAWESOME_NPM_TOKEN="$(cat /run/secrets/fontawesome_npm_token)"     pnpm install --frozen-lockfile --filter @jotacular/web...

# --- build ----------------------------------------------------------------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# The marketing pages are PRERENDERED, so the canonical tags, robots.txt and
# sitemap.xml are written at build time from these. They must match
# infra/k8s/01-config.yaml, which supplies the same two at runtime for the
# host routing in apps/web/middleware.ts. ADR-040.
ARG SITE_URL=https://jotacular.com
ARG APP_URL=https://app.jotacular.com
ENV SITE_URL=$SITE_URL APP_URL=$APP_URL

# `next build` reads NODE_ENV itself; setting it to production here would also
# make the dev-login provider's guard the only thing standing between a
# misconfigured build and a signin bypass. It is safe by construction either
# way (apps/web/auth.ts), but the build should not be the thing relying on it.
RUN pnpm --filter @jotacular/web exec next build

# --- runtime --------------------------------------------------------------
# Next's standalone output: a server plus only the files it traced. The two
# COPY lines after it are not optional -- static assets and public/ are
# deliberately excluded from the trace, and without them the app serves HTML
# with no CSS and no icons while reporting itself perfectly healthy.
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3400 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
WORKDIR /app
# `outputFileTracingRoot` is the repo root, so Next writes the standalone tree to
# apps/web/<distDir>/standalone and MIRRORS the workspace inside it -- the server
# lands at standalone/apps/web/server.js, which is what CMD below runs. The
# source path is therefore apps/web/.next/standalone, NOT /repo/.next/standalone:
# the latter does not exist, and `COPY` of a missing path fails the build rather
# than producing a broken image, which is the one mercy here.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
# NUMERIC, not a name. Kubernetes cannot verify a NAMED user is non-root, so a
# pod with `runAsNonRoot: true` refuses the container outright with
# CreateContainerConfigError. The uid is the one created above.
USER 1001:1001
EXPOSE 3400
CMD ["node", "apps/web/server.js"]
