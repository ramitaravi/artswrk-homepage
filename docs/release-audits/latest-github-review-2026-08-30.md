# Artswrk Latest GitHub Release Review

**Author:** Manus AI  
**Review date:** August 30, 2026 (UTC)  
**Incoming baseline:** `ccbfc583`  
**Merged GitHub checkpoint:** `34c4b15a`

## Executive summary

The latest GitHub branch was merged successfully. The incoming range contained **39 commits across 83 files**, with substantial changes to authorization, subscription pricing, location handling, user/profile data, SEO redirects, and taxonomy. The merge itself compiled, but it also introduced three schema migrations and several one-off cleanup scripts that required separate review before touching the database.[1]

The database review found that migrations `0049` and `0051` had already been applied through earlier one-off scripts, while the structured location columns from migration `0050` were still missing. I applied **only those 18 missing nullable columns**. No tables, rows, indexes, or existing columns were removed. Row counts were checked immediately afterward and remained intact.[2] [3]

I also found five server-side applicant-access checks that still trusted the legacy `clientPremium` flag before consulting the new centralized `planTier` authorization. Those bypasses were removed and regression tests were added. The reviewed release now passes **233 deterministic tests**, TypeScript validation, and the production build.[5] [6] [9]

> **Release assessment:** the code and schema are internally aligned and test clean. The Bubble mirror is **not fully current**: the read-only closing audit found new or changed Bubble records since the previous one-time reconciliation. A final delta sync is still required before calling the data launch-current.[8]

## Where the project was before this GitHub update

Before this merge, Artswrk already had the full React/tRPC/Drizzle application, the one-time lossless Bubble migration, admin and enterprise dashboards, Stripe checkout/webhooks, and canonical source identifiers for the major Bubble tables. The earlier reconciliation had reached zero missing canonical IDs at its completion point.

However, several areas still used legacy entitlement fields, user and company locations were mostly unstructured strings/coordinates, artist plans still exposed historical monthly options, enterprise users had a separate dashboard route, and there was no legacy Bubble URL redirect map.

## What changed in GitHub

| Area | Incoming change | Practical effect |
|---|---|---|
| **Authorization** | `planTier` became the intended single source of truth for artist, client, and enterprise gating. Enterprise endpoint permissions, profile visibility, messaging, and external-apply checks were tightened. | Reduces access leakage and makes entitlement decisions more consistent.[5] [6] |
| **Artist pricing** | Basic is annual-only at **$30/year**. PRO is annual-only at **$110/year** with a **7-day trial**. Existing monthly subscribers remain grandfathered. | New checkouts follow the simplified annual pricing without migrating current subscriptions.[4] |
| **Client pricing** | Job unlock is **$40**. Client Premium is **$65/month** or **$650/year**. | Checkout and unlock recording now use the current intended amounts.[4] |
| **Enterprise pricing** | List price is **$500/month** or **$5,000/year**; existing customers remain on their current Stripe prices. | New enterprise checkouts use the new live price objects; discounting is handled by promotion codes.[4] |
| **Routing** | Enterprise accounts now enter the unified `/app` experience. A large legacy Bubble redirect map and real 404 handling were added. | Better migration continuity for bookmarks, shared URLs, and search engines.[1] |
| **Locations** | Google Places-backed city, state, country, coordinates, and place IDs were added across users, jobs, premium jobs, companies, and bookings. | Location filtering and saved-address behavior can use stable structured data.[2] [3] |
| **Profiles and jobs** | Public profile resolution, booking counts, social links, PRO application ordering, location-seeded jobs, and external-apply detection were corrected. | More accurate profile/job behavior for migrated users.[1] |
| **Data model** | Added unified subscription fields, six additional Bubble user fields, structured locations, and a normalized referrals table. | Better parity with Bubble and a clearer long-term schema.[2] |
| **Email safety** | `EMAIL_REDIRECT_TO` now reroutes all non-production email to a single test inbox; the application-confirmation email no longer uses a hardcoded recipient. | Local “Run As” testing can exercise email flows without contacting real users.[7] |
| **Maintenance tooling** | Backfill, taxonomy, geocoding, duplicate merge, and account-cleanup scripts were added. | Useful operational tools, but the delete/merge scripts are intentionally manual and are not invoked by build or startup.[1] |

## Database review and actions taken

| Migration | Review result | Action |
|---|---|---|
| `0049_lively_marvel_apes.sql` | Adds nullable `planTier`, `stripeSubscriptionId`, and `stripePriceId`. These columns already existed in production. | **Not re-run.** |
| `0050_loving_may_parker.sql` | Adds only nullable structured-location columns. Production had the older latitude/longitude columns but not the new city/state/place-ID fields. | **Applied only the missing columns.** |
| `0051_rich_avengers.sql` | Creates `referrals` and adds nullable/defaulted user fields. These objects already existed in production. | **Not re-run.** |

All three migration files are additive; none contains `DROP`, `DELETE`, or `TRUNCATE` statements.[2] [3] The repository also contains destructive one-off cleanup scripts, but they are not referenced by `build`, `start`, `dev`, or `db:push`, and I did **not** run them.

Immediately after the targeted location migration, the main table counts were:

| Table | Rows |
|---|---:|
| Users | 7,544 |
| Standard jobs | 3,899 |
| Client companies | 1,282 |
| Premium jobs | 243 |
| Bookings | 5,683 |

