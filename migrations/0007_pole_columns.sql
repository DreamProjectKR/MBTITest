-- Generalize MBTI scoring columns for reuse in non-MBTI tests.
--
-- Before:
--   answers.mbti_axis : EI/SN/TF/JP (MBTI axis)
--   answers.mbti_dir  : plus|minus (MBTI direction / delta sign)
--
-- After:
--   answers.pole_axis : "pole 영역" (e.g. EI/SN/TF/JP, or any axis identifier)
--   answers.pole_side : "세부 영역" (e.g. E/I/S/N/T/F/J/P, or any side identifier)
--
-- Notes:
-- - Keep `weight` as magnitude. For MBTI, delta sign is derived from (pole_axis, pole_side).
-- - Preserve existing data by converting old plus/minus into the corresponding MBTI letter side.
-- 1) Rename columns (idempotent if migration applied once).
ALTER TABLE answers
    RENAME COLUMN mbti_axis TO pole_axis;
ALTER TABLE answers
    RENAME COLUMN mbti_dir TO pole_side;
-- 2) Normalize casing and convert legacy plus/minus into MBTI letters.
UPDATE answers
SET pole_axis = UPPER(TRIM(COALESCE(pole_axis, ''))),
    pole_side = CASE
        WHEN LOWER(TRIM(COALESCE(pole_side, ''))) = 'plus' THEN CASE
            UPPER(TRIM(COALESCE(pole_axis, '')))
            WHEN 'EI' THEN 'E'
            WHEN 'SN' THEN 'S'
            WHEN 'TF' THEN 'T'
            WHEN 'JP' THEN 'J'
            ELSE ''
        END
        WHEN LOWER(TRIM(COALESCE(pole_side, ''))) = 'minus' THEN CASE
            UPPER(TRIM(COALESCE(pole_axis, '')))
            WHEN 'EI' THEN 'I'
            WHEN 'SN' THEN 'N'
            WHEN 'TF' THEN 'F'
            WHEN 'JP' THEN 'P'
            ELSE ''
        END
        ELSE UPPER(TRIM(COALESCE(pole_side, '')))
    END
WHERE TRIM(COALESCE(pole_axis, '')) <> ''
    OR TRIM(COALESCE(pole_side, '')) <> '';
-- 3) Refresh MBTI effect cache table from pole columns (best-effort, idempotent).
-- Only applies to MBTI axes; other poles are ignored.
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
    UPPER(TRIM(COALESCE(a.pole_axis, ''))) AS axis,
    (
        CASE
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'EI'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'E' THEN 1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'EI'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'I' THEN -1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'SN'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'S' THEN 1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'SN'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'N' THEN -1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'TF'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'T' THEN 1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'TF'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'F' THEN -1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'JP'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'J' THEN 1
            WHEN UPPER(TRIM(COALESCE(a.pole_axis, ''))) = 'JP'
            AND UPPER(TRIM(COALESCE(a.pole_side, ''))) = 'P' THEN -1
            ELSE 0
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
WHERE UPPER(TRIM(COALESCE(a.pole_axis, ''))) IN ('EI', 'SN', 'TF', 'JP')
    AND UPPER(TRIM(COALESCE(a.pole_side, ''))) IN ('E', 'I', 'S', 'N', 'T', 'F', 'J', 'P');