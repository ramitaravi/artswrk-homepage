/**
 * One-off backfill: compute planTier / stripeSubscriptionId for every
 * existing user from their current artswrkPro / artswrkBasic / clientPremium /
 * enterprise / enterprisePlan / *StripeSubscriptionId fields.
 *
 * Purely additive — only ever writes the NEW columns (planTier,
 * stripeSubscriptionId, stripePriceId, and stripeCustomerId where a client/
 * enterprise row's own copy was empty). Never touches the old fields, so this
 * is safe to re-run any number of times and easy to verify against them.
 *
 * Requires the 0049_lively_marvel_apes.sql migration to already be applied
 * (planTier / stripeSubscriptionId / stripePriceId columns must exist).
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run(label, sql) {
  const [result] = await conn.execute(sql);
  console.log(`${label}: ${result.affectedRows} rows`);
}

console.log("Backfilling planTier + stripeSubscriptionId...\n");

// ── Artists ──────────────────────────────────────────────────────────────
await run(
  "artist_pro",
  `UPDATE users SET
     planTier = 'artist_pro',
     stripeSubscriptionId = NULLIF(artistStripeProductId, '')
   WHERE userRole = 'Artist' AND artswrkPro = 1`
);
await run(
  "artist_basic",
  `UPDATE users SET
     planTier = 'artist_basic',
     stripeSubscriptionId = NULLIF(artistStripeProductId, '')
   WHERE userRole = 'Artist' AND (artswrkPro = 0 OR artswrkPro IS NULL) AND artswrkBasic = 1`
);
await run(
  "artist_free",
  `UPDATE users SET planTier = 'artist_free'
   WHERE userRole = 'Artist'
     AND (artswrkPro = 0 OR artswrkPro IS NULL)
     AND (artswrkBasic = 0 OR artswrkBasic IS NULL)`
);

// ── Enterprise (checked before plain Client since `enterprise` takes
// priority over `clientPremium` if a row somehow has both) ────────────────
await run(
  "enterprise_subscription",
  `UPDATE users SET
     planTier = 'enterprise_subscription',
     stripeSubscriptionId = NULLIF(enterpriseStripeSubscriptionId, ''),
     stripeCustomerId = COALESCE(NULLIF(stripeCustomerId, ''), NULLIF(enterpriseStripeCustomerId, ''))
   WHERE userRole = 'Client' AND enterprise = 1
     AND enterpriseStripeSubscriptionId IS NOT NULL AND enterpriseStripeSubscriptionId != ''`
);
await run(
  "enterprise_on_demand",
  `UPDATE users SET
     planTier = 'enterprise_on_demand',
     stripeCustomerId = COALESCE(NULLIF(stripeCustomerId, ''), NULLIF(enterpriseStripeCustomerId, ''))
   WHERE userRole = 'Client' AND enterprise = 1
     AND (enterpriseStripeSubscriptionId IS NULL OR enterpriseStripeSubscriptionId = '')`
);

// ── Regular clients ──────────────────────────────────────────────────────
await run(
  "client_premium",
  `UPDATE users SET
     planTier = 'client_premium',
     stripeSubscriptionId = NULLIF(clientSubscriptionId, ''),
     stripeCustomerId = COALESCE(NULLIF(stripeCustomerId, ''), NULLIF(clientStripeCustomerId, ''))
   WHERE userRole = 'Client' AND (enterprise = 0 OR enterprise IS NULL) AND clientPremium = 1`
);
await run(
  "client_on_demand",
  `UPDATE users SET
     planTier = 'client_on_demand',
     stripeCustomerId = COALESCE(NULLIF(stripeCustomerId, ''), NULLIF(clientStripeCustomerId, ''))
   WHERE userRole = 'Client' AND (enterprise = 0 OR enterprise IS NULL) AND (clientPremium = 0 OR clientPremium IS NULL)`
);

console.log("\n── Verification ──");
const [[{ total }]] = await conn.execute(`SELECT COUNT(*) AS total FROM users`);
const [[{ tagged }]] = await conn.execute(`SELECT COUNT(*) AS tagged FROM users WHERE planTier IS NOT NULL`);
const [byTier] = await conn.execute(
  `SELECT planTier, COUNT(*) AS n FROM users GROUP BY planTier ORDER BY n DESC`
);
console.log(`Total users: ${total} | Tagged with a planTier: ${tagged}`);
console.table(byTier);

const [[mismatchArtist]] = await conn.execute(
  `SELECT COUNT(*) AS n FROM users
   WHERE userRole = 'Artist'
     AND ((artswrkPro = 1) != (planTier = 'artist_pro')
          OR (artswrkBasic = 1 AND artswrkPro != 1) != (planTier = 'artist_basic'))`
);
console.log(`Artist rows where planTier disagrees with artswrkPro/Basic: ${mismatchArtist.n}`);

await conn.end();
