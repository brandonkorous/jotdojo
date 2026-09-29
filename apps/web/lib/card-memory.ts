import { DEFAULT_CARD } from "@jotacular/ink-render";
import { CARD_COLORS } from "./ink-cards";

/**
 * The colour a new note starts as: the last one somebody picked on this
 * device, or paper. ADR-131. Per device, like the tool in hand (ADR-101), and
 * guarded both ways because storage can throw rather than return null.
 */
const KEY = "jd:card";
const KNOWN = new Set(CARD_COLORS.map((c) => c.fill));

export function rememberedCard(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v && KNOWN.has(v) ? v : DEFAULT_CARD;
  } catch {
    return DEFAULT_CARD;
  }
}

export function rememberCard(fill: string) {
  try { localStorage.setItem(KEY, fill); } catch { /* a private window */ }
}