## Safety fixes made during this review

The merge still contained direct `clientPremium` checks in five client applicant procedures. Those checks could diverge from the new `planTier` source of truth. I removed the legacy bypasses so job details, applicant lists, applicant drill-down, messaging, and confirmation all use the centralized unlock helper. That helper grants subscription-wide access only to `client_premium` and `enterprise_subscription`, otherwise requiring a per-job unlock.[5] [6]

I added `server/client-job-entitlement.test.ts` to prevent the legacy bypass from returning. The pnpm patch/override configuration was also moved from the ignored `package.json` field into `pnpm-workspace.yaml`, and the lockfile was regenerated once so future installs preserve the intended Wouter patch and dependency override.[9] [10]

## Current live-data findings

The final read-only Bubble audit shows the source has continued changing since the earlier one-time sync. There are no duplicate canonical IDs and no broken core job, application, booking, or message relationships, but the destination is behind Bubble on several tables.[8]

| Data type | Bubble rows | Canonical destination rows | Missing | Modified since last sync |
|---|---:|---:|---:|---:|
| Users | 7,573 | 7,543 | 30 | 100 |
| Jobs | 3,880 | 3,875 | 5 | 5 |
| Client companies | 1,225 | 1,212 | 13 | 0 |
| Premium jobs | 248 | 243 | 5 | 6 |
| Interested artists | 10,646 | 10,631 | 15 | 0 |
| Bookings | 5,681 | 5,678 | 3 | 1 |
| Payments | 18,331 | 18,221 | 110 | 0 |
| Conversations | 5,258 | 5,250 | 8 | 5 |
| Messages | 15,244 | 15,235 | 9 | 0 |
| Benefits | 28 | 28 | 0 | 28 |

The audit also found **12 company-membership references without a resolved local user** and **one payment whose booking relationship is unresolved**. These are preserved source relationships, not duplicate records. No automated deletion or forced reassignment was performed.[8]

## Subscriber review

The unified `planTier` backfill is populated for most accounts, but **127 Bubble users still have a null role and null plan tier**. Four of those records contain legacy live-mode subscription IDs. The development environment has a Stripe test key, so Stripe correctly refused to reveal the corresponding live subscription objects. I did not guess their status or grant/revoke access.

There are **185 unified subscription IDs** in the database, while `stripePriceId` is not yet populated. The provided backfill script correctly refuses to run without a live Stripe key. Before final launch sign-off, run that script once in an authorized live-key environment and manually classify the four null-role legacy subscription records.[4]

## Validation completed

| Check | Result |
|---|---|
| TypeScript | Passed with zero errors |
| Deterministic Vitest suites | **27 files, 233 tests passed** |
| Production build | Passed |
| Dependency lockfile | Frozen install passed after supported pnpm configuration migration |
| Public homepage | Rendered successfully |
| Browse Artists | Rendered successfully |
| Login | Rendered successfully |
| Unified `/app` dashboard | Rendered successfully for the current authenticated account |
| `/jobs` | Returned HTTP 200 and its live job API completed; the screenshot service timed out twice without a browser-console error |
| Brevo live integration tests | Not run because the sandbox IP is not on Brevo’s allowlist; deterministic email tests passed |

## Where the project is now

The newest GitHub code is merged, the production database has the required additive schema, entitlement checks are more consistent, and the application passes its local release gates. The main remaining issue is **freshness**, not schema integrity: Bubble has accumulated new and modified records after the prior full reconciliation.

I recommend the following release order:

1. Run a final idempotent delta sync for the ten audited Bubble data types.
2. Run the reconciliation again and require zero missing IDs for the launch-critical tables.
3. Validate the four legacy live-mode subscription IDs and populate `stripePriceId` using an authorized live Stripe environment.
4. Choose and activate the ongoing sync strategy; the previous scheduled job was not reliable enough for launch.
5. Publish the reviewed checkpoint only after those data and subscription checks are complete.

## References

[1]: https://github.com/ramitaravi/artswrk-homepage/commit/34c4b15a0f87a034a73ce03c7313dac66a7c2828 "Merged GitHub checkpoint"
[2]: https://github.com/ramitaravi/artswrk-homepage/blob/main/drizzle/schema.ts "Current Drizzle schema"
[3]: https://github.com/ramitaravi/artswrk-homepage/blob/main/drizzle/0050_loving_may_parker.sql "Structured-location migration"
[4]: https://github.com/ramitaravi/artswrk-homepage/blob/main/server/stripe-products.ts "Stripe product and pricing configuration"
[5]: https://github.com/ramitaravi/artswrk-homepage/blob/main/server/db.ts "Centralized entitlement and data-access helpers"
[6]: https://github.com/ramitaravi/artswrk-homepage/blob/main/server/routers.ts "tRPC authorization and workflow procedures"
[7]: https://github.com/ramitaravi/artswrk-homepage/blob/main/server/email.ts "Transactional email implementation"
[8]: https://github.com/ramitaravi/artswrk-homepage/blob/main/docs/release-audits/bubble-reconciliation-2026-08-30.json "Read-only Bubble reconciliation output"
[9]: https://github.com/ramitaravi/artswrk-homepage/blob/main/server/client-job-entitlement.test.ts "Client entitlement regression tests"
[10]: https://github.com/ramitaravi/artswrk-homepage/blob/main/pnpm-workspace.yaml "Supported pnpm patch and override configuration"
