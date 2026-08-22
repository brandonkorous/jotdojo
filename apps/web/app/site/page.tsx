import type { Metadata } from "next";
import Link from "next/link";
import { HeroCanvas } from "@/components/site/HeroCanvas";
import { listPosts } from "@/lib/posts";
import { siteOrigin } from "@/lib/hosts";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const BEATS = [
  {
    step: "Jot",
    body: "Open it and the cursor is already blinking. Type, write with a pen, or say it"
      + " out loud. There is no new-note button to find and nothing to wait for, which"
      + " matters when you have about four seconds.",
  },
  {
    step: "Connect",
    body: "Paste one link into Claude's settings, or ChatGPT's. That is the whole setup."
      + " Your laptop can stay shut \u2014 this works from the phone in your pocket, which"
      + " is where the notes were going anyway.",
  },
  {
    step: "Ask",
    body: "\u201cWhat did the roofer quote?\u201d Claude finds the note, reads it, and tells"
      + " you \u2014 whether you typed it or scrawled it with a pen at the kitchen table.",
  },
];

const PROMISES = [
  {
    title: "You will not lose it",
    body: "It saves while you type, not when you remember to. Close the tab mid-word,"
      + " drop the phone, run out of battery \u2014 the words are already somewhere safe,"
      + " and they are there on your other devices too.",
  },
  {
    title: "Your handwriting is searchable",
    body: "Write a page by hand and you can still find it months later by a word in it."
      + " So can Claude. Every other app hands an agent a picture and a shrug.",
  },
  {
    title: "Nothing is rewritten behind your back",
    body: "When Claude adds something it says so, and it leaves your words alone. If you"
      + " do not like what it did, one tap puts the note back the way it was.",
  },
];

export default async function Home() {
  const posts = (await listPosts()).slice(0, 3);

  return (
    <main className="jd-site-main">
      {/* The headline lives INSIDE the canvas and drops to the foot once
          somebody engages with it. The hero is the writing surface. */}
      <HeroCanvas>
        <h1 className="font-head">Where the thought lands.</h1>
        <p className="jd-lede">
          It turns up in the car, at the school gate, three minutes before a meeting.
          Get it down in a second — typed, handwritten, or spoken. Then, later, ask
          Claude what you said.
        </p>
      </HeroCanvas>

      <section id="how" className="jd-band">
        <h2 className="font-head">How it works</h2>
        <ol className="jd-beats">
          {BEATS.map((beat) => (
            <li key={beat.step}>
              <h3 className="font-head">{beat.step}</h3>
              <p>{beat.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="jd-band">
        <h2 className="font-head">What you can count on</h2>
        <div className="jd-cards">
          {PROMISES.map((promise) => (
            <article key={promise.title}>
              <h3 className="font-head">{promise.title}</h3>
              <p>{promise.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="jd-band jd-band-quiet">
        <h2 className="font-head">What it costs</h2>
        <p className="jd-lede">
          Nothing, for one person, for as long as you like. Five dollars a month if you
          want Claude writing back as well as reading. Nine for the whole household.
        </p>
        <Link className="btn btn-primary" href="/pricing">See the plans</Link>
      </section>

      {posts.length > 0 && (
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
      )}

      <script
        type="application/ld+json"
        // Ours, built from a literal below. Nothing user-supplied reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema()) }}
      />
    </main>
  );
}

/** Schema.org, so a search result can say what this is rather than guessing. */
function schema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "jotdojo",
    url: siteOrigin(),
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web, iOS, Android",
    description:
      "Write a note in a second on any phone \u2014 typed, handwritten or spoken \u2014 "
      + "then ask Claude or ChatGPT what you said. Nothing to install and no computer "
      + "left running.",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Solo", price: "5", priceCurrency: "USD" },
      { "@type": "Offer", name: "Family", price: "9", priceCurrency: "USD" },
      { "@type": "Offer", name: "Team", price: "19", priceCurrency: "USD" },
    ],
  };
}
