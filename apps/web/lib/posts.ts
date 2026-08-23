import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import { splitFrontMatter } from "./front-matter";

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

async function read(slug: string): Promise<Post> {
  const { meta, body } = splitFrontMatter(await readFile(join(DIR, `${slug}.md`), "utf8"));
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
