/**
 * Which theme somebody is on, and whether they chose it. ADR-116.
 *
 * Deliberately NOT a server preference the way the toolbar side is. Which hand
 * holds the pencil is a fact about a person; light or dark is a fact about a
 * room, and syncing it would hand a desk at noon the answer a phone gave in
 * bed. Same reasoning as `tool-memory.ts`, for the same kind of fact.
 */

export type ThemeChoice = "auto" | "paper" | "paper-night";

export const THEME_KEY = "jotacular.theme";

const CHOICES: readonly ThemeChoice[] = ["auto", "paper", "paper-night"];

export const isChoice = (v: string): v is ThemeChoice =>
  (CHOICES as readonly string[]).includes(v);

/** Storage can throw outright in a locked-down Safari, not merely return null,
 *  so both directions are guarded. A forgotten choice is `auto`. */
export function themeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && isChoice(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Put the choice on the page.
 *
 * `auto` REMOVES the attribute rather than resolving it, because that is what
 * `paper-night` is scoped to (`:root:not([data-theme])`) and it is what keeps
 * the page following the room without anything having to listen.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/**
 * Whether the page is dark AS DRAWN, which is not the same as what was chosen:
 * `auto` on a dark machine is a dark page and an empty attribute. Both themes
 * set `color-scheme`, so that is the one thing true in every case.
 */
export const pageIsDark = (): boolean => (typeof document === "undefined"
  ? false
  : getComputedStyle(document.documentElement).colorScheme.includes("dark"));

export function rememberTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // A theme that will not stick is a smaller problem than a page that will
    // not load.
  }
}

/**
 * The same three lines, as a string for the inline script in `<head>`.
 *
 * It has to run BEFORE the first paint or a person who chose light on a dark
 * machine gets a black flash on every navigation, which is the one thing a
 * theme toggle must not do. Small enough to read, and it fails silently.
 */
export const THEME_BOOT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});`
  + `if(t==="paper"||t==="paper-night")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
