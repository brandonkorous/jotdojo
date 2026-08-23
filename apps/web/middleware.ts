import { NextResponse, type NextRequest } from "next/server";
import { isMarketingHost, requestHost } from "@/lib/hosts";

/**
 * The apex is the marketing site, `app.` is the app, and one deployment serves
 * both. ADR-040.
 *
 * Marketing pages live under `/site` in the route tree and are rewritten onto
 * the apex's bare paths, so `jotacular.com/pricing` renders `app/site/pricing`
 * without the prefix ever appearing in a URL.
 */

/**
 * Next's own output, the app's own endpoints, and everything in `public/`.
 *
 * Rewriting `/_next` would 404 every page that loads it. `/api` is shared
 * rather than duplicated under `/site`: the capture beacon that saves a
 * half-typed thought when a tab closes is the same endpoint for a visitor and
 * for a signed-in person, because the promise is the same one.
 *
 * `/brand` and `/img` are static files, and without them here the apex rewrote
 * `/brand/wordmark.svg` to `/site/brand/wordmark.svg` and served a 404 -- the
 * wordmark in the site bar was a broken image. Nothing caught it because the
 * site had no images at all until the rebrand. ADR-076.
 *
 * `icon[-.]` covers both the tab icon Next serves at `/icon.png` and the
 * manifest's `/icon-192.png`. Matching only `icon-` left the apex's tab blank.
 *
 * `robots.txt` and `sitemap.xml` are deliberately NOT here: the apex has its
 * own under `/site`, and they must keep being rewritten.
 */
const PASSTHROUGH =
  /^\/(_next|api|brand|img|favicon\.ico|icon[-.]|apple-icon|opengraph-image|manifest\.webmanifest)/;

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
