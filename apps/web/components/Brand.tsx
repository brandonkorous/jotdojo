import { brand } from "@/lib/brand";

/**
 * The wordmark. design.md §8, ADR-072.
 *
 * The artwork itself, as vector -- it is set at six sizes across the site and a
 * bitmap would be soft at five of them. The mint dot is a drawn element, so no
 * font could carry this even if the letterforms matched.
 *
 * Two inks, swapped in CSS by the same selector the themes use. NOT
 * `<picture media="(prefers-color-scheme: dark)")`: that asks the OPERATING
 * SYSTEM, which is only the same question as "is this page dark" while nothing
 * pins the theme -- it served the white mark onto a white header the one time
 * it was tried. Whatever swaps this has to read the theme. ADR-116.
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
