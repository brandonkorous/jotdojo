/** Entry point for `pnpm reread`. The work is in src/reread.ts. ADR-046. */
import { main } from "../src/reread";

await main();
process.exit(0);
