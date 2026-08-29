# QA notes — Run As Kylie Conlon (Artswrk PRO, LA), 2026-08-28

Raw notes from live testing, organized. Status column tracked as items get worked.

## PRO jobs / Bubble sync
- [ ] Latest PRO jobs aren't synced (Thunderstruck) — found the mechanism: `scripts/sync-premium-jobs-once.ts`. Blocked on two things: needs `BUBBLE_API_KEY` (not set in local `.env`), and its backup-report path (`/home/ubuntu/artswrk-backups/...`) implies it was built for the original cloud sandbox, not local. Writes directly to the real DB, so didn't run it blind — needs a decision on where/how to run it.
- [x] PRO job categories are just the distinct `category` text values already present across posted PRO jobs — no separate taxonomy/lookup table exists. Answered, no fix needed.
- [x] Remove the "Remote Only" toggle from the PRO job filter. (ce81b7b)

## Dashboard / job feed
- [ ] "Jobs for You" isn't location-dependent (Kylie's in LA) — should be personalized, or if there are under ~5 matches, surface PRO jobs more prominently / make that more of the feed. Still open — needs a product call on the exact behavior wanted.
- [x] "Jobs Near Me" wasn't taking location into account — real bug: the filter only ever seeded from a URL param, never the artist's own profile location like the old site did. Now auto-seeds from their profile on load (doesn't override a manual search). (79b3fb8)

## Profile page
- [ ] **Star ratings are essentially unwired platform-wide** — investigated: only 2 accounts on the entire site have a nonzero `ratingScore`, and there's no `reviews` table backing it at all. Real ratings only ever populate via a live Bubble API call on the artist's OWN profile view (`getMyProfile`), and that call fails silently in local dev (no `BUBBLE_API_KEY` configured here). Needs a product decision: build a real reviews/rating system, or confirm this is meant to stay Bubble-dependent and only verify it in an environment with a working Bubble key.
- [x] ~~Resume mismatch~~ — false alarm, not a bug: that "Receipt" file is one you uploaded yourself testing Kylie's application a few minutes earlier (timestamp matches exactly). Will get cleaned up with the rest of today's test data.
- [ ] Add a CTA to add media when the artist has none yet (old dashboard had this, new profile doesn't).
- [ ] **"Services"/"Work" section mismatch — real, bigger bug found:** 4,782 artists have real Bubble work-type data (`masterArtistTypes`, raw Bubble option IDs), but only 1 artist site-wide has it resolved into readable labels (`workTypes`, e.g. "Dance Educator"). The Bubble-ID → label resolution essentially never ran platform-wide. Can't safely guess the ID→label mapping myself — needs either the real mapping from Bubble's option sets, or to run through the same sync path as the PRO jobs (see above).
- [x] Public (logged-out) profile view showed 0 bookings — real bug: `getPublicProfile`/`getProfileBySlug` read a cached column that's basically never populated site-wide, instead of computing live like the logged-in view does. Fixed. (4382ac4)
- [x] Star ratings default to filled (5 stars) now instead of empty, until a real review system exists. (b1b177c)
- [x] Social links now render as a vertical list instead of wrapped chips, on both the public and logged-in views. (b1b177c)
- [x] TikTok was checked for but never actually rendered — added, now a real clickable `tiktok.com` link instead of a bare handle, on both views. (b1b177c)
- [x] Kylie Conlon's phone number was her own real number — replaced with a placeholder. (555) 010-0192
- [x] Pronouns — already implemented and displaying correctly on all 3 profile views (verified live), no fix needed.

## Applications page
- [x] Application count is wrong — should show 9 total (6 Basic + 3 PRO), currently only counting Basic applications. (ce81b7b)
- [x] PRO applications should be more prominent — now listed first under their own heading, marketplace applications below under theirs. (ce81b7b)
- [x] Remove the redundant "The team will be in touch" line in the green "Application submitted" confirmation box. (ce81b7b)
- [x] Bookings and payments are matching correctly for Kylie — no action needed.

## PRO member experience
- [ ] Make PRO members feel more special — banners on PRO-gated pages ("unlocked because you're an Artswrk PRO member"), highlight benefits more prominently.

## Open question
- [ ] How do job links/redirects work from the old (Bubble) site to the new one? Worth considering for SEO/bookmark continuity.

## Explicitly deferred to a later session (not today)
- [ ] Subscription prices are going up
- [ ] Need better "locked in" subscription language across the site
- [ ] Come back to Browse Companies
- [ ] Manually clean up Benefits content
- [ ] Clean up notification preferences and related emails
- [ ] Double-check Terms, Privacy Policy, Cancellation Policy, and all landing pages

---
*Otherwise, per live testing: "everything works though."*
