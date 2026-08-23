import { siteOrigin } from "@/lib/hosts";

/**
 * The apex is meant to be crawled. Served through the `/site` rewrite, so this
 * answers `jotacular.com/robots.txt`. The app host has its own, at app/robots.ts,
 * and it says the opposite.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteOrigin()}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
