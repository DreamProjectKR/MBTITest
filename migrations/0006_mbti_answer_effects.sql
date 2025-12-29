-- Add MBTI-optimized scoring table.
-- Goal: evaluate MBTI with a single aggregated query (no per-answer row fetch).
CREATE TABLE IF NOT EXISTS mbti_answer_effects (
    test_id TEXT NOT NULL,
    answer_id TEXT NOT NULL,
    axis TEXT NOT NULL DEFAULT '',
    -- signed delta: +N for plus, -N for minus
    delta INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (test_id, answer_id),
    FOREIGN KEY (test_id, answer_id) REFERENCES answers(test_id, answer_id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mbti_effects_test_axis ON mbti_answer_effects(test_id, axis);
-- Backfill from legacy columns on answers (idempotent).
INSERT
    OR REPLACE INTO mbti_answer_effects (
        test_id,
        answer_id,
        axis,
        delta,
        created_at,
        updated_at
    )
SELECT a.test_id,
    a.answer_id,
    UPPER(TRIM(COALESCE(a.mbti_axis, ''))) AS axis,
    (
        CASE
            WHEN LOWER(TRIM(COALESCE(a.mbti_dir, ''))) = 'minus' THEN -1
            ELSE 1
        END
    ) * ABS(COALESCE(a.weight, 1)) AS delta,
    COALESCE(
        a.created_at,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ) AS created_at,
    COALESCE(
        a.updated_at,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ) AS updated_at
FROM answers a
WHERE TRIM(COALESCE(a.mbti_axis, '')) <> '';