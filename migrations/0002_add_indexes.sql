-- Add indexes for faster /api/tests queries (ORDER BY updated_at DESC).
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_tests_updated_at_desc
ON tests(updated_at DESC, test_id ASC);

