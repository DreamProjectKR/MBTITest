-- 0004_mbti_dir_plus_minus.sql
-- Standardize MBTI scoring semantics for designers:
-- - answers.mbti_axis: EI/SN/TF/JP
-- - answers.mbti_dir: 'plus' | 'minus' (더하기/빼기)
-- - answers.weight: positive integer amount
--
-- If old data stored letters (E/I/S/N/T/F/J/P) in mbti_dir, convert to plus/minus using axis:
-- - EI: E => plus, I => minus
-- - SN: S => plus, N => minus
-- - TF: T => plus, F => minus
-- - JP: J => plus, P => minus
UPDATE answers
SET mbti_dir = 'plus'
WHERE mbti_dir IS NULL
    OR trim(mbti_dir) = '';
-- EI
UPDATE answers
SET mbti_dir = CASE
        WHEN upper(trim(mbti_dir)) = 'E' THEN 'plus'
        WHEN upper(trim(mbti_dir)) = 'I' THEN 'minus'
        ELSE mbti_dir
    END
WHERE upper(trim(mbti_axis)) = 'EI';
-- SN
UPDATE answers
SET mbti_dir = CASE
        WHEN upper(trim(mbti_dir)) = 'S' THEN 'plus'
        WHEN upper(trim(mbti_dir)) = 'N' THEN 'minus'
        ELSE mbti_dir
    END
WHERE upper(trim(mbti_axis)) = 'SN';
-- TF
UPDATE answers
SET mbti_dir = CASE
        WHEN upper(trim(mbti_dir)) = 'T' THEN 'plus'
        WHEN upper(trim(mbti_dir)) = 'F' THEN 'minus'
        ELSE mbti_dir
    END
WHERE upper(trim(mbti_axis)) = 'TF';
-- JP
UPDATE answers
SET mbti_dir = CASE
        WHEN upper(trim(mbti_dir)) = 'J' THEN 'plus'
        WHEN upper(trim(mbti_dir)) = 'P' THEN 'minus'
        ELSE mbti_dir
    END
WHERE upper(trim(mbti_axis)) = 'JP';
-- Ensure weight is at least 1 for MBTI answers that have an axis set.
UPDATE answers
SET weight = 1
WHERE upper(trim(mbti_axis)) IN ('EI', 'SN', 'TF', 'JP')
    AND (
        weight IS NULL
        OR weight < 1
    );