# 011 — The app tells a Windows reader to press a key she does not have

**Status:** fixed
**Severity:** minor
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › the toolbar (Search) · app › the ⌘K palette (New note) · app › Tool options (Bold, Italic, Underline)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 5 · 2026-09-16
**Blocked on:** —

## What happened

Three places in the app print a keyboard shortcut, and all three printed the Mac
symbol to everybody:

| Where | Said |
| --- | --- |
| The magnifier's tooltip | `Search notes, or jump somewhere  ⌘K` |
| `New note` in the palette | `⌘N` |
| Bold, Italic, Underline | `Bold  ⌘B` |

This run is on Windows, where the key is **Ctrl**. `⌘` is not on the keyboard and
is not a symbol most Windows readers can name.

## What should have happened

She is told the key her machine actually has.

## How to reproduce

On Windows, Linux or Android: hover the magnifier in the toolbar, or open ⌘K and
read the badge beside `New note`.

## Why it matters

`minor` — it is one symbol, and the shortcut itself has always worked.

It is filed rather than waved through for two reasons. First, **it is an
instruction that does not work**: the product tells somebody to press a key, and
pressing it is impossible. Under RULE #3 a false sentence is a defect however small
the sentence. Second, jotacular's own keyboard handler already gets this right —
`use-canvas-keys.ts` reads `e.metaKey || e.ctrlKey` and says so in a comment:

> *Cmd on a Mac, Ctrl everywhere else. Reading both is not a guess about the
> platform.*

The behaviour knew about both platforms. Only the label did not, which is the
*fix leaves its neighbour behind* shape.

Marisol is mostly on a phone, where no modifier exists and no tooltip appears. It
costs her nothing. It costs whoever opens this on a Windows laptop a guess.

## Where it lives

Three hardcoded strings:

- `apps/web/components/Chrome.tsx` — the search tooltip and the `New note` badge
- `apps/web/components/ToolOptions.tsx` — the three formatting tooltips

## The fix

One hook, `apps/web/lib/mod-key.ts`, and the three strings read it:

```ts
export function useModKey(): string {
  const [mod, setMod] = useState("Ctrl+");
  useEffect(() => {
    if (isApple()) setMod("⌘");
  }, []);
  return mod;
}
```

**Ctrl on the server and on the first paint**, so the markup the server sent and
the markup React first renders agree, and only a Mac changes afterwards. Doing it
the other way round — ⌘ first, corrected to Ctrl — would hydrate mismatched on
every Windows machine, which is the majority of them.

Detection reads `navigator.platform` first and the user agent as a fallback:
`platform` is deprecated and is still the only reliable answer in desktop Safari,
and the user agent is what catches iPadOS, which reports itself as a Mac.

## Confirmed by

**P01 Marisol, act 5, 2026-09-16.** On this machine (`navigator.platform` is
`Win32`), read from the live page:

```
Search notes, or jump somewhere  Ctrl+K
```

and the palette badge beside `New note` reads `Ctrl+N`. Screenshotted at 360px.

Not checked on a Mac — there is no Mac in this run. The Mac branch is reasoned,
not measured, and says so here rather than being recorded as a pass.

## Rating effect

None on its own. It was part of the gap to 10 on `The canvas`, which is re-scored
in act 5 for issues 009 and 012.
