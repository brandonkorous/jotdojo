/**
 * The Stripe product catalogue: one Product per plan, one monthly Price each.
 *
 *     pnpm stripe:catalog                          what exists, and what is missing
 *     pnpm stripe:catalog --tax-codes              candidate tax codes, from Stripe
 *     pnpm stripe:catalog --apply --tax-code txcd_…
 *
 * A COMMAND, not a migration, and it reports before it spends -- the same shape
 * as `pnpm reread` (ADR-046). Creating a Price is permanent: Stripe prices are
 * immutable and cannot be deleted, only deactivated, so a careless run leaves
 * litter in a live account for ever.
 *
 * ONE PRODUCT PER PLAN, not three prices on one product. Checkout and every
 * invoice line show the PRODUCT name, so plans sharing a product produce three
 * indistinguishable line items reading "jotdojo".
 *
 * The key is read from the environment and never printed. Use a RESTRICTED key
 * for this too -- it needs write on Products and Prices and nothing else.
 */

const API = "https://api.stripe.com/v1";
const API_VERSION = "2026-07-29.dahlia";

/** Must match docs/01-audience-and-pricing.md and the pricing page. */
const PLANS = [
  { key: "solo", name: "jotdojo Solo", cents: 500, blurb: "Everything, for one person." },
  { key: "family", name: "jotdojo Family", cents: 900, blurb: "Everything, for up to six people." },
  { key: "team", name: "jotdojo Team", cents: 1900, blurb: "Everything, for a small company." },
];

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. This script never takes a key as an argument.");
  process.exit(1);
}

const flag = (name) => process.argv.includes(`--${name}`);
const value = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : process.argv[at + 1] ?? null;
};

const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");

async function stripe(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${key}`,
      "stripe-version": API_VERSION,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`stripe ${path}: ${json.error?.message ?? res.statusText}`);
  return json;
}

/**
 * Candidate tax codes, from Stripe's own list.
 *
 * Never hardcoded from memory: the exact value has to come from the Tax Codes
 * API, and which one is legally right for a business is not a decision this
 * script or the person running it should make alone.
 */
async function listTaxCodes() {
  const { data } = await stripe("/tax_codes?limit=100");
  const relevant = data.filter((c) =>
    /software|saas|digital|electronically supplied/i.test(`${c.name} ${c.description}`));
  console.log("\nCandidate tax codes. Confirm the right one with your tax advisor:\n");
  for (const c of relevant) console.log(`  ${c.id}  ${c.name}\n      ${c.description}`);
  console.log(`\n${relevant.length} shown of ${data.length}. Full list: https://docs.stripe.com/tax/tax-codes`);
  console.log("Do NOT use txcd_10000000 (General - Electronically Supplied Services)");
  console.log("for US sales; it is too broad for state-level taxability.\n");
}

/** Everything we have already made, found by metadata rather than by name, so
 *  renaming a product in the Dashboard does not orphan it. */
async function existing() {
  const { data } = await stripe("/products?limit=100&active=true");
  const mine = new Map();
  for (const p of data) if (p.metadata?.jotdojo_plan) mine.set(p.metadata.jotdojo_plan, p);
  return mine;
}

async function priceFor(productId, cents) {
  const { data } = await stripe(`/prices?product=${productId}&active=true&limit=100`);
  return data.find((p) =>
    p.unit_amount === cents && p.currency === "usd" && p.recurring?.interval === "month") ?? null;
}

async function survey() {
  const products = await existing();
  const rows = [];
  for (const plan of PLANS) {
    const product = products.get(plan.key) ?? null;
    const price = product ? await priceFor(product.id, plan.cents) : null;
    rows.push({ plan, product, price });
  }
  return rows;
}

function report(rows) {
  console.log(`\n${live ? "LIVE MODE" : "test mode"} — jotdojo catalogue\n`);
  for (const { plan, product, price } of rows) {
    const money = `$${(plan.cents / 100).toFixed(2)}/mo`;
    if (!product) console.log(`  ${plan.key.padEnd(7)} ${money.padEnd(10)} no product`);
    else if (!price) console.log(`  ${plan.key.padEnd(7)} ${money.padEnd(10)} product ${product.id}, NO PRICE`);
    else console.log(`  ${plan.key.padEnd(7)} ${money.padEnd(10)} ${price.id}  (tax code ${product.tax_code ?? "unset"})`);
  }
}

function envLines(rows) {
  console.log("\nPut these where the other secrets live:\n");
  for (const { plan, price } of rows) {
    if (price) console.log(`  STRIPE_PRICE_${plan.key.toUpperCase()}=${price.id}`);
  }
  console.log();
}

async function apply(rows, taxCode, behavior) {
  for (const row of rows) {
    const { plan } = row;
    if (!row.product) {
      row.product = await stripe("/products", {
        name: plan.name,
        description: plan.blurb,
        tax_code: taxCode,
        "metadata[jotdojo_plan]": plan.key,
      });
      console.log(`  created product ${row.product.id} for ${plan.key}`);
    } else if (row.product.tax_code !== taxCode) {
      await stripe(`/products/${row.product.id}`, { tax_code: taxCode });
      console.log(`  set tax code on ${row.product.id}`);
    }

    if (!row.price) {
      row.price = await stripe("/prices", {
        product: row.product.id,
        currency: "usd",
        unit_amount: String(plan.cents),
        "recurring[interval]": "month",
        tax_behavior: behavior,
        "metadata[jotdojo_plan]": plan.key,
      });
      console.log(`  created price ${row.price.id} for ${plan.key}`);
    }
  }
}

async function main() {
  if (flag("tax-codes")) {
    await listTaxCodes();
    return;
  }

  const rows = await survey();
  report(rows);

  if (!flag("apply")) {
    const missing = rows.filter((r) => !r.product || !r.price).length;
    if (missing === 0) {
      console.log("\nNothing to create.");
      envLines(rows);
    } else {
      console.log(`\n${missing} plan(s) would be created. Nothing has been written.`);
      console.log("Re-run with --apply --tax-code <txcd_…> to go ahead.");
      console.log("Run --tax-codes first if you do not have one yet.\n");
    }
    process.exit(0);
  }

  const taxCode = value("tax-code");
  if (!taxCode || !taxCode.startsWith("txcd_")) {
    console.error("\n--apply needs --tax-code <txcd_…>. Run --tax-codes to see candidates.");
    console.error("A product with no tax code collects no tax even once you are registered.\n");
    process.exit(1);
  }

  // Exclusive: tax is added on top of $5, rather than $5 being tax-inclusive.
  // Normal for US sales tax; override for a market that quotes gross prices.
  const behavior = value("tax-behavior") ?? "exclusive";

  if (live) console.log("\nLIVE MODE. Prices cannot be deleted once created, only deactivated.");
  await apply(rows, taxCode, behavior);
  report(await survey());
  envLines(await survey());
}

/**
 * One place for every failure.
 *
 * A rejected top-level await takes the process down with a native assertion
 * on Windows and no message, which reads as a broken script rather than as a
 * rejected key. Stripe already says what went wrong; just print it.
 */
main().catch((err) => {
  console.error(`
${err.message}
`);
  // exitCode, not exit(): calling exit() while fetch's socket is still closing
  // trips a native assertion in libuv on Windows and buries the message that
  // was the entire point of catching.
  process.exitCode = 1;
});
