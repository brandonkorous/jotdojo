/**
 * Every workspace package an image needs must actually be IN the image.
 *
 * The triage agent shipped a new package, `@jotacular/reason`, and nothing copied
 * it into worker.Dockerfile. Typecheck passed, sixteen suites passed, CI went
 * green, and the container crashlooped in production on
 * `ERR_MODULE_NOT_FOUND`. Nothing in this repo was in a position to notice,
 * because every check runs against the workspace where the package is present.
 *
 * The rule is the whole declared closure, with no exemption for packages that
 * are only imported as TYPES today. `@jotacular/billing` was exactly that -- an
 * `import type` in domain, stripped at transpile, absent from three images and
 * harmless until the day somebody imports a value from it. A rule with an
 * exception list is a rule that gets an entry added instead of being obeyed.
 *
 * `web` is exempt and is the one real exception: Next traces its own
 * dependencies into `.next/standalone`, so its Dockerfile copies a bundle
 * rather than the packages.
 */
import { readFileSync } from "node:fs";

const TSX_IMAGES = ["api", "mcp", "worker"] as const;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The `@jotacular/*` names a package.json declares as runtime dependencies. */
function deps(dir: string): string[] {
  const json = JSON.parse(read(`${dir}/package.json`)) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(json.dependencies ?? {})
    .filter((name) => name.startsWith("@jotacular/"))
    .map((name) => name.slice("@jotacular/".length));
}

/** Transitive, because an image needs what its dependencies need. */
function closure(names: string[], seen = new Set<string>()): Set<string> {
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    closure(deps(`packages/${name}`), seen);
  }
  return seen;
}

console.log("\nevery package an image needs is copied into it");

for (const app of TSX_IMAGES) {
  const dockerfile = read(`infra/docker/${app}.Dockerfile`);

  // Both stages matter and they fail differently: a package.json missing from
  // the deps stage breaks the install, and a package missing from the runtime
  // stage builds a clean image that dies on its first import.
  const missing = [...closure(deps(`apps/${app}`))].filter((pkg) => {
    const manifest = dockerfile.includes(`COPY packages/${pkg}/package.json`);
    const source = new RegExp(`COPY [^\\n]*packages/${pkg} \\./packages/${pkg}\\b`).test(dockerfile);
    return !manifest || !source;
  });

  check(`${app} carries all ${closure(deps(`apps/${app}`)).size} of its workspace packages`,
    missing.length === 0, `missing: ${missing.join(", ")}`);
}

/**
 * A native dependency that pnpm never builds is a runtime failure, not an
 * install one. ADR-062.
 *
 * `sharp` ships prebuilt binaries per libc and fetches the right one from its
 * INSTALL SCRIPT, which pnpm runs only for packages named in
 * `pnpm.onlyBuiltDependencies`. Drop the entry and every install still succeeds;
 * the first ink render in an Alpine container then dies with "Could not load
 * the sharp module using the linuxmusl-x64 runtime". Three apps depend on it
 * now -- worker, web and mcp -- so the entry is load bearing in three places
 * and named in none of them.
 */
console.log("\nnative dependencies are actually built");

const root = JSON.parse(read("package.json")) as {
  pnpm?: { onlyBuiltDependencies?: string[] };
};
const built = new Set(root.pnpm?.onlyBuiltDependencies ?? []);
const NATIVE = ["sharp"];

for (const name of NATIVE) {
  const users = ["api", "mcp", "web", "worker"].filter((app) => {
    const json = JSON.parse(read(`apps/${app}/package.json`)) as {
      dependencies?: Record<string, string>;
    };
    return name in (json.dependencies ?? {});
  });
  if (users.length === 0) continue;
  check(`${name} is in onlyBuiltDependencies (needed by ${users.join(", ")})`, built.has(name),
    "add it to package.json pnpm.onlyBuiltDependencies");
}

console.log(failures === 0
  ? "\nimage package check: all checks passed"
  : `\nimage package check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
