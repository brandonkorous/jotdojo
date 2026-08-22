# syntax=docker/dockerfile:1
#
# apps/mcp -- the MCP server. Build from the REPO ROOT:
#   docker build -f infra/docker/mcp.Dockerfile -t <registry>/jotdojo-mcp:<tag> .
#
# Same runtime-tsx shape as api.Dockerfile, and the same reasoning: `pnpm start`
# is `tsx src/index.ts`, so the image ships source rather than a build output.
#
# MCP_RESOURCE IS NOT OPTIONAL IN PRODUCTION. apps/mcp/src/index.ts defaults it
# to `http://localhost:${PORT}/mcp`, which is correct for a laptop and wrong
# everywhere else: RFC 8707 binds every issued access token to that literal
# string, so a deployment still advertising localhost mints tokens that no client
# can successfully present. It must be set to the public origin the Caddy block
# routes -- `https://mcp.jotdojo.com/mcp` -- and it must match character for
# character. See infra/k8s/config.yaml.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- dependencies ---------------------------------------------------------
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
COPY packages/speech/package.json packages/speech/
COPY packages/storage/package.json packages/storage/
COPY packages/vision/package.json packages/vision/
RUN pnpm install --frozen-lockfile --filter @jotdojo/mcp...

# --- runtime --------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production MCP_PORT=3402
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs jotdojo

COPY --from=deps --chown=jotdojo:nodejs /repo/node_modules ./node_modules
COPY --chown=jotdojo:nodejs package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=deps --chown=jotdojo:nodejs /repo/apps/mcp/node_modules ./apps/mcp/node_modules
COPY --chown=jotdojo:nodejs apps/mcp ./apps/mcp

# EVERY workspace package needs its OWN node_modules, not just its source.
#
# pnpm does not hoist. Each package gets a `node_modules` of symlinks into
# `/repo/node_modules/.pnpm`, and the root tree does not contain the leaves:
# `postgres` and `drizzle-orm` live under `packages/db/node_modules`, and the
# `@jotdojo/*` links that make `import { db } from "@jotdojo/db"` resolve live
# under `packages/domain/node_modules`.
#
# Copying only the source of these packages builds a perfectly clean image that
# starts and then dies on the first query with "Cannot find package 'postgres'"
# -- imported from a file that is present, in a package that is present, which is
# what makes it read like a dependency bug rather than a missing directory.
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/billing/node_modules ./packages/billing/node_modules
COPY --chown=jotdojo:nodejs packages/billing ./packages/billing
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/db/node_modules ./packages/db/node_modules
COPY --chown=jotdojo:nodejs packages/db ./packages/db
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/domain/node_modules ./packages/domain/node_modules
COPY --chown=jotdojo:nodejs packages/domain ./packages/domain
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/embeddings/node_modules ./packages/embeddings/node_modules
COPY --chown=jotdojo:nodejs packages/embeddings ./packages/embeddings
COPY --from=deps --chown=jotdojo:nodejs /repo/packages/storage/node_modules ./packages/storage/node_modules
COPY --chown=jotdojo:nodejs packages/storage ./packages/storage

# NUMERIC, not a name. Kubernetes cannot verify a NAMED user is non-root, so a
# pod with `runAsNonRoot: true` refuses the container outright with
# CreateContainerConfigError. The uid is the one created above.
USER 1001:1001
EXPOSE 3402

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
WORKDIR /repo/apps/mcp
CMD ["node", "/repo/apps/mcp/node_modules/tsx/dist/cli.mjs", "src/index.ts"]
