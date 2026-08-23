import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// `next lint` was removed in Next 16 and never worked here anyway: it has no
// config to read, so it drops into an interactive setup prompt and any
// non-interactive caller -- CI, a hook, an agent -- sees only exit 1.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  // Build output, not source. `.next-verify` is the verification build that
  // next.config.ts keeps away from the dev server.
  { ignores: [".next/**", ".next-verify/**", "node_modules/**", "next-env.d.ts"] },

  ...compat.extends("next/core-web-vitals"),

  {
    rules: {
      // A Pages Router rule -- its own message names `pages/_document.js`. The
      // font link lives in the App Router root layout, which every page shares,
      // so the thing it warns about cannot happen here.
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default config;
