-- 0003_answers_scoring_columns.sql
-- NOTE:
-- This migration previously added scoring columns to `answers`.
-- Those columns are now part of the base schema in `0001_init.sql`.
-- Keep this migration as a harmless no-op for existing environments.
SELECT 1;