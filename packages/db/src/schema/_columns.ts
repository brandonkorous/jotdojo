/** Column types Drizzle has no builtin for. Shared so the two definitions
 *  cannot drift between schema modules. */
import { customType } from "drizzle-orm/pg-core";

export const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
export const vector1536 = customType<{ data: number[] }>({ dataType: () => "vector(1536)" });
