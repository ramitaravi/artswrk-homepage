# GitHub Main Source-of-Truth Policy

## Incident summary

On September 1, 2026, the current GitHub `main` branch and the Manus workspace both contained an older Dance Competitions layout even though the intended redesign had already been committed. The cause was not browser or CDN caching. During an earlier repair, the currently published production layout was incorrectly treated as authoritative and was restored over the newer GitHub redesign. A subsequent checkpoint then pushed that mistaken restoration to `main`.

The last correct redesign was recovered from Git commit `3e300badc12a20499be9e98829ee72f60179f60c`. Its `DanceCompetitions.tsx` source was restored exactly, except that four project-local image paths were replaced with equivalent managed-storage URLs required for deployment. The current inquiry submission, existing-account routing, Judge Experience dialog, route-specific SEO metadata, and global Brevo Conversations widget were preserved.

## Permanent rule

GitHub `main` is the source of truth for application source. A published domain, historical checkpoint, screenshot, or development preview must never be used to overwrite newer GitHub work unless the user explicitly requests a rollback to a named version.

Before future source-sensitive releases, run:

```bash
pnpm verify:github-parity
```

This command compares `client/src/pages/DanceCompetitions.tsx` with `user_github/main` and exits with a visible diff when they diverge. During intentional local edits, divergence is expected until the new checkpoint is saved to GitHub; the check must pass immediately after checkpointing.

## Validation completed

The corrected page matches the recovered redesign source byte-for-byte after deterministic managed-asset URL substitution. Desktop and mobile full-page renders show the intended “Hire Dance Competition Staff on Artswrk” layout, enterprise inquiry form, logo marquee, staff panel, dashboard illustration, Judge Experience section, FAQs, and final CTA. All four managed images return HTTP 200. The deterministic suite passes 279 tests, TypeScript reports no errors, and the production build succeeds.
