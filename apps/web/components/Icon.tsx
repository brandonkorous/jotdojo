import { ICONS, type IconName } from "@/lib/icons";
import type { IconDefinition } from "@/lib/icons";

/**
 * The one icon component. ADR-083.
 *
 * A kit icon IS its path -- `[width, height, ligatures, unicode, d]` -- so this
 * draws it directly rather than going through `@fortawesome/react-fontawesome`.
 * That keeps icons out of the client bundle where the caller is a server
 * component, adds no runtime, and skips `fontawesome-svg-core`'s CSS injection,
 * which on the App Router needs its own opt-out to stop every icon flashing at
 * full size on first paint.
 *
 * Sizing is Font Awesome's own: one em tall, and as wide as the artwork is.
 * Callers set the size with `font-size` on the svg, never with width and
 * height -- `pen-line` is 640x512, and a square box would squash it.
 */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <Drawn glyph={ICONS[name]} className={className} />;
}

export function Drawn(
  { glyph, className = "" }: { glyph: IconDefinition; className?: string },
) {
  const [width, height, , , path] = glyph.icon;
  const d = Array.isArray(path) ? path[path.length - 1] : path;
  return (
    <svg
      className={`jd-icon ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: `${(width / height).toFixed(4)}em` }}
      fill="currentColor"
      focusable="false"
      role="presentation"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
