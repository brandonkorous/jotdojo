import { brand } from "@/lib/brand";

/**
 * The wordmark. design.md §8, ADR-072.
 *
 * The artwork itself, as vector -- it is set at six sizes across the site and a
 * bitmap would be soft at five of them. The mint dot is a drawn element, so no
 * font could carry this even if the letterforms matched.
 *
 * Charcoal ink only, deliberately. A white variant exists at
 * `/brand/wordmark-dark.svg` and is NOT swapped in on `prefers-color-scheme`,
 * because the page it would swap on is still light: `paper-night` is scoped
 * `:root:not([data-theme])` and layout.tsx sets `data-theme="paper"`, so the
 * dark theme never activates. When dark mode is made to work, this is the
 * second half of that change.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    // next/image cannot optimise an SVG -- it passes the file through
    // untouched -- so it would buy nothing here but a loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/wordmark.svg"
      alt={brand.name}
      width={2001}
      height={503}
      className={`jd-wordmark ${className}`}
    />
  );
}
