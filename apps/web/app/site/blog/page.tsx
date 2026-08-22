import type { Metadata } from "next";
import Link from "next/link";
import { listPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Technically honest notes on MCP, handwriting recognition on the web, and "
    + "capturing to a web app from iOS Shortcuts.",
  alternates: { canonical: "/blog" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default async function Blog() {
  const posts = await listPosts();

  return (
    <main className="jd-site-main">
      <section className="jd-band">
        <h1 className="font-head">Writing</h1>
        <p className="jd-lede">
          A small number of things worth writing down, mostly about connecting agents
          to your own data. Each one ends with something that works rather than a
          sign-up form.
        </p>

        <ul className="jd-post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              <p>{post.description}</p>
              <time dateTime={post.date}>{when(post.date)}</time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
