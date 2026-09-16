import { DomainError } from "./errors";

/**
 * An arrow between two things on the page. ADR-108.
 *
 * The one diagramming primitive the canvas did not have, and the only one that
 * changes what an AGENT can read: two boxes side by side are two notes, and the
 * same two boxes with an arrow between them are a claim about order.
 * `flattenLinks` is where that claim becomes words.
 *
 * A FOURTH ARRAY in the layer document, for the reason `images` is a third one
 * (ink-image.ts): a link is not something to draw with a pen and not something
 * to recognise, and keeping the arrays apart makes confusing them impossible
 * rather than merely unlikely.
 */

/**
 * One end of an arrow.
 *
 * `id` is the object it is tied to -- a text box, a photograph or a stroke --
 * and the end follows that object wherever it goes. `x`/`y` is where the end
 * was last seen, which is what gets drawn while the page is still loading.
 *
 * Not a foreign key and it cannot be: the objects live inside a jsonb document
 * and are minted by clients. `ink-link-ends.ts` decides what a tie resolves to.
 */
export type LinkEnd = {
  id: string | null;
  x: number;
  y: number;
};

export type Link = {
  id: string;
  from: LinkEnd;
  to: LinkEnd;
  color: string;
  /** Line width in document units, so an arrow keeps its weight as the camera
   *  moves -- the same rule a stroke follows. */
  width: number;
  /** Which ends get a head. `none` is a plain tether between two things. */
  head: LinkHead;
};

export type LinkHead = "end" | "both" | "none";

const HEADS = new Set<string>(["end", "both", "none"]);

/** Generous, and far above a real page. A guard against a runaway client
 *  rather than a product limit -- the call ink-doc.ts makes about strokes. */
export const MAX_LINKS = 2_000;
const MAX_COORD = 1_000_000;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateLinks(input: unknown): Link[] {
  if (!Array.isArray(input)) {
    throw new DomainError("links must be an array", "bad_links", 400);
  }
  if (input.length > MAX_LINKS) {
    throw new DomainError("too many links", "bad_links", 400);
  }
  return input.map((raw, i) => one(raw, `link ${i}`));
}

function one(raw: unknown, where: string): Link {
  const l = raw as Partial<Link>;
  if (!l || typeof l !== "object") {
    throw new DomainError(`${where}: not an object`, "bad_links", 400);
  }
  if (typeof l.color !== "string" || !COLOR.test(l.color)) {
    throw new DomainError(`${where}: color must be #rrggbb`, "bad_links", 400);
  }
  if (typeof l.width !== "number" || !Number.isFinite(l.width)
    || l.width <= 0 || l.width > 200) {
    throw new DomainError(`${where}: implausible width`, "bad_links", 400);
  }
  if (typeof l.head !== "string" || !HEADS.has(l.head)) {
    throw new DomainError(`${where}: unknown head`, "bad_links", 400);
  }
  return {
    id: shortId(l.id, `${where}: id`),
    from: end(l.from, `${where}: from`),
    to: end(l.to, `${where}: to`),
    color: l.color, width: l.width, head: l.head as LinkHead,
  };
}

function end(raw: unknown, where: string): LinkEnd {
  const e = raw as Partial<LinkEnd>;
  if (!e || typeof e !== "object") {
    throw new DomainError(`${where}: not an object`, "bad_links", 400);
  }
  for (const key of ["x", "y"] as const) {
    const v = e[key];
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) {
      throw new DomainError(`${where}: ${key} must be a finite number`, "bad_links", 400);
    }
  }
  // Null is an ORDINARY value here, not a missing one: an arrow may have a
  // loose end, and it then lives at the point it was left.
  if (e.id !== undefined && e.id !== null
    && (typeof e.id !== "string" || e.id.length === 0 || e.id.length > 64)) {
    throw new DomainError(`${where}: id must be a short string`, "bad_links", 400);
  }
  return { id: e.id ?? null, x: e.x!, y: e.y! };
}

function shortId(given: unknown, where: string): string {
  if (given === undefined || given === null) return crypto.randomUUID();
  if (typeof given !== "string" || given.length === 0 || given.length > 64) {
    throw new DomainError(`${where} must be a short string`, "bad_links", 400);
  }
  return given;
}

/**
 * Which links die with the objects named. ADR-108.
 *
 * An arrow is deleted when either end is, and that is the one place this
 * disagrees with a comment (ADR-107). What somebody SAID about a rubbed-out
 * note is still a record; an arrow pointing at nothing records nothing.
 */
export function orphanedBy(
  links: readonly Link[], removed: ReadonlySet<string>,
): string[] {
  if (removed.size === 0) return [];
  return links
    .filter((l) => (l.from.id !== null && removed.has(l.from.id))
      || (l.to.id !== null && removed.has(l.to.id)))
    .map((l) => l.id);
}

/**
 * The arrows as words, for the searchable copy an agent reads. ADR-108.
 *
 * This is the whole reason arrows are worth storing rather than drawing: a
 * reader that is handed `Deposit -> Survey -> Offer` learns the shape of the
 * page, and one handed four coordinates learns nothing.
 */
export function flattenLinks(
  links: readonly Link[], names: ReadonlyMap<string, string>,
): string {
  const lines = links
    .map((l) => sentence(l, names))
    .filter((line): line is string => line !== null);
  if (lines.length === 0) return "";
  return `_[${lines.length} ${lines.length === 1 ? "arrow" : "arrows"} drawn on the page]_\n\n`
    + lines.map((line) => `- ${line}`).join("\n");
}

/**
 * One arrow in words, or null when neither end names anything readable.
 *
 * An arrow between two squiggles is true and says nothing, so it is left out
 * rather than rendered as "something drawn to something drawn".
 */
function sentence(link: Link, names: ReadonlyMap<string, string>): string | null {
  const from = nameOf(link.from, names);
  const to = nameOf(link.to, names);
  if (from === null && to === null) return null;
  const arrow = link.head === "both" ? "<->" : link.head === "none" ? "--" : "->";
  return `${from ?? "something on the page"} ${arrow} ${to ?? "something on the page"}`;
}

function nameOf(end: LinkEnd, names: ReadonlyMap<string, string>): string | null {
  if (end.id === null) return null;
  return names.get(end.id) ?? null;
}
