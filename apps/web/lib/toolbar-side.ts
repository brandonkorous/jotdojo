export type Side = "left" | "right";
/** Where the single chrome pill sits along the top edge. */
export type Align = "auto" | Side;

/**
 * Chrome placement. ADR-012, as amended when the two toolbars became one.
 *
 * There used to be a hook here that measured the viewport: phone → bottom bar,
 * tablet → left rail, desktop → right rail. All three are gone, and the
 * measuring went with them.
 *
 * One pill along the top edge is the right answer on every viewport, and the
 * bottom bar was actively wrong on the device it was designed for: a software
 * keyboard covers the bottom of a phone exactly when someone is typing, which
 * is the whole time they are using this app.
 *
 * The stored left/right preference survives and still means what it always
 * meant — keep the chrome away from the hand holding the pencil. It now shifts
 * the one pill along the top edge instead of choosing a side for a rail that no
 * longer exists. `auto` centres it, which is where people look for a search
 * field.
 *
 * Kept as a module so the preference has one home and one explanation; there is
 * deliberately no hook and no function, because there is nothing left to
 * measure or compute.
 */
