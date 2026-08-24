import { join } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  /**
   * A build must never overwrite a running dev server's output.
   *
   * `next build` and `next dev` share `.next` by default, so verifying a build
   * while someone has `pnpm dev` up replaces the chunks the dev server has
   * already mapped. It then serves 500s with "Cannot find module './153.js'"
   * from routes that are perfectly fine, and the only fix is a restart nobody
   * knows they need. Verification builds set NEXT_DIST_DIR and stay out of the
   * way.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // A self-contained server plus only the files it traced, instead of the whole
  // workspace and its node_modules. `outputFileTracingRoot` is required in a
  // monorepo -- without it Next traces from apps/web and silently omits the
  // workspace packages, producing an image that builds fine and crashes on
  // first request with a module-not-found.
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../../"),

  /**
   * The blog is markdown on disk. Every page that reads it is prerendered, so
   * this only matters if one ever falls back to rendering on demand -- at which
   * point a missing content directory would be a 500 rather than a 404.
   */
  outputFileTracingIncludes: {
    "/site": ["./content/blog/**/*"],
    "/site/blog": ["./content/blog/**/*"],
    "/site/blog/[slug]": ["./content/blog/**/*"],
    "/site/sitemap.xml": ["./content/blog/**/*"],
  },

  // The domain and db packages ship as TypeScript source, not built output.
  transpilePackages: ["@jotacular/domain", "@jotacular/db"],
  // Neither of these may be bundled into the server build. postgres-js breaks
  // when it is; sharp is a platform-specific native binary, reached only from
  // the export routes through `@jotacular/ink-render/raster`. ADR-067.
  serverExternalPackages: ["postgres", "sharp"],

  /* No `redirects()`. The rename moved a post's slug, and the rule that
     preserved the old one guarded nothing: the site was a day old, nothing
     linked to it and no crawler had been near it. It was also the source of
     the only outage-shaped bug of the rename -- the sweep rewrote both ends of
     it, so the post 308'd to itself. ADR-095. */

  // Next ignores directories starting with a dot, so the well-known paths
  // required by RFC 8414 are rewritten onto ordinary route handlers.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/openid-configuration",
        destination: "/api/well-known/oauth-authorization-server",
      },
    ];
  },
};

export default config;
