import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";

/**
 * The blog, as markdown files. docs/16-web-presence.md.
 *
 * Files rather than rows because these are code -- they are reviewed, they ship
 * with a deploy, and a post is never edited by anyone who is not editing the
 * repository. A CMS would add a database read to the fastest page we have.
 */

const DIR = join(process.cwd(), "content/blog");

export type Post = {
  slug: string;
  title: string;
  description: string;
  /** ISO date. Sorted on, and rendered as the published date. */
  date: string;
  html: string;
};

/**
 * Front matter, without a YAML parser.
 *
 * The vocabulary is three known keys with string values, so a parser would be
 * more code than the thing it parses -- and would invite the ninth key that
 * makes the pages inconsistent.
 */
function split(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

async function read(slug: string): Promise<Post> {
  const { meta, body } = split(await readFile(join(DIR, `${slug}.md`), "utf8"));
  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    date: meta.date ?? "1970-01-01",
    html: marked.parse(body, { async: false }),
  };
}

/** Newest first. */
export async function listPosts(): Promise<Post[]> {
  const files = await readdir(DIR);
  const posts = await Promise.all(
    files.filter((f) => f.endsWith(".md")).map((f) => read(f.replace(/\.md$/, ""))),
  );
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

/** Null rather than a throw: an unknown slug is a 404, not a 500. */
export async function getPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return await read(slug);
  } catch {
    return null;
  }
}
