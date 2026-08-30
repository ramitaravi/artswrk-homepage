-- ============================================================================
-- premium_service_type_map / _review seed
--
-- Maps premium_jobs free-text serviceType/category values onto canonical
-- master_service_types rows. Hand-mapped from the premium-jobs application
-- audit (1,734 applications across 67 companies, 2026-08-29/30) against the
-- post-retaxonomy taxonomy.
--
-- Run it with:  node scripts/apply-migration-0053-pro-service-types.mjs
-- That script verifies EVERY type name below resolves before executing a
-- single statement, and aborts naming the missing ones.
--
-- WHY THAT MATTERS: the inserts below join master_service_types by name. An
-- INNER JOIN silently DROPS any row whose name doesn't match — it does not
-- fail. The original version of this file claimed a missing name would "fail
-- loudly"; it would in fact have vanished without a word. The pre-flight check
-- in the apply script is what actually makes that claim true.
--
-- Column names are camelCase to match every other table in this schema.
--
-- Policy (spec section 6):
--   * exact / normalized  → apply silently
--   * fuzzy               → apply only at confidence >= 0.85
--   * anything ambiguous  → premium_service_type_review, never auto-mapped
--
-- Idempotent: re-running skips raw values already mapped.
-- ============================================================================

-- ── Confident mappings (apply silently) ─────────────────────────────────────

INSERT INTO premium_service_type_map (rawValue, masterServiceTypeId, matchMethod, confidence, reviewedBy, reviewedAt)
SELECT v.raw_value, mst.id, v.match_method, v.confidence, 'ramita+agent', NOW()
FROM (
  SELECT 'Judge'                              AS raw_value, 'Judge'                        AS type_name, 'exact'      AS match_method, 1.00 AS confidence
  UNION ALL SELECT 'Tabulator',                     'Tabulator',                    'exact',      1.00
  UNION ALL SELECT 'Emcee',                         'Emcee',                        'exact',      1.00
  UNION ALL SELECT 'Event Director',                'Event Director',               'exact',      1.00
  UNION ALL SELECT 'Executive Assistant/Admin',     'Executive Assistant / Admin',  'normalized', 1.00
  UNION ALL SELECT 'Merch/Merchandise',             'Merch',                        'normalized', 0.95
  UNION ALL SELECT 'Competition Choreographer',     'Competition Choreography',     'normalized', 0.95
  UNION ALL SELECT 'Master Teacher/Convention faculty', 'Master Classes',           'fuzzy',      0.87
  -- Ramita's call, 2026-08-29: create General Staff under Dance Competition
  -- Staff and map the generic bucket to it. 79 companies — the single biggest
  -- value in the audit — and the only alternative was splitting them across
  -- Crew/Registration/Backstage on per-company guesswork. `manual` because a
  -- human decided it, not a matcher. Created in 0053.
  UNION ALL SELECT 'Competition staff (general)',   'General Staff',                'manual',     1.00
) v
JOIN master_service_types mst ON mst.name = v.type_name
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT rawValue FROM premium_service_type_map) existing
  WHERE existing.rawValue = v.raw_value
);

-- Sanity-check note on 'Master Teacher/Convention faculty' → 'Master Classes':
-- fuzzy at 0.87, just over the apply threshold. Convention faculty do teach
-- master classes, so this is the intent — but it is the one auto-map worth an
-- eyeball. If it's wrong, change the row and re-run the artist tag backfill
-- for that type.

-- ── Review queue: ambiguous values, never auto-mapped ───────────────────────
-- candidateTypes is a JSON array of master_service_types NAMES, for the admin
-- view to offer as one-click picks. A raw value may resolve to TWO types — the
-- review action writes one map row per chosen type.

INSERT INTO premium_service_type_review (rawValue, candidateTypes, reason, createdAt)
SELECT v.raw_value, v.candidate_types, v.reason, NOW()
FROM (
  SELECT 'Backstage/Stage crew' AS raw_value,
         JSON_ARRAY('Backstage Staff', 'Crew', 'Stage Manager') AS candidate_types,
         'Compound raw value; backstage vs stage crew split unclear' AS reason
  UNION ALL SELECT 'Sales/Recruiting/Customer relations',
         JSON_ARRAY('Sales', 'Customer Service'),
         'Compound: covers both Sales and Customer Service under Side Jobs; pick primary or map to both'
  UNION ALL SELECT 'Social Media/Content',
         JSON_ARRAY('Social Media Manager', 'Content Creator', 'Marketing'),
         'Compound: social media management vs content creation split unclear'
  UNION ALL SELECT 'Photographer/Videographer (events)',
         JSON_ARRAY('Event Photography', 'Event Videography', 'Competition Photography', 'Competition Videography'),
         'Compound AND two-way split: generic event vs competition-specific photo/video; needs a multi-type mapping'
  UNION ALL SELECT 'Summer Intensive faculty',
         JSON_ARRAY('Master Classes', 'Weekly Teacher'),
         'No dedicated intensive type exists; decide mapping or create a new "Summer Intensive" master service type'
  UNION ALL SELECT 'Competition (unspecified)',
         JSON_ARRAY('Judge', 'Crew', 'Registration', 'General Staff'),
         'Too vague to auto-map; could be any competition role'
  UNION ALL SELECT 'Production staff',
         JSON_ARRAY('Crew', 'Stage Manager', 'Backstage Staff'),
         'Production staff vs crew/stage roles split unclear'
  UNION ALL SELECT 'Convention staff/faculty',
         JSON_ARRAY('Master Classes', 'Crew', 'Registration'),
         'Compound: faculty (teaching) vs staff (ops) split unclear'
  UNION ALL SELECT 'DJ',
         JSON_ARRAY(),
         'No master service type exists for DJ; create one or decide it stays unmapped'
  UNION ALL SELECT 'Other/Unclear',
         JSON_ARRAY(),
         'Unmappable by definition; review job-by-job in the admin view'
) v
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT rawValue FROM premium_service_type_review) existing
  WHERE existing.rawValue = v.raw_value
);

-- Blank/NULL categories on premium_jobs are not seeded anywhere: the enqueue
-- path treats empty as unmatched and sends it to the review bucket at runtime
-- (4 companies in the audit have no category).
