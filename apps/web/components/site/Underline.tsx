/**
 * The pen stroke under a few words. design.md §13, ADR-088.
 *
 * It used to be a background image, which can only be revealed by squashing --
 * the far end of the stroke is already on the page at 10%. A real path can be
 * drawn along itself, so the site's own gesture is the one thing on the page
 * that arrives the way it was made.
 */

type Props = {
  children: React.ReactNode;
  /** A phrase a pen stroke must not be broken across. One gesture, one line. */
  keep?: boolean;
  className?: string;
};

/** The same sag as the mark: it does not land level, because a ruled line reads
 *  as a border and says nothing. `pathLength` normalises the dash to 1 so the
 *  draw is the same speed however wide the phrase turns out to be. */
export function Underline({ children, keep = false, className = "" }: Props) {
  const classes = ["jd-ul", keep ? "jd-ul-keep" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {children}
      <svg
        className="jd-ul-stroke"
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M3,4.5 Q34,11 63,7.5 T97,5"
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
