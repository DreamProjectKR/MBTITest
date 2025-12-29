-- 0005_results_result_id.sql
-- Ensure results table uses (result_id, result_text).
--
-- NOTE:
-- This migration is written to be safe for DBs that already have `result_id/result_text`.
-- If you still have an older DB with `result/summary`, recreate the DB or add a dedicated
-- legacy migration path (SQLite D1 migrations are not conditional).
PRAGMA foreign_keys = OFF;
CREATE TABLE IF NOT EXISTS results__new (
    test_id TEXT NOT NULL,
    result_id TEXT NOT NULL,
    result_image TEXT NOT NULL DEFAULT '',
    result_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (test_id, result_id),
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);
-- Copy across (current schema: result_id/result_text).
INSERT INTO results__new (
        test_id,
        result_id,
        result_image,
        result_text,
        created_at,
        updated_at
    )
SELECT test_id,
    result_id,
    result_image,
    result_text,
    created_at,
    updated_at
FROM results;
DROP TABLE results;
ALTER TABLE results__new
    RENAME TO results;
DROP INDEX IF EXISTS idx_results_test_result_id;
CREATE INDEX IF NOT EXISTS idx_results_test_result_id ON results(test_id, result_id);
PRAGMA foreign_keys = ON;