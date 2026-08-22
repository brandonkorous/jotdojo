import { NextResponse, type NextRequest } from "next/server";
import { isMarketingHost, requestHost } from "@/lib/hosts";

/**
 * The apex is the marketing site, `app.` is the app, and one deployment serves
 * both. ADR-040.
 *
 * Marketing pages live under `/site` in the route tree and are rewritten onto
 * the apex's bare paths, so `jotdojo.com/pricing` renders `app/site/pricing`
 * without the prefix ever appearing in a URL.
 */

/**
 * Next's own output, and the app's own endpoints.
 *
 * Rewriting `/_next` would 404 every page that loads it. `/api` is shared
 * rather than duplicated under `/site`: the capture beacon that saves a
 * half-typed thought when a tab closes is the same endpoint for a visitor and
 * for a signed-in person, because the promise is the same one.
 */
const PASSTHROUGH = /^\/(_next|api|favicon\.ico)/;

const SITE_PREFIX = "/site";

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (PASSTHROUGH.test(pathname)) return NextResponse.next();
  if (!isMarketingHost(requestHost(req.headers))) return NextResponse.next();

  /**
   * Idempotent, because the production server re-enters middleware on its own
   * internal rewrite -- and prefixing twice gives `/site/site/pricing`, which
   * is a 404 that only appears once the app is built.
   */
  if (pathname === SITE_PREFIX || pathname.startsWith(SITE_PREFIX + "/")) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? SITE_PREFIX : SITE_PREFIX + pathname;
  return NextResponse.rewrite(url);
}

/**
 * The `/site` paths are deliberately NOT redirected away on the app host.
 *
 * Canonicalising them here would mean redirecting our own internal rewrite the
 * moment a re-entered request arrives without the forwarded host, and the
 * failure is an infinite bounce between the two hostnames. Every marketing page
 * carries a canonical tag pointing at the apex, and app/robots.ts keeps
 * crawlers off `app.` entirely, so nothing is left to canonicalise.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
