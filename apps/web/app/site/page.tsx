import type { Metadata } from "next";
import { HeroCanvas } from "@/components/site/HeroCanvas";
import { Underline } from "@/components/site/Underline";
import { Cost, Closing } from "@/components/site/ProseBands";
import { CaptureModes } from "@/components/site/CaptureModes";
import { LakeStory } from "@/components/site/LakeStory";
import { ConnectAI } from "@/components/site/ConnectAI";
import { Objection } from "@/components/site/Objection";
import { Promises } from "@/components/site/Promises";
import { Examples } from "@/components/site/Examples";
import { appOrigin, siteOrigin } from "@/lib/hosts";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  return (
    <main className="jd-site-main">
      {/* The headline lives INSIDE the canvas and drops to the foot once
          somebody engages with it. The hero is the writing surface. */}
      <HeroCanvas appHref={appOrigin()}>
        <h1 className="font-head">
          Don&apos;t organize it.{" "}
          <Underline className="jd-hero-turn">Just jot it.</Underline>
        </h1>
        <p className="jd-lede">{brand.support}</p>
      </HeroCanvas>

      {/* design.md §18: capture, then the story, then the agent, then the
          objection, then who else can read it, then real life, then the ask. */}
      <CaptureModes />
      <LakeStory />
      <ConnectAI />
      <Objection />
      <Promises />
      <Examples />
      <Cost />
      <Closing />

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
    name: brand.name,
    url: siteOrigin(),
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web, iOS, Android",
    description: brand.blurb,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Solo", price: "5", priceCurrency: "USD" },
      { "@type": "Offer", name: "Family", price: "9", priceCurrency: "USD" },
      { "@type": "Offer", name: "Team", price: "19", priceCurrency: "USD" },
    ],
  };
}
