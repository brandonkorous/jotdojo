import type { Metadata } from "next";
import { HeroCanvas } from "@/components/site/HeroCanvas";
import { Problem, Cost, Closing } from "@/components/site/ProseBands";
import { Beats } from "@/components/site/Beats";
import { AgentDemo } from "@/components/site/AgentDemo";
import { Objection } from "@/components/site/Objection";
import { Promises } from "@/components/site/Promises";
import { PostList } from "@/components/site/PostList";
import { listPosts } from "@/lib/posts";
import { siteOrigin } from "@/lib/hosts";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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

      <Problem />
      <Beats />
      <AgentDemo />
      <Objection />
      <Promises />
      <Cost />
      <Closing />
      <PostList posts={posts} />

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
      "Write a note in a second on any phone — typed, handwritten or spoken — "
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
