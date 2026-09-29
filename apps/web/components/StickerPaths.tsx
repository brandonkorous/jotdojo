import { stickerBacking, type StickerPlacement } from "@jotacular/ink-render";

/**
 * One sticker's two paths: the white it is cut from, then the art on it.
 * ADR-128. Shared by the tray and the ghost, so both match the page.
 */
export function StickerPaths({ name, color, p }: {
  name: string;
  color: string;
  p: StickerPlacement;
}) {
  return (
    <>
      <path d={stickerBacking(name)} fill="#FFFFFF" stroke="#FFFFFF"
        strokeWidth={p.stroke} strokeLinejoin="round" />
      <path d={p.art.d} fill={color} />
    </>
  );
}
