/**
 * The marketing site at the apex, over real HTTP. ADR-010, ADR-040.
 *
 * Two hostnames, one deployment, and the whole point is that they behave
 * differently: the apex is crawlable and open, the app is neither. This proves
 * the split, because getting it wrong is invisible in development and permanent
 * afterwards -- a PWA installed from the apex opens the pitch forever.
 *
 * Requires the web app running -- pnpm dev.
 */
import { startAnonSession, createNote, getNote } from "@jotacular/domain";

const WEB = process.env.APP_URL ?? "http://localhost:3400";
const APEX = new URL(process.env.SITE_URL ?? "http://jotacular.localhost:3400").host;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

/** Caddy sets `x-forwarded-host`, which is what the middleware reads. */
const apex = (path: string) =>
  fetch(WEB + path, { headers: { "x-forwarded-host": APEX }, redirect: "manual" });
const app = (path: string) => fetch(WEB + path, { redirect: "manual" });

const bodyOf = async (res: Response) => (res.ok ? res.text() : "");

// --- the apex is the marketing site --------------------------------------

console.log("\nthe apex is a page a crawler can read");
const homeRes = await apex("/");
check("the apex serves a page, not a redirect to the app", homeRes.status === 200,
  String(homeRes.status));
const home = await bodyOf(homeRes);
check("...with the headline in the HTML", home.includes("Where the thought lands"));
check("...naming what a search would look for",
  /<title>[^<]*Claude[^<]*<\/title>/.test(home));
check("...with a canonical url on the apex", home.includes(`canonical" href="http`));
check("...and structured data saying what this is",
  home.includes("SoftwareApplication") && home.includes("application/ld+json"));

console.log("\nthe hero is a real canvas");
check("the hero is an editable surface, not a screenshot",
  home.includes('aria-label="Try Jotacular"'));
// The hero carries the SAME rail as the app (components/ToolRail.tsx). A hero
// with its own toolbar would be advertising a product that does not exist.
check("...with the app's toolbar on it", home.includes('aria-label="Handwriting"')
  && home.includes('aria-label="Highlighter"') && home.includes('aria-label="Select"'));
check("...saying plainly which tools need an account",
  home.includes("sign in to record voice notes and add photos"));
// Inter serves NONE of these, so each one fell through to a system font, and
// U+270E has an emoji presentation variant that rendered the pen in colour on
// Apple platforms. ADR-044. They must not come back.
const FALLBACK_GLYPHS = /[✎▬⌧⬚●▢]/;
check("...as drawn icons, not as Unicode the font does not serve",
  home.includes('class="jd-icon"') && !FALLBACK_GLYPHS.test(home));
// Formatting is one tap away rather than pre-opened, so it is the TEXT tool
// that has to be on the page, not the Bold button. The options pill used to
// render itself open and this asserted on its contents; on a phone that put a
// permanent band exactly where the next line was going to go, so it now waits
// to be asked (tap the tool you already hold). The rail still has to carry the
// whole product -- a hero that hides a tool is advertising a shorter one.
check("...and a way into formatting, so the typing surface is more than a box",
  home.includes('aria-label="Text"') && /aria-label="Text"[\s\S]{0,200}jd-icon/.test(home));
check("the headline sits beside the canvas, in the hero itself",
  /jd-hero-titles[^>]*>\s*<h1/.test(home));
check("...and the canvas is inside a frame, not a screenshot of one",
  /jd-hero-frame[\s\S]{0,400}jd-hero-stage/.test(home));
// The "keep this" affordance appears once there is something to keep. An
// empty box with a sign-up button on it is the wall this page exists to avoid.
check("...with nothing to sign up for before anything is written",
  !home.includes("Keep this") && home.includes("Nothing to sign up for"));
check("the /site prefix never leaks into a link", !home.includes('href="/site'));

// --- the page moves, and a crawler never notices -------------------------

// ADR-088. Every animation on this page is CSS driven from a scroll position,
// which is only worth anything if the words are in the HTML either way. What
// follows is that claim, asserted rather than assumed.
console.log("\nthe motion is CSS, so the page reads without it");
check("the pen stroke ships as a real path, drawable along itself",
  home.includes('class="jd-ul-stroke"') && home.includes('pathLength="1"'));
check("...under words a crawler can still read as one phrase",
  home.includes(">any kind of thought<") && home.includes(">Just jot it.<"));
// A reveal written into the markup is a reveal a crawler sees as a hidden
// page. The initial states live in the stylesheet, behind two gates.
check("nothing on the page is hidden by an inline style",
  !/style="[^"]*(opacity:\s*0|display:\s*none)/.test(home));
check("...and no observer is shipped to reveal it",
  !home.includes("IntersectionObserver"));
check("the drawing carries the numbers its own draw-on needs",
  /--len:\s*232/.test(home) && /--i:\s*5/.test(home));

console.log("\nthe rest of the site");
const pricingRes = await apex("/pricing");
check("pricing is served at the bare path", pricingRes.status === 200, String(pricingRes.status));
const pricing = await bodyOf(pricingRes);
for (const plan of ["Free", "Solo", "Family", "Team"]) {
  check(`...and sells ${plan}`, pricing.includes(`>${plan}</h2>`));
}
check("...and says what the number on the card actually buys",
  pricing.includes("page of handwriting"));
// "100 units a month" is our accounting word on the one card somebody is
// deciding from. If it comes back, it comes back here first.
check("...in words, not in \"units\"", !/\bunits?\b/i.test(pricing));

const blogRes = await apex("/blog");
check("the blog index is served", blogRes.status === 200, String(blogRes.status));
const blog = await bodyOf(blogRes);
const slugs = [...blog.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]!);
check("...listing more than one post", new Set(slugs).size > 1, String(slugs.length));

