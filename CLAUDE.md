# Jotacular — repository rules

Project context lives in [docs/](docs/README.md). This file is the short list of rules that
apply to every change, in every package.

## Code size limits

These are hard limits, not guidelines. They apply to hand-written source — TypeScript, TSX,
JavaScript, CSS, SQL — in `apps/`, `packages/`, `infra/` and `scripts/`.

**A file must not exceed 250 lines.** Count the whole file, blank lines and imports
included. At the limit, split by responsibility rather than by line count: a module doing
one thing that has grown past 250 lines is usually two things wearing one name.

**A function or method must not exceed 50 lines.** Count the signature through the closing
brace. Extract the inner steps as named helpers; a helper with a good name is documentation
that cannot go stale.

**A comment must not exceed 3 lines.** One idea, three lines, then stop. Anything longer is
either a design decision — which belongs in `docs/15-decision-log.md` as an ADR, linked
from the code — or a sign the code needs a clearer name instead of a paragraph of defence.

### Not covered

Generated files, `pnpm-lock.yaml`, migrations under `packages/db/migrations`, and the
`docs/` prose. Migrations are a literal record of what ran against a database and are never
edited or split after the fact.

### Checking

    git ls-files '*.ts' '*.tsx' '*.js' '*.css' | xargs wc -l | sort -rn | head

### Known violations

These predate the rule and must be split the next time they are edited for any other
reason. Do not batch-refactor them for their own sake.

**The list is empty.** `packages/domain/src/oauth.ts` was the last one, and it came
off on 2026-09-16 -- see the end of this file.

`packages/domain/src/ink.ts` came off this list on 2026-08-22. It was edited for another
reason, so it was split as the rule requires: `ink-doc.ts` is what an ink document IS,
`ink-block.ts` is a block's lifecycle, and `ink.ts` is writing strokes into one.

Later the same day, live updates (ADR-058) edited it again and it split again, along with
the two client files that had reached the limit beside it:

    ink.ts            appending strokes -- the path that runs while somebody writes
    ink-delta.ts      changing the middle of a page, by naming strokes
    ink-page.ts       taking hold of a page and putting it back
    ink-recognition.ts   what a changed page owes a recognizer

    ink-engine.ts     what is on the surface
    ink-painter.ts    when it gets painted
    ink-framing.ts    where the camera points
    ink-merge.ts      reconciling this page with the server's

Both times the split was by responsibility. Both times the file was already being edited
for something else, which is the only time the rule asks for it.

On 2026-08-24 the canvas work (ADR-101, ADR-102, ADR-103) hit the limit six more times,
and every split was by responsibility rather than by line count:

    pen-size.css          one control, not the furniture it sits in
    ink-input-select.ts   the one tool whose gesture is unnamed until the pointer lifts
    ink-engine-size.ts    how big a caught thing is, and what shape it turned out to be
    ink-engine-live.ts    what another device did, of every kind
    ink-object-plane.ts   both plane layers under one owner
    use-canvas-tool.ts    which tool is in hand

Comments on canvas objects (ADR-107) split two more the same day, and the seam
was the same both times -- what is assembled once, apart from what runs:

    ink-engine-build.ts   what is wired to what, at mount
    ink-engine.ts         what the page does about a pointer

    remarks.css           the drawer, which sits still
    remark-canvas.css     the pin and the popup, which move with the camera

On 2026-09-15 arrows, undo and the clipboard (ADR-108, ADR-109, ADR-110) hit the
limit five more times. Every split was by responsibility:

    ink-engine-tap.ts     what a tap landed on, of the four things it can mean
    ink-engine-open.ts    a page arriving, and where the camera looks
    ink-engine.ts         what is left: a pointer, and a frame loop

    ink-delta.ts          the wire contract -- what a client may say
    ink-apply.ts          what saying it does to four arrays

    ink-text.ts           what a text box IS
    ink-text-block.ts     the searchable row that shadows the page

    svg-parts.ts          what one object looks like
    svg.ts                the frame round them -- viewBox, scale, paper, order

    CanvasMenuItems.tsx   what the menu offers
    CanvasMenu.tsx        where it opens

On 2026-09-16 stickers (ADR-115) hit the limit three more times, and the seam
was the same each time -- what a thing IS, apart from what happens to it:

    ink-objects.ts        a text box, which is complicated
    ink-rects.ts          a photo and a sticker, which are four numbers

    ink-selection.ts      the lifecycle: a loop, a marquee, a drag
    ink-selection-held.ts what is held, of four kinds

    ink.css               the writing surface and the furniture round it
    ink-sticker.css       one object that sits on it, and moves with the camera
    sticker-tray.css      the tray you pick from, which sits still on the glass

Later the same day, a one-word fix to the spine's invitation (issue 037) pushed
Canvas.tsx to 251, and it split on a seam the file had already named for itself:

    use-blank-tap.ts      whether a pointer on bare paper was a tap or a pan
    Canvas.tsx            what is on the page

The gesture took its own constant, its own ref and its own ADR-102 paragraph with
it. It is six pixels of arithmetic that nothing else in the component read.

On 2026-09-16 the last known violation came off the list. Issue 024 needed one
branch inside `verifyAccessToken`, and that branch lands in `oauth.ts` -- so the
rule applied, and 564 lines split six ways by responsibility:

    oauth.ts              the shared words: a scope, a failure, how long a grant lives
    oauth-client.ts       who is asking -- registration, and the document that proves it
    oauth-grant.ts        what a person agreed to, for one minute
    oauth-mint.ts         turning that into a pair of tokens, and rotating it safely
    oauth-token.ts        what a bearer token is worth, and why it is not
    oauth-connections.ts  what a person can see on their account, and take back

The seam issue 024 predicted -- "what a token IS and how it is verified, apart from
the authorization-code dance that mints one" -- is the one that was there. Nothing
outside the package changed name: every caller already imported from the barrel.

Later the same day, closing the last five persona issues hit the limit twice more,
and both times the addition named its own seam rather than the file being too long:

    actions.ts            what the CANVAS and the account do
    dashboard-actions.ts  what the dashboard does to a LIST -- rename a space,
                          throw a note away, put it back

A list is the only place somebody acts on something they are not looking at, which
is why those three actions ask for confirmation and the canvas ones do not.

    smoke-objects.ts      what a lasso CATCHES
    smoke-box-width.ts    how wide a new box BEGINS

The second was written into the first and pushed it to 259. They are two questions
about the same object, and only one of them is about selection.

Later the same day, a size check found two files that the persona work had pushed
over the limit without anybody looking — `ink-input.ts` at 266 and `Canvas.tsx` at
251, while this section said the list was empty. Both split on a seam the file had
already written down for itself:

    ink-input-host.ts     what a pointer may ASK of the page
    ink-input.ts          the machine that routes one

The type was already introduced as "what the input machine is allowed to ask",
which is a different sentence from anything the class below it does.

    use-chrome-dim.ts     when the furniture fades, and when it comes back
    Canvas.tsx            what is on the page

The dimming took its own three-second constant, its own ref and the whole
performance argument for its guard with it — a hot-path detail that nothing else
in the component reads, which is the same reason `use-blank-tap.ts` left.

**Checking is not optional.** Both of these passed typecheck, lint and fifty smoke
suites while breaking a hard rule, because no tool enforces it. Run the command
above before saying the list is empty.
