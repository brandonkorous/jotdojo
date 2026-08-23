import Link from "next/link";
import { appOrigin } from "@/lib/hosts";
import { brand } from "@/lib/brand";
import { Wordmark } from "@/components/Brand";

/**
 * The site footer. docs/13-security-and-privacy.md.
 *
 * The last thing on the page is not a link farm. It is the name of who else
 * gets to read a note -- which is the one disclosure that appears nowhere
 * else, and the reason this is a footer rather than a sitemap.
 */

type Group = { title: string; links: { href: string; label: string }[] };

const DISCLOSURE = "Handwriting, voice and photos are read by Azure OpenAI in"
  + " eastus2, and by nobody else. We do not train on your notes. Nothing reads"
  + " them on a schedule unless you switched it on.";

function groups(): Group[] {
  return [
    {
      title: "Product",
      links: [
        { href: "/#how", label: "How it works" },
        { href: "/pricing", label: "Pricing" },
        { href: appOrigin(), label: "Open the app" },
      ],
    },
    {
      title: "Writing",
      links: [
        { href: "/blog/connect-jotacular-to-claude", label: "Connect it to Claude" },
        { href: "/blog/local-mcp-servers-and-your-phone", label: "Why local MCP fails" },
        { href: "/blog/what-mcp-actually-is", label: "What MCP actually is" },
        { href: "/blog", label: "All writing" },
      ],
    },
    {
      title: "Workshop",
      links: [
        { href: "https://kanninja.com", label: "kanNINJA" },
        { href: "https://silicaui.com", label: "Silica UI" },
      ],
    },
  ];
}

export function SiteFooter() {
  return (
    <footer className="jd-site-foot">
      <div className="jd-foot-inner">
        <div className="jd-foot-top">
          <Brand />
          {groups().map((group) => <FootNav key={group.title} group={group} />)}
        </div>

        <Fine />
      </div>
    </footer>
  );
}

function Brand() {
  return (
    <div className="jd-foot-brand">
      <Link href="/" className="jd-site-mark">
        <Wordmark className="jd-wordmark-lg" />
      </Link>
      <p className="jd-foot-tagline">{brand.line}</p>
      <p className="jd-foot-line">
        Your notes, readable by your AI, from your phone, with no computer running.
      </p>
    </div>
  );
}

function FootNav({ group }: { group: Group }) {
  return (
    <nav className="jd-foot-nav" aria-label={group.title}>
      <h2 className="font-head">{group.title}</h2>
      {group.links.map((link) => (
        link.href.startsWith("http")
          ? <a key={link.label} href={link.href}>{link.label}</a>
          : <Link key={link.label} href={link.href}>{link.label}</Link>
      ))}
    </nav>
  );
}

function Fine() {
  return (
    <div className="jd-foot-fine">
      <p>{DISCLOSURE}</p>
      <nav aria-label="Legal">
        <span>© 2026 WizeWorks</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </div>
  );
}
