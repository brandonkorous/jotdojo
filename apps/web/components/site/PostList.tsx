import Link from "next/link";
import type { Post } from "@/lib/posts";

/** The three most recent posts. docs/16-web-presence.md: the blog is the SEO. */
export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="jd-band">
      <h2 className="font-head">Writing</h2>
      <ul className="jd-post-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            <p>{post.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
