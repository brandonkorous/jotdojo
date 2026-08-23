/**
 * Ink drawings. design.md §16, docs/10-design-system.md, ADR-088.
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

/**
 * A stroke that draws itself needs two numbers CSS cannot work out for it: how
 * long the path is, so a dash can cover it, and where it comes in the order.
 * Lengths are in the viewBox's own units -- generous rather than exact, since
 * an overlong dash costs only a few frames at the head of the draw.
 */
const ink = (order: number, len: number) =>
  ({ "--i": order, "--len": len }) as React.CSSProperties;

/** Three boards and an arrow -- what the note in the lake story is about. */
export function BoardsDoodle({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 240 96" className={className} aria-hidden {...pen}>
      <rect x="6" y="16" width="52" height="64" rx="7" style={ink(0, 232)} />
      <path d="M16 32h32M16 44h24" style={ink(1, 56)} />
      <rect x="94" y="16" width="52" height="64" rx="7" style={ink(1, 232)} />
      <path d="M104 32h32M104 44h20" style={ink(2, 52)} />
      <rect x="182" y="16" width="52" height="64" rx="7" style={ink(2, 232)} />
      <path d="M192 32h32M192 44h26" style={ink(3, 58)} />
      <path d="M66 48h20M154 48h20" style={ink(4, 40)} />
      <path d="M80 42l7 6-7 6M168 42l7 6-7 6" style={ink(5, 37)} />
    </svg>
  );
}

/** A loose circle, for ringing a word the way a pen does. */
export function InkRing({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 56" className={className} aria-hidden preserveAspectRatio="none" {...pen}>
      <path
        d="M28 10C8 16 2 34 20 44c22 12 132 10 158-2 16-8 10-26-12-32C142 4 52 2 28 10z"
        style={ink(0, 430)}
      />
    </svg>
  );
}
