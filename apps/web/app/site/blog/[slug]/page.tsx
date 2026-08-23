import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, listPosts } from "@/lib/posts";
import { formatDate } from "@/lib/format-date";

type Params = { params: Promise<{ slug: string }> };

/** A slug that is not a file is a 404, decided at build time. Without this the
 *  server would try to read one on demand and need the content directory. */
export const dynamicParams = false;

/** Prerendered, so a post is a static file with no database behind it. */
export async function generateStaticParams() {
  return (await listPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  return (
    <main className="jd-site-main">
      <article className="jd-band jd-prose">
        <h1 className="font-head">{post.title}</h1>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        {/* Ours, from a markdown file in this repository. */}
        <div dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>

      {/* A post ends at the canvas, never at a sign-up form. docs/16. */}
      <section className="jd-band jd-band-quiet">
        <h2 className="font-head">Try the thing this is about</h2>
        <p>
          The front page is a working canvas. Write a line in it and it is already
          saved — then connect Claude and ask it what you said.
        </p>
        <p className="jd-plan-cta">
          <Link className="btn btn-primary" href="/">Write something</Link>
          <Link href="/blog">All writing</Link>
        </p>
      </section>
    </main>
  );
}
