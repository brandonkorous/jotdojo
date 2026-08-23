import { listPosts } from "@/lib/posts";
import { siteOrigin } from "@/lib/hosts";

export const dynamic = "force-static";

/** Hand-written rather than Next's `sitemap.ts` convention, because that emits
 *  at `/sitemap.xml` on EVERY host and the app host must not have one. */
export async function GET(): Promise<Response> {
  const origin = siteOrigin();
  const posts = await listPosts();

  const urls = [
    { loc: "/", priority: "1.0" },
    { loc: "/pricing", priority: "0.8" },
    { loc: "/blog", priority: "0.6" },
    ...posts.map((post) => ({ loc: `/blog/${post.slug}`, priority: "0.5" })),
    { loc: "/privacy", priority: "0.3" },
    { loc: "/terms", priority: "0.3" },
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, priority }) =>
      `  <url><loc>${origin}${loc}</loc><priority>${priority}</priority></url>`),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
