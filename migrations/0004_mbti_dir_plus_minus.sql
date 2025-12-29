-- 0004_mbti_dir_plus_minus.sql
-- Standardize MBTI scoring semantics for designers:
-- - answers.mbti_axis: EI/SN/TF/JP
-- - answers.mbti_dir: 'plus' | 'minus' (더하기/빼기)
-- - answers.weight: positive integer amount
--
-- This migration must work even if older DBs don't yet have the new columns.
-- We rebuild `answers` into the latest schema, then backfill MBTI fields from legacy `answer_id` patterns.
PRAGMA foreign_keys = OFF;
CREATE TABLE IF NOT EXISTS answers__new (
  test_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  mbti_axis TEXT NOT NULL DEFAULT '',
  mbti_dir TEXT NOT NULL DEFAULT 'plus',
  weight INTEGER NOT NULL DEFAULT 1,
  score_key TEXT NOT NULL DEFAULT '',
  score_value INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (test_id, answer_id),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id, question_id) REFERENCES questions(test_id, question_id) ON DELETE CASCADE
);
INSERT INTO answers__new (
    test_id,
    answer_id,
    question_id,
    ord,
    answer,
    mbti_axis,
    mbti_dir,
    weight,
    score_key,
    score_value,
    created_at,
    updated_at
  )
SELECT test_id,
  answer_id,
  question_id,
  ord,
  answer,
  '' AS mbti_axis,
  'plus' AS mbti_dir,
  1 AS weight,
  '' AS score_key,
  0 AS score_value,
  created_at,
  updated_at
FROM answers;
DROP TABLE answers;
ALTER TABLE answers__new
  RENAME TO answers;
PRAGMA foreign_keys = ON;
-- Backfill from legacy answer_id like "...__EI_E" (axis + letter)
UPDATE answers
SET mbti_axis = substr(
    upper(answer_id),
    instr(upper(answer_id), '__') + 2,
    2
  )
WHERE instr(upper(answer_id), '__') > 0
  AND length(answer_id) >= instr(upper(answer_id), '__') + 5;
UPDATE answers
SET mbti_dir = CASE
    WHEN upper(
      substr(
        upper(answer_id),
        instr(upper(answer_id), '__') + 5,
        1
      )
    ) IN ('E', 'S', 'T', 'J') THEN 'plus'
    WHEN upper(
      substr(
        upper(answer_id),
        instr(upper(answer_id), '__') + 5,
        1
      )
    ) IN ('I', 'N', 'F', 'P') THEN 'minus'
    ELSE 'plus'
  END
WHERE instr(upper(answer_id), '__') > 0
  AND length(answer_id) >= instr(upper(answer_id), '__') + 5;
-- Ensure weight is at least 1 for MBTI answers that have an axis set.
UPDATE answers
SET weight = 1
WHERE upper(trim(mbti_axis)) IN ('EI', 'SN', 'TF', 'JP')
  AND (
    weight IS NULL
    OR weight < 1
  );