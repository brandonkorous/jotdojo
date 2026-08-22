# jotdojo — repository rules

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
    packages/domain/src/ink.ts      408
