-- Simplify scoring model:
-- - Replace multiple scoring columns with a single, generic effect pair:
--   - answers.effect_key   : which bucket/axis to affect (e.g. EI/SN/TF/JP, or any score bucket key)
--   - answers.effect_delta : signed integer delta applied to that key
--
-- This removes duplication between:
-- - answers.pole_axis / answers.pole_side / weight
-- - answers.score_key / answers.score_value
-- - mbti_answer_effects (cache table)
--
-- MBTI convention:
-- - effect_key is one of EI/SN/TF/JP
-- - effect_delta sign encodes side (E/S/T/J = +, I/N/F/P = -)
-- - magnitude encodes weight

-- Drop MBTI cache table first (it references answers via FK in older schemas).
DROP TABLE IF EXISTS mbti_answer_effects;

-- Rebuild answers table to the simplified schema.
CREATE TABLE IF NOT EXISTS answers_new (
  test_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  effect_key TEXT NOT NULL DEFAULT '',
  effect_delta INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (test_id, answer_id),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id, question_id) REFERENCES questions(test_id, question_id) ON DELETE CASCADE
);

-- Backfill from existing answers columns (best-effort).
-- Priority:
-- 1) score columns (score_key/score_value) if present and non-empty
-- 2) pole columns (pole_axis/pole_side/weight) for MBTI axes
INSERT INTO answers_new (
  test_id,
  answer_id,
  question_id,
  ord,
  answer,
  effect_key,
  effect_delta,
  created_at,
  updated_at
)
SELECT
  a.test_id,
  a.answer_id,
  a.question_id,
  a.ord,
  COALESCE(a.answer, ''),
  CASE
    WHEN TRIM(COALESCE(a.score_key, '')) <> '' THEN TRIM(COALESCE(a.score_key, ''))
    WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) <> '' THEN UPPER(TRIM(COALESCE(a.pole_axis, '')))
    ELSE ''
  END AS effect_key,
  CASE
    WHEN TRIM(COALESCE(a.score_key, '')) <> '' THEN CAST(COALESCE(a.score_value, 0) AS INTEGER)
    WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) IN ('EI','SN','TF','JP') THEN
      (
        CASE
          -- Support both letter-side (preferred) and legacy plus/minus.
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'EI' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('E','PLUS') THEN 1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'EI' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('I','MINUS') THEN -1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'SN' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('S','PLUS') THEN 1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'SN' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('N','MINUS') THEN -1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'TF' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('T','PLUS') THEN 1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'TF' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('F','MINUS') THEN -1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'JP' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('J','PLUS') THEN 1
          WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'JP' AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('P','MINUS') THEN -1
          ELSE 0
        END
      ) * ABS(COALESCE(a.weight, 1))
    ELSE 0
  END AS effect_delta,
  COALESCE(a.created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) AS created_at,
  COALESCE(a.updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) AS updated_at
FROM answers a;

DROP TABLE answers;
ALTER TABLE answers_new RENAME TO answers;

-- Recreate indexes for answers.
CREATE INDEX IF NOT EXISTS idx_answers_test_question_ord ON answers(test_id, question_id, ord);
CREATE INDEX IF NOT EXISTS idx_answers_test_effect_key ON answers(test_id, effect_key);



