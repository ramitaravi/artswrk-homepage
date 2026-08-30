# SendGrid setup for job alert emails — handoff

Written 2026-08-29 for whoever picks this up next. Self-contained: you don't
need the conversation that produced it.

---

## TL;DR — you do NOT need to build a SendGrid template

The job alert emails are **not** SendGrid dynamic templates. The HTML lives in
`server/jobAlerts/templates.ts` and is sent as a complete message body via
`sendHtmlEmail()` in `server/email.ts`. SendGrid is only the delivery pipe.

**Do not create a template for these.** If you do, nothing will use it, and
you'll have two sources of truth for the same email.

There is exactly **one** thing that must be done in the SendGrid UI or API:
turn on the **Event Webhook** (Task 1 below). Everything else is optional
cleanup.

---

## What is already done — don't redo any of this

| Thing | State | Evidence |
|---|---|---|
| API key | Working | `SENDGRID_API_KEY` in `.env`; used to create the group below |
| Sender `contact@artswrk.com` | Verified | `GET /v3/verified_senders` |
| Domain authentication for `artswrk.com` | Valid | `GET /v3/whitelabel/domains` |
| Unsubscribe group **"Job Alerts"** | Created — **id `33079`** | `GET /v3/asm/groups` |
| Job alert emails stamp that group | Wired | `ASM_GROUP_JOB_ALERTS` in `server/email.ts` |
| `List-Unsubscribe` + one-click headers | Wired | `sendHtmlEmail({ unsubscribeUrl })` |
| Unsubscribe page + signed token | Built | `server/jobAlerts/unsubscribe.ts`, routes in `server/_core/index.ts` |
| Webhook receiver | Built | `server/jobAlerts/webhook.ts` → `POST /api/webhooks/sendgrid` |

**Do not create a second unsubscribe group.** `33079` already exists and is
referenced in code. Group `24547` ("Transactional emails", the account default)
is for booking confirmations, messages and password resets — leave it alone.
The split is deliberate: unsubscribing from job alerts must not silence
booking confirmations.

---

## Task 1 — turn on the Event Webhook  ← the only required step

Without this, a hard bounce or spam report never reaches our suppression table,
so we keep emailing dead addresses. That is what gets a sending domain blocked.

Current state: `enabled: false`, no URL set.

### Option A — SendGrid UI

1. SendGrid → **Settings → Mail Settings → Event Webhooks**
2. **Create new webhook**
3. **Post URL:** `https://artswrk.com/api/webhooks/sendgrid`
   (substitute the real production origin if it differs — it must be the
   deployed app, not localhost)
4. Tick exactly these events:
   - **Bounced**
   - **Marked as spam** (spam report)
   - **Unsubscribed**
   - **Group unsubscribe**
   - **Dropped**
   Leave *delivered*, *opened*, *clicked* and *processed* OFF — we don't use
   them and they'd be pure noise at volume.
5. Set the status to **Enabled**, save.

### Option B — API (equivalent)

```bash
curl -X PATCH https://api.sendgrid.com/v3/user/webhooks/event/settings \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://artswrk.com/api/webhooks/sendgrid",
    "bounce": true,
    "spam_report": true,
    "unsubscribe": true,
    "group_unsubscribe": true,
    "dropped": true,
    "delivered": false,
    "open": false,
    "click": false,
    "processed": false
  }'
```

### Verify it worked

