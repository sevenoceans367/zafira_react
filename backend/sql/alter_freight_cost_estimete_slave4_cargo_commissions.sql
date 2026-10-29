-- Per-cargo-line commissions (nested under Cargo).
-- Run on live BEFORE deploying the app that writes these columns.
-- Safe to re-run: each ADD is guarded.

-- Type: "ADCOM Freight", "Brokerage commission", or free text
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_slave4'
    AND COLUMN_NAME = 'COMM_TYPE'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE freight_cost_estimete_slave4 ADD COLUMN COMM_TYPE VARCHAR(120) NULL DEFAULT NULL AFTER FCAID',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Frontend / slave10 cargo row id (RANDOMID as string, or in-session cargo id)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_slave4'
    AND COLUMN_NAME = 'CARGO_LINE_ID'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE freight_cost_estimete_slave4 ADD COLUMN CARGO_LINE_ID VARCHAR(64) NULL DEFAULT NULL AFTER VENDORID',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1 = Main cargo, 2 = Overage, 3 = Deadfreight (NULL = legacy voyage-level row)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_slave4'
    AND COLUMN_NAME = 'CARGO_STATUS'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE freight_cost_estimete_slave4 ADD COLUMN CARGO_STATUS TINYINT NULL DEFAULT NULL AFTER CARGO_LINE_ID',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing brokerage rows stay voyage-level (CARGO_LINE_ID NULL) until the estimate is saved again.
-- ADCOM remains on freight_cost_estimete_master.ADDRESS_COMMISSION_PER / ADDRESS_COMMISSION_AMT
-- and is also written as a COMM_TYPE='ADCOM Freight' slave4 row on save.

-- VCIN copy of slave4 (freight_cost_estimete_in_slave4) — skip if the table is absent.
SET @tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_in_slave4'
);

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_in_slave4'
    AND COLUMN_NAME = 'COMM_TYPE'
);
SET @sql := IF(@tbl > 0 AND @col = 0,
  'ALTER TABLE freight_cost_estimete_in_slave4 ADD COLUMN COMM_TYPE VARCHAR(120) NULL DEFAULT NULL AFTER FCAID',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_in_slave4'
    AND COLUMN_NAME = 'CARGO_LINE_ID'
);
SET @sql := IF(@tbl > 0 AND @col = 0,
  'ALTER TABLE freight_cost_estimete_in_slave4 ADD COLUMN CARGO_LINE_ID VARCHAR(64) NULL DEFAULT NULL AFTER VENDORID',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freight_cost_estimete_in_slave4'
    AND COLUMN_NAME = 'CARGO_STATUS'
);
SET @sql := IF(@tbl > 0 AND @col = 0,
  'ALTER TABLE freight_cost_estimete_in_slave4 ADD COLUMN CARGO_STATUS TINYINT NULL DEFAULT NULL AFTER CARGO_LINE_ID',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
