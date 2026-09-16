/**
 * The denominator for docs/personas/rating.md, read out of the code.
 *
 * A screen is a route the address bar can show, a pane a person opens on the
 * canvas, a section of the account page, a band of the marketing page, or an
 * MCP tool -- because for this product the agent's answer IS a surface.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const WEB = "apps/web";
const APP = join(WEB, "app");

/** Redirects, downloads and machine endpoints. Never scored. */
const NOT_A_SCREEN_ROUTE = new Set([
  "/claim", "/share", "/export/note/[noteId]", "/export/space/[spaceId]",
  "/oauth/token", "/oauth/register", "/oauth/revoke",
  "/site/robots.txt", "/site/sitemap.xml",
]);

/** Shared chrome and primitives. Scored once in an issue, not row by row. */
const NOT_A_PANE = new Set([
  "Brand", "Icon", "Underline", "Reveal", "ProseBands", "LegalPage", "Ink",
  "Canvas", "CanvasStage", "CanvasMenuHost", "InkCanvas", "RemarkSurfaces",
  "Remark", "CanvasMenuItems",
]);

const PANE_LABEL = {
  AddMenu: "Add menu", CanvasMenu: "Canvas long-press menu",
  Chrome: "Canvas chrome and ⌘K palette", Fallback: "Something went wrong",
  InkTranscript: "Handwriting transcript", LiveFeed: "Somebody else is writing",
  PenSize: "Pen size", Photos: "Photos on the page", Presence: "Who else is here",
  Recorder: "Voice recorder", RemarkPins: "Comment pins",
  RemarkPopup: "Comment popup", RemarkThread: "One comment thread",
  RemarksButton: "Comments button", RemarksDrawer: "Comments drawer",
  RemarksFeed: "Comments feed", SaveIndicator: "Saved / saving",
  ScribbleHint: "Scribble to erase hint", SelectionBar: "Selection bar",
  Spine: "The spine", StickerTray: "Sticker tray", ToolOptions: "Tool options",
  ToolRail: "Tool rail", TranscriptCard: "Voice transcript card",
  ZoomChip: "Zoom chip",
};

const ACCOUNT_LABEL = {
  CaptureTokens: "Account › Capture tokens and the Shortcut",
  ConnectToClaude: "Account › Connect to Claude",
  Connections: "Account › Connected agents",
  ExportSection: "Account › Export", PlanSection: "Account › Plan and usage",
  TriageSwitch: "Account › Triage agent",
};

const SITE_LABEL = {
  CaptureModes: "Apex › Four ways in", ConnectAI: "Apex › Connect your assistant",
  Examples: "Apex › Examples", HeroCanvas: "Apex › Live canvas hero",
  HeroJot: "Apex › Jot before you sign up", Ink: "Apex › Handwriting band",
  LakeStory: "Apex › The lake story", Objection: "Apex › But my notes app…",
  Promises: "Apex › What it promises", SiteFooter: "Apex › Footer",
};

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
};

const routeOf = (file) =>
  "/" + file.slice(APP.length + 1).replaceAll(sep, "/").replace(/[/]page[.]tsx$/, "");

function routes() {
  return walk(APP)
    .map((f) => (routeOf(f) === "/page.tsx" ? "/" : routeOf(f)))
    .filter((r) => !r.startsWith("/api/"))
    .filter((r) => !NOT_A_SCREEN_ROUTE.has(r))
    .sort();
}

/** `/site/pricing` is served at the apex as `/pricing`. ADR-040. */
const apexPath = (r) => (r === "/site" ? "/" : r.slice("/site".length));

function components(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
}

function mcpTools() {
  const src = ["tools-read.ts", "tools-write.ts"]
    .map((f) => readFileSync(join("apps/mcp/src", f), "utf8")).join("\n");
  return [...src.matchAll(/^ {2}t\("([a-z_]+)"/gm)].map((m) => m[1]).sort();
}

const row = (screen, key) => `| ${screen} | \`${key}\` | — | — | | |`;

function section(title, rows) {
  return [
    `### ${title} — ${rows.length} screens`, "",
    "| Screen | Key | Design | Ease | Gap to 10 | Persona |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows, "",
  ].join("\n");
}

function build() {
  const all = routes();
  const app = all.filter((r) => !r.startsWith("/site"));
  const site = all.filter((r) => r.startsWith("/site"));
  const web = components(join(WEB, "components"));
  const panes = web.filter((c) => PANE_LABEL[c] && !NOT_A_PANE.has(c));
  const account = web.filter((c) => ACCOUNT_LABEL[c]);
  // NOT_A_PANE applies here too: `Ink` is a library of hand-drawn SVGs that
  // LakeStory uses, not a band somebody scrolls to.
  const siteBands = components(join(WEB, "components/site"))
    .filter((c) => SITE_LABEL[c] && !NOT_A_PANE.has(c));
  const unclassified = web.filter(
    (c) => !PANE_LABEL[c] && !ACCOUNT_LABEL[c] && !NOT_A_PANE.has(c));

  const out = [
    section("The app — pages", app.map((r) => row(nameApp(r), r))),
    section("The canvas — panes", panes.map((c) => row(PANE_LABEL[c], `canvas › ${c}`))),
    section("Account — sections", [
      row("Account › Toolbar position", "account › toolbar-side"),
      ...account.map((c) => row(ACCOUNT_LABEL[c], `account › ${c}`)),
      row("Account › Sign out", "account › sign-out"),
    ]),
    section("The apex — pages", site.map((r) => row(nameSite(r), apexPath(r) || "/"))),
    section("The apex — bands", siteBands.map((c) => row(SITE_LABEL[c], `apex › ${c}`))),
    section("What the agent sees — MCP tools", mcpTools().map((t) => row(t, `mcp › ${t}`))),
  ];
  const count = out.join("\n").split("\n").filter((l) => l.startsWith("| ") && l.endsWith("| |")).length;
  if (unclassified.length) {
    out.push(`<!-- UNCLASSIFIED, decide before scoring: ${unclassified.join(", ")} -->\n`);
  }
  return { body: out.join("\n"), count, unclassified };
}

const NAMES_APP = {
  "/": "The canvas", "/n/[id]": "A note", "/dashboard": "Dashboard",
  "/account": "Account", "/signin": "Sign in",
  "/oauth/authorize": "Let this agent in", "/review": "What agents did",
};
const NAMES_SITE = {
  "/site": "Home", "/site/pricing": "Pricing", "/site/blog": "Blog",
  "/site/blog/[slug]": "One blog post", "/site/privacy": "Privacy",
  "/site/terms": "Terms",
};
const nameApp = (r) => NAMES_APP[r] ?? `UNNAMED ${r}`;
const nameSite = (r) => NAMES_SITE[r] ?? `UNNAMED ${r}`;

const { body, count, unclassified } = build();
process.stdout.write(body);
process.stderr.write(`\n${count} rateable screens\n`);
if (unclassified.length) process.stderr.write(`unclassified: ${unclassified.join(", ")}\n`);
