-- Full TC In Hire Recap snapshot (JSON) for Edit TC Recap sub-charter popup.
-- App also auto-adds this column via ensureTcInRecapJsonColumn.
-- Safe to re-run: ADD is guarded.

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chartering_estimate_tc_master'
    AND COLUMN_NAME = 'TC_IN_RECAP_JSON'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE chartering_estimate_tc_master ADD COLUMN TC_IN_RECAP_JSON LONGTEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
