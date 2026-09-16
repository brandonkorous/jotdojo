import { NextResponse, type NextRequest } from "next/server";
import { isMarketingHost, requestHost } from "@/lib/hosts";
import { PATH_HEADER } from "@/lib/here";

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

/**
 * The consent screen is never drawn inside somebody else's page. RFC 9700.
 *
 * One click on it hands an agent everything a person has ever written, which is
 * precisely the button a clickjack wants. Only a `SameSite=Lax` session cookie
 * stood in the way, and that is a default rather than a defence. Issue 018.
 */
const NO_FRAME = /^\/oauth\/authorize/;

/** Both headers on purpose: `frame-ancestors` is the standard and wins where it
 *  is understood, and `X-Frame-Options` is what older browsers still read. */
function neverFramed(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (NO_FRAME.test(pathname)) return neverFramed(NextResponse.next());
  if (PASSTHROUGH.test(pathname)) return NextResponse.next();

  // What the browser asked for, for the auth guard to redirect back to.
  const request = { headers: new Headers(req.headers) };
  request.headers.set(PATH_HEADER, pathname + req.nextUrl.search);

  if (!isMarketingHost(requestHost(req.headers))) return NextResponse.next({ request });

  /**
   * Idempotent, because the production server re-enters middleware on its own
   * internal rewrite -- and prefixing twice gives `/site/site/pricing`, which
   * is a 404 that only appears once the app is built.
   */
  if (pathname === SITE_PREFIX || pathname.startsWith(SITE_PREFIX + "/")) {
    return NextResponse.next({ request });
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? SITE_PREFIX : SITE_PREFIX + pathname;
  return NextResponse.rewrite(url, { request });
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
