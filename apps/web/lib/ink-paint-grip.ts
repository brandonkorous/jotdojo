import type { Gripped } from "./ink-selection-grip";
import { gripPoints } from "./ink-selection-grip";
import { SELECT_STROKE } from "./ink-paint";

/**
 * The outline of one held object, turned as it is, with its two handles.
 * ADR-122. Constant on screen, like the marquee it replaces.
 */
export function paintGrips(ctx: CanvasRenderingContext2D, g: Gripped, k = 1) {
  const p = gripPoints(g, k);
  ctx.save();
  ctx.strokeStyle = SELECT_STROKE;
  ctx.lineWidth = 1.5 / k;
  ctx.beginPath();
  p.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.moveTo(p.top[0], p.top[1]);
  ctx.lineTo(p.knob[0], p.knob[1]);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  const r = 6 / k;
  ctx.beginPath();
  ctx.arc(p.knob[0], p.knob[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(p.resize[0] - r, p.resize[1] - r, r * 2, r * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
