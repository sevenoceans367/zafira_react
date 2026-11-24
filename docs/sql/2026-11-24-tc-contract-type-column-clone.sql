-- TC Recap: CONTRACT_TYPE column — CLONE DATABASE ONLY
-- Spec: docs/superpowers/specs/2026-11-24-tc-contract-type-column-design.md
-- Plan: docs/superpowers/plans/2026-11-24-tc-contract-type-column.md
--
-- DO NOT run against production until clone matrix passes.
-- Values: 'tcout' | 'tcinout'
-- Applies to ALL business types (ESTIMATE_TYPE). Not tanker-only.

-- 0) Identity check — abort if this is production
SELECT DATABASE() AS db_name, @@hostname AS host, @@port AS port;

-- 1) Baseline
SELECT
  COUNT(*) AS total,
  SUM(CASE
    WHEN (PERIODID IS NOT NULL AND TRIM(CAST(PERIODID AS CHAR)) NOT IN ('', '0'))
      OR (TC_IN_RECAP_JSON IS NOT NULL AND TRIM(TC_IN_RECAP_JSON) NOT IN ('', 'null', '{}'))
    THEN 1 ELSE 0 END) AS expected_tcinout
FROM chartering_estimate_tc_master;

-- 2) Add nullable column (safe for live reads that fall back on NULL)
-- Skip if already present:
--   SHOW COLUMNS FROM chartering_estimate_tc_master LIKE 'CONTRACT_TYPE';
ALTER TABLE chartering_estimate_tc_master
  ADD COLUMN CONTRACT_TYPE VARCHAR(16) NULL;

-- 3) Confirm all NULL before backfill
SELECT COUNT(*) AS nulls_before_backfill
FROM chartering_estimate_tc_master
WHERE CONTRACT_TYPE IS NULL;

-- 4) Backfill from PERIODID / JSON (legacy inference → explicit)
UPDATE chartering_estimate_tc_master
SET CONTRACT_TYPE = CASE
  WHEN (PERIODID IS NOT NULL AND TRIM(CAST(PERIODID AS CHAR)) NOT IN ('', '0'))
    OR (TC_IN_RECAP_JSON IS NOT NULL AND TRIM(TC_IN_RECAP_JSON) NOT IN ('', 'null', '{}'))
  THEN 'tcinout'
  ELSE 'tcout'
END
WHERE CONTRACT_TYPE IS NULL;

-- 5) Verify
SELECT CONTRACT_TYPE, COUNT(*) AS n
FROM chartering_estimate_tc_master
GROUP BY CONTRACT_TYPE;

SELECT COUNT(*) AS still_null
FROM chartering_estimate_tc_master
WHERE CONTRACT_TYPE IS NULL;
-- Expected: still_null = 0
