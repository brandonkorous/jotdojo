/**
 * Somebody's jot, already on the paper. ADR-094.
 *
 * The same one on the Open Graph card (scripts/og/opengraph.html) so the page
 * shows what the link promised. Inert: aria-hidden, no pointer events, and no
 * part of the draft -- the first touch clears it (site-hero.css).
 */
export function HeroJot() {
  return (
    <div className="jd-hero-jot" aria-hidden>
      <div className="jd-hero-jot-typed font-sans">
        <p>reading nook</p>
        <p>- soft light</p>
        <p>- good books</p>
        <p>- favorite mug</p>
        <p className="jd-hero-jot-hand font-hand">the corner by the window</p>
      </div>
      <Drawing />
    </div>
  );
}

/**
 * A few confident strokes, not a rendering. design.md §16.
 *
 * `pathLength` normalises every dash to 1, so each line draws itself in the
 * same time however long it actually is.
 */
function Drawing() {
  return (
    <svg
      className="jd-hero-jot-drawn"
      viewBox="0 0 320 168"
      preserveAspectRatio="xMaxYMax meet"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* armchair */}
      <path pathLength={1} d="M36 140 V80 Q36 60 58 60 H124 Q146 60 146 80 V140" />
      <path pathLength={1} d="M36 110 H146" />
      <path pathLength={1} d="M62 106 q28 -13 56 0" />
      <path pathLength={1} d="M46 140 v14 M136 140 v14" />
      {/* a stack of three */}
      <path pathLength={1} d="M168 154 h48 v-11 h-48 z" />
      <path pathLength={1} d="M172 143 h42 v-11 h-42 z" />
      <path pathLength={1} d="M177 132 h34 v-10 h-34 z" />
      {/* arc lamp */}
      <path pathLength={1} d="M262 154 h44" />
      <path pathLength={1} d="M284 154 V76 C284 42 246 34 228 46" />
      <path pathLength={1} d="M210 44 h38 l-10 26 h-18 z" />
      {/* the one violet mark on the paper */}
      <path
        pathLength={1}
        className="jd-hero-jot-heart"
        d="M92 36 C82 29 76 24 76 18 A8 8 0 0 1 92 15 8 8 0 0 1 108 18 c0 6 -6 11 -16 18 z"
      />
    </svg>
  );
}
