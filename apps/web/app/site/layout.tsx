import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { appOrigin, siteOrigin } from "@/lib/hosts";
import { brand } from "@/lib/brand";
import { Wordmark } from "@/components/Brand";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";

/**
 * The marketing site. ADR-010, ADR-040.
 *
 * Served at the apex by the same deployment as the app, and rewritten off
 * `/site` so the prefix never appears in a URL.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `${brand.name} — the notes app Claude can read`,
    template: `%s — ${brand.name}`,
  },
  description: brand.blurb,
  /**
   * The apex must never be installable. A PWA's install origin is written into
   * the home-screen icon and does not follow a redirect, so an icon installed
   * from here would open the pitch instead of the canvas, forever. ADR-010.
   */
  manifest: null,
  appleWebApp: null,
  openGraph: { type: "website", siteName: brand.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

/** The app pins the viewport because pinching the chrome is never what was
 *  meant. A page of prose is the opposite case: zooming it is the point. */
export const viewport: Viewport = { maximumScale: 5, userScalable: true };

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#ai", label: "For your AI" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Writing" },
];

/**
 * Pinned to the light theme, on purpose and for now. Issue 041.
 *
 * `--ink-2` and the band inks here are hard-coded hexes chosen against paper,
 * with no dark counterpart, so the moment dark became reachable (issue 002)
 * this page half-flipped: base-driven surfaces went charcoal and the inks
 * stayed light, at 16 measured AA failures. The app has real dark tokens and
 * keeps them; the site gets a dark palette when somebody designs one.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="jd-site" data-theme="paper">
      <header className="jd-site-bar">
        <Link href="/" className="jd-site-mark">
          <Wordmark />
        </Link>

        <nav aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>

        {/* "Open the app" and not "Start jotting": this one really does go to
            the app, which asks a first-time visitor to sign in. The box on the
            home page is what starts jotting. Issue 026. */}
        <a className="btn btn-primary" href={appOrigin()}>Open the app</a>
      </header>

      {children}

      <SiteFooter />
      <Reveal />
    </div>
  );
}
