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

    packages/domain/src/oauth.ts    564

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
