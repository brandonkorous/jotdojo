import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import { splitFrontMatter } from "./front-matter";

/**
 * The privacy policy and the terms, as markdown. docs/13-security-and-privacy.md.
 *
 * Files rather than JSX because this is prose that changes on its own schedule,
 * and because a legal page whose text lives in a component is a legal page
 * nobody edits without a deploy they are afraid of.
 */

const DIR = join(process.cwd(), "content/legal");

export const LEGAL_SLUGS = ["privacy", "terms"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export type LegalDoc = {
  slug: LegalSlug;
  title: string;
  description: string;
  /** ISO date, and it has to mean it: a stale one here is worse than none. */
  updated: string;
  /** The plain-language version, shown above the policy rather than instead. */
  summary: string;
  html: string;
};

export async function getLegal(slug: LegalSlug): Promise<LegalDoc> {
  const raw = await readFile(join(DIR, `${slug}.md`), "utf8");
  const { meta, body } = splitFrontMatter(raw);
  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    updated: meta.updated ?? "1970-01-01",
    summary: meta.summary ?? "",
    html: marked.parse(body, { async: false }),
  };
}