const postRes = await apex(`/blog/${slugs[0]}`);
check("a post is served", postRes.status === 200, String(postRes.status));
const post = await bodyOf(postRes);
check("...with its markdown rendered to HTML", post.includes("<h2"));
check("...and a canonical of its own", post.includes(`/blog/${slugs[0]}"`));
check("a slug nobody wrote is a 404, not a 500",
  (await apex("/blog/no-such-post")).status === 404);

// EVERY post, not just the first one the index happens to list. The rename
// sweep rewrote both ends of the `connect-jotdojo-to-claude` redirect, so that
// one post 308'd to itself -- an infinite loop, on the page the footer and the
// agent band both link to, while `slugs[0]` stayed green. ADR-091.
const posts = await Promise.all(slugs.map(async (slug) => ({
  slug, status: (await apex(`/blog/${slug}`)).status,
})));
const broken = posts.filter((r) => r.status !== 200);
check("...and so is every other post", broken.length === 0,
  broken.map((r) => `${r.slug}:${r.status}`).join(", "));

// A moved post keeps its old URL working. `permanent: true` is a 308, and the
// destination must not be the source -- see next.config.ts.
const moved = await apex("/blog/connect-jotdojo-to-claude");
check("a post that moved still answers at its old slug",
  moved.status === 308, String(moved.status));
check("...pointing at the new one, not at itself",
  (moved.headers.get("location") ?? "").endsWith("/blog/connect-jotacular-to-claude"),
  moved.headers.get("location") ?? "no location");

console.log("\nwhat we tell crawlers");
const robotsRes = await apex("/robots.txt");
check("the apex has robots.txt", robotsRes.status === 200, String(robotsRes.status));
const robots = await robotsRes.text();
check("...allowing the whole site", robots.includes("Allow: /"));
check("...and pointing at the sitemap", robots.includes("Sitemap:"));

const sitemap = await (await apex("/sitemap.xml")).text();
check("the sitemap is xml", sitemap.startsWith("<?xml"));
check("...listing pricing", sitemap.includes("/pricing</loc>"));
check("...and every post", slugs.every((slug) => sitemap.includes(`/blog/${slug}</loc>`)));
check("...on the apex, never on the app host",
  !sitemap.includes("/site/") && sitemap.includes("<loc>"));

// --- the apex is not the app ---------------------------------------------

console.log("\nthe apex must never be installable");
check("no manifest is linked from the marketing page",
  !home.includes('rel="manifest"'),
  "a PWA installed here would open the pitch forever -- ADR-010");
check("...and the page can be pinch-zoomed, unlike the canvas",
  !/maximum-scale=1[^0-9]/.test(home));

// --- the mark -------------------------------------------------------------

console.log("\nthe mark reaches both hostnames");
// Next serves the icons itself rather than a page serving them, so a gap in
// the middleware's passthrough rewrites them onto `/site/...` and the tab of
// every marketing page goes blank. ADR-076.
const ICON_LINK = /<link[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>/g;
const iconHrefs = (home.match(ICON_LINK) ?? [])
  .map((tag) => /href="([^"]+)"/.exec(tag)?.[1] ?? "")
  .filter(Boolean);
check("the marketing page links a tab icon at all", iconHrefs.length > 0);
for (const href of iconHrefs) {
  check(`...and the apex serves ${href}`, (await apex(href)).status === 200);
  check(`...as does the app host`, (await app(href)).status === 200);
}

const manifestRes = await app("/manifest.webmanifest");
check("the app host serves the manifest", manifestRes.status === 200, String(manifestRes.status));
const named = (await manifestRes.json()).icons as { src: string }[];
const served = await Promise.all(named.map(async (i) => (await app(i.src)).status === 200));
check("...and every icon it promises a home screen is really there",
  served.length > 0 && served.every(Boolean),
  named.filter((_, i) => !served[i]).map((i) => i.src).join(", "));

// --- the app is not the apex ---------------------------------------------

console.log("\nthe app is the app");
const appHome = await app("/");
check("the app still asks who you are", appHome.status === 307 || appHome.status === 302,
  String(appHome.status));
check("...and sends you to sign in", (appHome.headers.get("location") ?? "").includes("/signin"));

const appRobots = await (await app("/robots.txt")).text();
check("the app host refuses crawlers outright", appRobots.includes("Disallow: /"));
check("...and offers no sitemap", (await app("/sitemap.xml")).status === 404);

// --- the handoff ----------------------------------------------------------

console.log("\na draft is a real place to write");
const draft = await startAnonSession();
const note = await createNote(draft.actor, draft.spaceId, "half a thought");
const beacon = (cookie?: string) => fetch(`${WEB}/api/capture-beacon`, {
  method: "POST",
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify({
    noteId: note.id, body: "half a thought, kept", revision: note.revision,
  }),
});
const kept = await beacon(`jd_draft=${draft.token}`);
check("a tab closing takes the draft cookie", kept.status === 204, String(kept.status));
check("...and the last few characters are in the database",
  (await getNote(draft.actor, note.id)).body.includes("kept"));
check("...while no session and no draft is refused",
  (await beacon()).status === 401);

console.log("\nkeeping a draft");
const claim = await app("/claim?t=jd_anon_smoke");
check("claiming without a session goes to sign-in",
  claim.status === 307 || claim.status === 302, String(claim.status));
const back = claim.headers.get("location") ?? "";
check("...carrying where to come back to", back.includes("next="));
check("...which is the claim itself, so the draft is not stranded",
  decodeURIComponent(back).includes("/claim?t=jd_anon_smoke"));

console.log(failures === 0
  ? "\nsite smoke: all checks passed"
  : `\nsite smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
