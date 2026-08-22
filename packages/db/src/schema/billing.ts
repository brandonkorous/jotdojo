/** Per-space subscriptions. migrations/0016_space_billing.sql, ADR-038. */
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { spaces } from "./identity";

export const spaceBilling = pgTable("space_billing", {
  spaceId: uuid("space_id").primaryKey().references(() => spaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  customerId: text("customer_id").notNull(),
  subscriptionId: text("subscription_id"),
  status: text("status").notNull().default("canceled"),
  /** What was BOUGHT. `spaces.plan` is what is currently allowed, and the two
   *  differ while a payment is failing. */
  plan: text("plan").notNull().default("free"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("space_billing_customer_idx").on(t.provider, t.customerId)]);
