# Bubble Ongoing Synchronization Audit

## Current production findings

- The only configured heartbeat job is `bubble-sync-daily` (`AaRYR89D7WRX8i8YTPw68c`). Its last recorded execution was August 24, 2026, its next-execution timestamp is already in the past, and 81 of 87 recorded callback attempts failed with HTTP 403.
- Some heartbeat attempts were recorded as HTTP 200 but returned the website HTML rather than a synchronization response, so an HTTP-success status alone did not prove a database sync occurred.
- The current scheduled handler trusts a raw header, returns success before starting the work, and launches `sync-all.mjs` as an unawaited background child process. The hosting platform may terminate that process after the response finishes.
- The current full sync has historically taken 24–39 minutes, while scheduled HTTP callbacks have a two-minute execution limit.
- The current webhook covers only job, booking, and artist-profile events. It does not cover client companies, premium jobs, interested artists, payments, conversations, messages, or benefits.
- The current webhook returns HTTP 200 after processing errors, preventing retries; its user insert omits the required `openId`; and several field names no longer match the reconciled schema.
- The current incremental script predates the lossless one-time migration and omits source-presence flags and many reconciled fields. It also skips deleted bookings and does not cover client companies or benefits.

## Confirmed Bubble capabilities

Bubble officially supports database trigger events when records are created, changed, or deleted. Triggers can access the record before and after a change. Bubble warns that triggers run with administrative privileges, fire once when a workflow changes the same record multiple times, and do not trigger another database trigger directly. Bubble also supports backend/API workflows for server-side integrations.

Sources:

- https://manual.bubble.io/help-guides/logic/workflows/events/backend-events/database-trigger-events
- https://manual.bubble.io/help-guides/integrations/api/the-bubble-api/the-workflow-api

## Viable launch options

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| Database-trigger webhooks plus a 15-minute repair sync | Fast updates for configured Bubble types; 15-minute pull repairs missed or failed events. Requires one Bubble trigger per data type and careful retry/idempotency behavior. | Uses existing hosting and Bubble capacity. | Higher: configure ten Bubble triggers and deploy hardened endpoint plus repair job. |
| 15-minute incremental API pull plus nightly chunked reconciliation | No Bubble-editor trigger setup and fewer moving parts. Changes can appear up to 15 minutes later. Nightly work must be split into sub-two-minute chunks or table-specific jobs. | Uses existing hosting; API volume every 15 minutes. | Medium: replace the existing invalid schedule with short table-specific jobs. |
| One-hour incremental pull plus manual pre-launch delta | Lightest launch setup and lowest API/workload usage, but not near-real-time and creates a larger exposure window if a run fails. | Lowest operational usage. | Low. |

## Recommended architecture

For Sunday, use a 15-minute incremental API pull as the authoritative synchronization path, split into short table-specific handlers. Add database-trigger webhooks afterward or in parallel only when each Bubble trigger has been configured and tested. Keep a daily reconciliation job that audits IDs and modification timestamps but processes tables in resumable chunks rather than a single long request.
