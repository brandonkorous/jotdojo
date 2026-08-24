import Link from "next/link";

/**
 * The apex's 404. It renders inside the site layout, so the bar and the footer
 * are already there -- this is only the middle. ADR-106.
 */
export default function SiteNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-5 py-24 text-center">
      <h1 className="font-head text-3xl">That page is not here</h1>
      <p className="mt-3 opacity-70">
        The link may be old, or it may have a typo in it.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">Back to the start</Link>
        <Link href="/blog" className="btn btn-ghost">Read the blog</Link>
      </div>
    </main>
  );
}
