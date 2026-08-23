/**
 * Ink drawings. design.md §16, docs/10-design-system.md.
 *
 * Simple black lines, drawn rather than rendered -- the napkin, not an
 * illustration library. They inherit `currentColor` so they read as part of
 * whatever they sit on, and they carry no text, so nothing here depends on a
 * font.
 */

type Props = { className?: string };

const pen = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Three boards and an arrow -- what the note in the lake story is about. */
export function BoardsDoodle({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 240 96" className={className} aria-hidden {...pen}>
      <rect x="6" y="16" width="52" height="64" rx="7" />
      <path d="M16 32h32M16 44h24" />
      <rect x="94" y="16" width="52" height="64" rx="7" />
      <path d="M104 32h32M104 44h20" />
      <rect x="182" y="16" width="52" height="64" rx="7" />
      <path d="M192 32h32M192 44h26" />
      <path d="M66 48h20M154 48h20" />
      <path d="M80 42l7 6-7 6M168 42l7 6-7 6" />
    </svg>
  );
}

/** A loose circle, for ringing a word the way a pen does. */
export function InkRing({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 56" className={className} aria-hidden preserveAspectRatio="none" {...pen}>
      <path d="M28 10C8 16 2 34 20 44c22 12 132 10 158-2 16-8 10-26-12-32C142 4 52 2 28 10z" />
    </svg>
  );
}
