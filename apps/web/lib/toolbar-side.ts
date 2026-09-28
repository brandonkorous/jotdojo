export type Side = "left" | "right";
/** The stored preference: which side the tools sit on. `auto` is the left. */
export type Align = "auto" | Side;

// The preference keeps the tools away from the hand holding the pencil. The
// search and the avatar take the other top corner. ADR-012, ADR-120.
export const railSide = (align: Align): Side => (align === "right" ? "right" : "left");
export const cornerSide = (align: Align): Side => (align === "right" ? "left" : "right");
