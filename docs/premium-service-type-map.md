# PRO Jobs - Service Type Mapping (premium_jobs free-text -> master service types)

Hand-mapped 2026-08-30 from the premium-jobs application audit (1,734 applications across 67 companies) against the live taxonomy after the Aug 29 retaxonomy (`scripts/retaxonomy-2026-08-29.mjs`).

Sources of truth used:
- Taxonomy baseline: `drizzle/seeds/reference_data.ts` (STALE - last commit April 2026, see flag at bottom)
- Current taxonomy: `scripts/retaxonomy-2026-08-29.mjs` (ran Aug 29 - renames, 9 new competition-staff roles, Competition Photo/Video, Sales, Data Entry, merges)

## Auto-mapped (ships in the seed, applies silently)

| Raw value (audit) | Companies | Maps to (master service type) | Method | Confidence |
|---|---|---|---|---|
| Judge | 65 | Judge (Dance Competition Staff) | exact | 1.00 |
| Tabulator | 16 | Tabulator (Dance Competition Staff) | exact | 1.00 |
| Emcee | 23 | Emcee (Dance Competition Staff) | exact | 1.00 |
| Event Director | 8 | Event Director (Dance Competition Staff) | exact | 1.00 |
| Executive Assistant/Admin | 25 | Executive Assistant / Admin (Side Jobs) | normalized | 1.00 |
| Merch/Merchandise | 31 | Merch (Dance Competition Staff) | normalized | 0.95 |
| Competition Choreographer | 3 | Competition Choreography (Dance Educator) | normalized | 0.95 |
| Master Teacher/Convention faculty | 12 | Master Classes (Dance Educator) | fuzzy | 0.87 |

Coverage: 8 of 19 distinct values auto-map, covering 183 of 463 company-category assignments and the large majority of application volume (Judge + competition staff dominate applications).

One to sanity-check: **Master Teacher/Convention faculty -> Master Classes** at 0.87 fuzzy. Convention faculty teach master classes, so this is the intent - but it's the one auto-map worth your eyeball.

## Review bucket (NOT auto-mapped - waits for a human pick in the admin view)

| Raw value | Companies | Candidate types offered | Why it's not auto-mapped |
|---|---|---|---|
| Backstage/Stage crew | 40 | Backstage Staff / Crew / Stage Manager | Compound value, backstage vs stage-crew split unclear |
| Competition staff (general) | 79 | Crew / Registration / Backstage Staff | Generic bucket. The April seed had a "General Staff" role; the Aug 29 retaxonomy did NOT include it. Verify if General Staff exists in the live DB before mapping |
| Sales/Recruiting/Customer relations | 30 | Sales / Customer Service | Compound: two real types under Side Jobs |
| Social Media/Content | 20 | Social Media Manager / Content Creator / Marketing | Compound: management vs creation split |
| Photographer/Videographer (events) | 20 | Event Photography + Event Videography / Competition Photography / Competition Videography | Two splits at once: photo vs video, generic event vs competition. Likely needs a multi-type mapping (one raw value -> 2 types) |
| Summer Intensive faculty | 11 | Master Classes / Weekly Teacher | No dedicated intensive type exists - map it or create "Summer Intensive" as a new master service type |
| Competition (unspecified) | 11 | Judge / Crew / Registration | Too vague |
| Production staff | 9 | Crew / Stage Manager / Backstage Staff | Production vs crew/stage split unclear |
| Convention staff/faculty | 3 | Master Classes / Crew / Registration | Compound: faculty (teaching) vs staff (ops) |
| DJ | 1 | (none) | No DJ type exists - create one or leave unmapped |
| Other/Unclear | 52 | (none) | Unmappable by definition; review job-by-job |
| (blank category) | 4 | (none) | Enqueue treats empty as unmatched -> review at runtime |

## Flags

1. **"Competition staff (general)" is the biggest single bucket (79 companies)** and its natural home (General Staff) may not exist in the live DB. The April-era seed file lists "General Staff" under Dance Competition Staff, but the retaxonomy script that actually ran did not create it. Someone needs to check the live master_service_types table: if General Staff is there, map to it; if not, either create it or split between Crew/Registration.
2. **reference_data.ts is stale** (April 2026): it still says "Recurring Classes" and "Dance Competition Judge" (renamed Aug 29 to "Weekly Teacher" and "Judge"), and its Dance Competition Staff section doesn't match what the retaxonomy inserted. Worth regenerating so the next environment doesn't seed a wrong baseline.
3. The spec's map table allows multiple rows per raw_value, so compound values like "Photographer/Videographer (events)" CAN map to two types if you want - the admin review action just writes two map rows.

Files: `seed_premium_service_type_map.sql` (idempotent, resolves IDs by name at seed time so it doesn't depend on auto-increment IDs).

---

## Addendum, 2026-08-29 — verified against the live DB

Two corrections found while wiring this up. Both were measured, not inferred.

### 1. The mapping keys on `serviceType`, not `category`

The audit's raw values live in `premium_jobs.serviceType`. `premium_jobs.category`
holds event/company types — and some outright junk:

| column | audit raw values matched (active) | all-time |
|---|---|---|
| `category` | **0 of 48** | **0 of 243** |
| `serviceType` | 5 of 48 | 48 of 243 |

`category` values are things like "Dance Competition" (85), "Dance Competition &
Convention" (69), "Admin" (5) — plus "New Jersey", "Alexandria, VA",
"Westchester, PA". Keying the enqueue on it would map nothing at all, silently.

**Enqueue must read `serviceType`**, falling back to `category`, then to review.

### 2. The audit grain is companies, not job rows

This was built from a company-level application audit — 67 companies, 463
company-category assignments. It describes what companies *hire for*. Individual
`premium_jobs` rows are much noisier free text: **163 distinct `serviceType`
values across 243 rows**, things like "Awards Coordinator | Multiple Dates",
"Competition Photographers" (plural), "Development & Events Director". And 23 of
48 active PRO jobs have a blank `category`.

So the map is a sound basis for **the artist tag backfill (section 6, Part B)**,
which is company/application-grained and matches the audit exactly. It is *not*
sufficient to classify live PRO job rows: only 5 of 48 active ones resolve.

**Recommendation:** don't try to fuzzy-match 163 free-text values. Add the same
required service-type picker to the PRO posting form that regular jobs now have,
and hand-classify the existing 48 in the admin review view. 48 is a single
sitting's work and it is exact, where fuzzy matching would be neither.
