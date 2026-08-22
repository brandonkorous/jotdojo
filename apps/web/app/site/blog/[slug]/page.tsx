import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, listPosts } from "@/lib/posts";

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

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default async function PostPage({ params }: Params) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  return (
    <main className="jd-site-main">
      <article className="jd-band jd-prose">
        <h1 className="font-head">{post.title}</h1>
        <time dateTime={post.date}>{when(post.date)}</time>
        {/* Ours, from a markdown file in this repository. */}
        <div dangerouslySetInnerHTML={{ __html: post.html }} />
        <p className="jd-fineprint">
          <Link href="/blog">All writing</Link>
        </p>
      </article>
    </main>
  );
}
