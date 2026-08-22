import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { appOrigin, siteOrigin } from "@/lib/hosts";

/**
 * The marketing site. ADR-010, ADR-040.
 *
 * Served at the apex by the same deployment as the app, and rewritten off
 * `/site` so the prefix never appears in a URL.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "jotdojo — the notes app Claude can read",
    template: "%s — jotdojo",
  },
  description:
    "Write a note in a second on the phone already in your hand — typed, "
    + "handwritten or spoken. Then ask Claude what you said. Nothing to install, and "
    + "no computer left running at home.",
  /**
   * The apex must never be installable. A PWA's install origin is written into
   * the home-screen icon and does not follow a redirect, so an icon installed
   * from here would open the pitch instead of the canvas, forever. ADR-010.
   */
  manifest: null,
  appleWebApp: null,
  openGraph: { type: "website", siteName: "jotdojo", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

/** The app pins the viewport because pinching the chrome is never what was
 *  meant. A page of prose is the opposite case: zooming it is the point. */
export const viewport: Viewport = { maximumScale: 5, userScalable: true };

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Writing" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="jd-site">
      <header className="jd-site-bar">
        <Link href="/" className="jd-site-mark">
          <span aria-hidden className="jd-site-seal">覚</span>
          <span className="font-head text-lg">jotdojo</span>
        </Link>

        <nav aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>

        <a className="btn btn-primary btn-sm" href={appOrigin()}>Open the app</a>
      </header>

      {children}

      <footer className="jd-site-foot">
        <div>
          <p className="font-head text-lg">jotdojo</p>
          <p className="opacity-60">Where the thought lands.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/pricing">Pricing</Link>
          <Link href="/blog">Writing</Link>
          <a href={appOrigin()}>Open the app</a>
          <a href="https://kanninja.com">kanNINJA</a>
        </nav>
        <p className="jd-site-fine">
          Built by WizeWorks. Your notes are yours; nothing here is trained on.
        </p>
      </footer>
    </div>
  );
}
