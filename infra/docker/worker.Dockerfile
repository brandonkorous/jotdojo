# syntax=docker/dockerfile:1
#
# apps/worker -- the async half: outbox drain, embeddings, handwriting
# recognition. Build from the REPO ROOT:
#   docker build -f infra/docker/worker.Dockerfile -t <registry>/jotdojo-worker:<tag> .
#
# NO PORT AND NO SERVICE. apps/worker/src/index.ts is a polling loop with no HTTP
# listener, so there is nothing to probe over the network and nothing for Caddy to
# route to. Its Deployment (infra/k8s/worker.yaml) therefore declares no readiness
# probe -- a probe that cannot fail is worse than none, because it reports healthy
# for a process that has stopped draining.
#
# SHARP IS THE REASON THIS FILE IS NOT A COPY OF api.Dockerfile. `sharp` ships
# prebuilt native binaries per libc, and the musl builds Alpine needs are fetched
# by its install script -- which pnpm only runs because `sharp` is listed in the
# root package.json's `pnpm.onlyBuiltDependencies`. If that entry is ever removed
# the install still SUCCEEDS and the failure surfaces at runtime as
# "Could not load the sharp module using the linuxmusl-x64 runtime", on the first
# ink render rather than at build time.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- dependencies ---------------------------------------------------------
# The widest graph of the four services: it is the only one that touches both
# model providers (embeddings, vision) and the ink renderer.
FROM base AS deps
# EVERY manifest in the workspace is copied, not just this service's subgraph,
# and the INSTALL is what narrows things down (`--filter <app>...`). Copying a
# subset looks tighter and is a trap: `--frozen-lockfile` validates the lockfile
# against the importers it can see, so a missing package.json is not a missing
# dependency -- it is a lockfile that no longer matches the workspace. The
# manifests are a few kB and change rarely, so this layer still caches well.
#
# The subgraph is also not what it looks like. `@jotdojo/domain` pulls in db,
# embeddings AND storage, so a service that only declares `domain` still needs
# all four present at install and at runtime.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/billing/package.json packages/billing/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/embeddings/package.json packages/embeddings/
COPY packages/ink-render/package.json packages/ink-render/
COPY packages/reason/package.json packages/reason/
COPY packages/speech/package.json packages/speech/
COPY packages/storage/package.json packages/storage/
COPY packages/vision/package.json packages/vision/
RUN pnpm install --frozen-lockfile --filter @jotdojo/worker...

# --- runtime --------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs jotdojo

COPY --from=deps --chown=jotdojo:nodejs /repo/node_modules ./node_modules
COPY --chown=jotdojo:nodejs package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=deps --chown=jotdojo:nodejs /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --chown=jotdojo:nodejs apps/worker ./apps/worker

# EVERY workspace package needs its OWN node_modules, not just its source.
#
# pnpm does not hoist. Each package gets a `node_modules` of symlinks into
# `/repo/node_modules/.pnpm`, and the root tree does not contain the leaves:
# `postgres` and `drizzle-orm` live under `packages/db/node_modules`, and the
# `@jotdojo/*` links that make `import { db } from "@jotdojo/db"` resolve live
# under `packages/domain/node_modules` and `packages/ink-render/node_modules`.
#
# Copying only the source of these packages builds a perfectly clean image that
# starts and then dies on the first query with "Cannot find package 'postgres'"
# -- imported from a file that is present, in a package that is present, which is
# what makes it read like a dependency bug rather than a missing directory. The
# worker is the widest graph of the four, so it is the one with the most ways to
# get this wrong.
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/billing/node_modules ./packages/billing/node_modules
COPY --chown=jotdojo:nodejs packages/billing ./packages/billing
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/db/node_modules ./packages/db/node_modules
COPY --chown=jotdojo:nodejs packages/db ./packages/db
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/domain/node_modules ./packages/domain/node_modules
COPY --chown=jotdojo:nodejs packages/domain ./packages/domain
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/embeddings/node_modules ./packages/embeddings/node_modules
COPY --chown=jotdojo:nodejs packages/embeddings ./packages/embeddings
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/ink-render/node_modules ./packages/ink-render/node_modules
COPY --chown=jotdojo:nodejs packages/ink-render ./packages/ink-render
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/reason/node_modules ./packages/reason/node_modules
COPY --chown=jotdojo:nodejs packages/reason ./packages/reason
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/speech/node_modules ./packages/speech/node_modules
COPY --chown=jotdojo:nodejs packages/speech ./packages/speech
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/storage/node_modules ./packages/storage/node_modules
COPY --chown=jotdojo:nodejs packages/storage ./packages/storage
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/vision/node_modules ./packages/vision/node_modules
COPY --chown=jotdojo:nodejs packages/vision ./packages/vision

# NUMERIC, not a name. Kubernetes cannot verify a NAMED user is non-root, so a
# pod with `runAsNonRoot: true` refuses the container outright with
# CreateContainerConfigError. The uid is the one created above.
USER 1001:1001

# `node` runs tsx's CLI module DIRECTLY, by real path.
#
# Two things are deliberate here. First, not `pnpm start`: pnpm would fork a
# second process, making the container's PID 1 a package manager that does not
# forward SIGTERM -- so every rolling update would wait out the full termination
# grace period instead of draining.
#
# Second, not `node node_modules/.bin/tsx`. pnpm's `.bin` entries are SHELL
# SHIMS, not JavaScript, so handing one to `node` fails with a MODULE_NOT_FOUND
# that names the shim and explains nothing. And with a filtered install the bin
# is not at the workspace root at all -- `tsx` is a dependency of this service,
# so it resolves under the app. Pointing at `dist/cli.mjs` keeps node as PID 1
# and depends on a path that install layout cannot move out from under us.
WORKDIR /repo/apps/worker
CMD ["node", "/repo/apps/worker/node_modules/tsx/dist/cli.mjs", "src/index.ts"]