```bash
curl -s https://api.sendgrid.com/v3/user/webhooks/event/settings \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

Expect `"enabled": true` and the URL you set. SendGrid's UI also has a
**Test Your Integration** button; a test POST should return 200 and log
`[sendgrid-webhook]` server-side.

The endpoint answers 200 immediately and processes asynchronously — SendGrid
retries on any non-2xx, and a slow handler turns one batch into a retry storm.

---

## Task 2 — delete the stale domain authentication record  (optional, do it)

`GET /v3/whitelabel/domains` returns **two** records for `artswrk.com`: one with
`valid: true` and one with `valid: false`. The valid one is in use, so nothing
is broken today, but the invalid one is a trap waiting to be promoted to
default. Delete the invalid one in **Settings → Sender Authentication**.

Check first that you are deleting the invalid record, not the valid one.

---

## Task 3 — register the cron  (not SendGrid; needed for the digest to run)

The digest endpoint exists at `POST /api/scheduled/job-alerts` but **no
scheduled task calls it**, so nothing runs at 1pm today.

It must be scheduled **hourly, not daily**. 1:00 PM ET is 17:00 UTC in summer
and 18:00 in winter; the handler checks the New York local hour itself and
returns immediately unless it is 13:00 there. Hourly + self-check is what makes
it survive daylight saving without anyone remembering to change it.

Use `createHeartbeatJob()` from `server/_core/heartbeat.ts`:

```ts
await createHeartbeatJob({
  name: "job-alerts-digest",
  cron: "0 0 * * * *",                    // 6-field, UTC, top of every hour
  path: "/api/scheduled/job-alerts",      // must start with /api/scheduled/
  method: "POST",
  description: "Daily job alert digest; exits unless it is 1pm in New York",
});

await createHeartbeatJob({
  name: "brevo-suppression-sync",
  cron: "0 30 8 * * *",                   // 08:30 UTC nightly
  path: "/api/scheduled/brevo-suppressions",
  method: "POST",
  description: "Pull Brevo blocked contacts into email_suppressions",
});
```

Requires `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` in the
environment. Run it from the deployed app, not locally.

---

## DO NOT do these

- **Do not create a SendGrid dynamic template for job alerts.** See the top.
- **Do not set `JOB_ALERTS_ENABLED=true`** until the owner explicitly asks. It
  is the master switch; without it the system matches and logs but sends
  nothing. See `server/jobAlerts/safety.ts`.
- **Do not clear `JOB_ALERTS_ALLOWLIST`** on a first live run — set it to the
  owner's own address so only they can receive.
- **Do not make group `24547` non-default** or repoint job alerts at it.
- **Do not remove `EMAIL_REDIRECT_TO`** from the local `.env`.

---

## How to test without emailing anyone

All read-only. None of these send unless `JOB_ALERTS_ENABLED=true`.

```bash
# who would receive one specific job
npx tsx scripts/who-would-get-this-job.mjs <jobId>

# who would receive the last N posted jobs, plus a CSV
npx tsx scripts/who-would-get-recent-jobs.mjs 10

# full digest run, reporting per-artist, sending nothing
npx tsx scripts/dry-run-job-alerts.mjs

# force a specific job through the matcher without touching its queue status
npx tsx scripts/dry-run-job-alerts.mjs --job <jobId>

# render the emails to email-previews/*.html from real data
npx tsx scripts/preview-job-alert-emails.mjs
npx tsx scripts/preview-one-job-email.mjs <jobId>
```

First real send, when the owner approves:

```bash
JOB_ALERTS_ENABLED=true \
JOB_ALERTS_ALLOWLIST=ramita@artswrk.com \
npx tsx scripts/dry-run-job-alerts.mjs --job <jobId>
```

---

## Still open beyond SendGrid

| # | Item | Notes |
|---|---|---|
| 1 | Register the two crons | Task 3 above |
| 2 | Load the artist Settings → Notification Preferences page in a browser | Rewritten but never opened; the previous version saved nothing |
| 3 | Unit tests for `server/jobAlerts/matching.ts` | Especially the distance maths — a longitude bug there was silently dropping ~24 matches per NYC job before it was caught |
| 4 | Decide on the 2,006 artists with no service types | They receive nothing, silently. Owner deferred this deliberately |
| 5 | Delete test jobs | `#2490001` (Ballet Substitute Teacher), `#2430001` "TESING POST JOB", `#2400001` and `#2280001` QA test jobs — all Active and publicly visible |

Full behaviour spec: `docs/job-alerts-spec.md`. Read §3 before changing any
matching or send-gate logic.
