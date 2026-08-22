import type { MetadataRoute } from "next";

/**
 * The app host is not for crawlers. ADR-010, ADR-040.
 *
 * Every page behind `app.` requires a session, so an index of it would be a
 * list of sign-in redirects competing with the marketing site for the same
 * queries. The apex serves its own, at app/site/robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
