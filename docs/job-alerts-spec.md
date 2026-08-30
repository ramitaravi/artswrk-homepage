# Job Alert Emails — matching rules and build plan

Status as of **2026-08-29**. This is the document to argue with; the code is
built to match it. Supersedes the PRO-jobs handling in
`artswrk-job-emails-spec.md` v2 (see [Change log](#change-log)).

---

## 1. The rule, in one sentence

> **A digest is sent only when the artist has at least one *targeted* match.
> Unmapped PRO jobs ride along inside that email but never cause one to be sent.**

Everything below is detail on those two clauses.

---

## 2. Definitions

Terms are used exactly as defined here for the rest of the document.

### 2.1 Eligible

An artist is **eligible** for a given job when *all* of these hold. This is the
floor — nothing reaches an ineligible artist by any path.

| # | Condition | Source |
|---|---|---|
| E1 | Has a non-empty email address | `users.email` |
| E2 | Job alerts are on | `user_notification_settings.jobEmailsEnabled` |
| E3 | Not on the suppression list | `email_suppressions` (scope `global` or `job_alerts`) |
| E4 | Is not the person who posted the job | `jobs.clientUserId` / `premium_jobs.createdByUserId` |
| E5 | Has not already applied to it | `interested_artists` / `premium_job_interested_artists` |
| E6 | Has not already been sent it | `email_send_log` |

E6 is what makes every rule below idempotent: an artist sees any given job in
at most one email, ever, across both send paths.

### 2.2 Targeted match

An eligible artist is a **targeted match** for a job when *both* hold:

- **Service type** — the job's `masterServiceTypeId` is in the artist's enabled
  service types (`user_notification_settings.serviceTypes`).
- **Distance** — the job is within **50 miles** of the artist's home base.
  - Job has no coordinates, or `workFromAnywhere` → treated as remote, distance
    test skipped, service type alone decides.
  - **Artist** has no coordinates → not a match. (After the 2026-08-29 backfill
    this is only the 887 artists with no location text at all.)

### 2.3 Broad reach

An eligible artist has **broad reach** to a PRO job when that job has **no**
`masterServiceTypeId`. No service-type test, no distance test — eligibility
only. This is deliberately the same reach the Bubble-era system had.

Broad reach applies to **PRO jobs only**. A regular job with no service type is
never broadcast; it is a data error, and posting now requires one.

---

## 3. The send gate

Per artist, per digest run:

```
targeted  = matched regular jobs  +  matched PRO jobs (those WITH a service type)
ridealong = PRO jobs WITHOUT a service type, where the artist is eligible

SEND the digest  IF  targeted is non-empty
                 THEN include ridealong in it as well

SEND NOTHING     IF  targeted is empty
                 EVEN IF ridealong is non-empty
```

**`ridealong` is content, never a trigger.** That one asymmetry is the whole
safety property. Without it, a single unmapped PRO job would email all 5,668
artists that day; with it, an unmapped PRO job costs zero extra sends because it
only appears in emails that were already going out.

### 3.1 Truth table

| Targeted matches | Ride-along PRO | Email sent? | Contains |
|---|---|---|---|
| 0 | 0 | **No** | — |
| 0 | 3 | **No** | — |
| 1 | 0 | Yes | 1 job |
| 1 | 3 | Yes | 1 job + 3 PRO |
| 12 | 2 | Yes | 10 jobs + "see all 12" + 2 PRO |

### 3.2 Ride-along jobs are still logged

Every artist who *sees* a ride-along PRO job gets an `email_send_log` row for
it, exactly as for a targeted job. Without this it would reappear in every
digest forever. E6 then excludes it from all future sends.

---

## 4. Worked examples

**A — Brooklyn dance teacher, services: Substitute Teacher, Weekly Teacher**
Two subbing jobs in Manhattan today, plus one unmapped PRO job ("Major Gift
Officer", Boston). → **Email sent**: 2 job cards + the PRO job listed.
The PRO job is not why she got the email, but she sees it.

**B — Same artist, quiet day.** No regular matches. Three unmapped PRO jobs
posted. → **No email.** She sees those PRO jobs next time she has a real match,
or in the app.

**C — Photographer in Tucson.** A "Competition Photography" job posts in
Phoenix, 100 miles away. → **No match** (distance). If the same job is remote or
`workFromAnywhere`, it **does** match.

**D — Artist with no service types set** (2,006 of them). → Never a targeted
match, so never a digest, so never any PRO jobs either. This is the known
consequence of the parked decision in §7.

---

## 5. Caps and ordering

| Rule | Value | Status |
|---|---|---|
| Regular job cards per digest | max **10**, then "See all N jobs" | LOCKED |
| Ordering when over the cap | soonest start date, then highest rate | LOCKED |
| PRO items per digest | max **5** | **new — not previously specified** |
| PRO items count toward the 10 | **No** | LOCKED |
| Last-minute emails per artist | max **3** per rolling 24h | LOCKED |
| Digest send time | 1:00 PM ET, daily, content-gated | LOCKED |

### 5.1 What each membership tier sees

Unchanged from the original spec, and it applies to targeted and ride-along PRO
jobs identically — tier controls *what is shown*, never *who it reaches*.

- **PRO members** — full PRO job cards.
- **Free / Basic** — job **title only**, no client, location, rate or details,
  plus the upgrade CTA.

### 5.2 Last-minute path

Regular jobs only. **PRO jobs can never be last-minute** — `premium_jobs` has no
start date column, so the "starts within 48 hours" test cannot be evaluated for
them. This is a structural fact, not a policy choice.

Last-minute requires a targeted match *and* `lastMinuteEnabled`. There is no
broad-reach equivalent: these are immediate, one-per-email sends, and
broadcasting them is exactly the spam risk the system exists to avoid.

---

## 6. What is deliberately NOT filtered

Recorded so nobody "fixes" these later by accident.

1. **Unmapped PRO jobs are not service-type filtered.** PRO volume is ~3.5
   jobs/week against ~14/week for regular jobs. Precision filtering exists to
   stop the 14, not the 3.5. Filtering PRO strictly would have blocked 29 of the
   48 currently-active PRO jobs — real institutional roles (Major Gift Officer,
   Head of Wardrobe, School Accompanist) that have no home in a 56-type
   dance-gig taxonomy.
2. **No relevance ranking on PRO jobs yet.** Newest first. Ranking by
   application history is a later refinement (§7).
3. **No frequency cap on the digest** beyond it being daily and content-gated.

---

## 7. Known gaps, accepted for now

| Gap | Consequence | Plan |
|---|---|---|
| 2,006 artists have no service types | They receive nothing, silently | **Parked** by Ramita 2026-08-29. Revisit before first real send |
| 887 artists have no location | Never a targeted match | Ask them in-app; no script can fix it |
| 43 of 48 active PRO jobs unmapped | They go out via broad reach | Self-resolving: posting now requires a type, and these expire (26 are under 90 days old) |
| An artist who never matches regular jobs stops seeing PRO jobs | Narrower than today for that person | Measure after week 1. Fallback if real: no digest in 14 days + new PRO jobs → send a PRO-only roundup |

---

## 8. The build plan

### Done and verified

| | What | Evidence |
|---|---|---|
| ✅ | **Artist geocodes** | 5,292 / 5,292 geocodable, 0 permanent failures. Was 0 |
| ✅ | **Regular jobs require a service type** | Required at post, verified saving end to end. AI parse rewired to the real taxonomy |
| ✅ | **PRO jobs require a service type** | Picker on the Enterprise form, resolves and stores |
| ✅ | **Schema (0052)** | 3 tables, 6 columns, 3 indexes, applied, journal recorded |
| ✅ | **Backlog quarantine** | 3,899 jobs + 243 PRO jobs set `suppressed` |
| ✅ | **PRO mapping tables + General Staff (0053)** | 9 mappings seeded, 10 in review queue |

**3,454 artists are now fully matchable** (coordinates + service types + email).
That number was 0 at the start of the day.

### Remaining

| Phase | What | Depends on |
|---|---|---|
| **2 · Matcher** | One `findMatchingArtists(job)` implementing §2–3. Bounding box then haversine, service-type intersection, exclusion set. Unit tested, sends nothing | nothing — ready |
| **3 · Digest worker** | Scheduled endpoint, hourly cron gated on the New York local hour (1pm ET is 17:00 UTC in summer, 18:00 in winter). Assembles payloads, applies §5 caps, batches SendGrid personalizations | 2 |
| **4 · Last-minute** | 48h check on all three job-activation routes plus edit. Rolling-24h cap read from `email_send_log` | 2 |
| **5 · Opt-out** | `/api/webhooks/sendgrid`, nightly Brevo sync, real Job Alerts section in artist Settings — the current one is a placeholder that saves nothing | 0052 ✅ |
| **6 · Templates + proof** | Two dynamic templates, full dry run via `EMAIL_REDIRECT_TO`, then a real send to safe accounts only | 3, 4 |

### Decisions — all resolved

~~1. SendGrid "Job Alerts" unsubscribe group~~ — **done 2026-08-29, id `33079`.**
   Created via the API on Ramita's instruction. Job alert sends stamp this group;
   everything else keeps the shared transactional group (`24547`), so opting out
   of job alerts no longer risks silencing booking confirmations.

~~2. Confirm §3~~ — **confirmed by Ramita 2026-08-29.** The send gate below is
   the agreed behaviour and supersedes "keep the PRO digest disabled until the
   mapping is done".

~~3. Artist tag backfill~~ — **confirmed as a nice-to-have.** It becomes a
   ranking boost, not a gate. No section 6 doc needed to proceed.

Nothing is currently blocked on Ramita. Next up is phase 2, the matcher.

---

## Change log

**2026-08-29** — PRO jobs move from strict service-type matching to
broad-reach-with-ride-along (§3). Reason: PRO volume is a fifth of regular
volume and strict matching would have blocked 29 of 48 live PRO jobs while
narrowing reach versus the Bubble-era system, which sent PRO jobs to everyone
subscribed. Adds the "content, never a trigger" rule as the safety property, and
a new max-5 PRO items cap.
