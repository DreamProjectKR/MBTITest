-- 0002_schema_simplify.sql
-- Migrates from the original normalized schema to the simplified schema:
-- - tests: drop rules_json
-- - questions: label -> question, prompt_image -> question_image, drop prompt_text/prompt_meta_json
-- - answers: label -> answer, drop payload_json
-- - outcomes -> results, code -> result, image -> result_image, drop title/meta_json
PRAGMA foreign_keys = OFF;
-- Tests
CREATE TABLE IF NOT EXISTS tests__new (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'generic',
    description_text TEXT NOT NULL DEFAULT '',
    tags_text TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    author_img TEXT NOT NULL DEFAULT '',
    thumbnail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO tests__new (
        id,
        title,
        type,
        description_text,
        tags_text,
        author,
        author_img,
        thumbnail,
        created_at,
        updated_at
    )
SELECT id,
    title,
    type,
    description_text,
    tags_text,
    author,
    author_img,
    thumbnail,
    created_at,
    updated_at
FROM tests;
DROP TABLE tests;
ALTER TABLE tests__new
    RENAME TO tests;
-- Questions
CREATE TABLE IF NOT EXISTS questions__new (
    test_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    question TEXT NOT NULL DEFAULT '',
    question_image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (test_id, question_id),
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);
INSERT INTO questions__new (
        test_id,
        question_id,
        ord,
        question,
        question_image,
        created_at,
        updated_at
    )
SELECT test_id,
    question_id,
    ord,
    label,
    prompt_image,
    created_at,
    updated_at
FROM questions;
DROP TABLE questions;
ALTER TABLE questions__new
    RENAME TO questions;
-- Answers
CREATE TABLE IF NOT EXISTS answers__new (
    test_id TEXT NOT NULL,
    answer_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
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
        created_at,
        updated_at
    )
SELECT test_id,
    answer_id,
    question_id,
    ord,
    label,
    created_at,
    updated_at
FROM answers;
DROP TABLE answers;
ALTER TABLE answers__new
    RENAME TO answers;
-- Outcomes -> Results
CREATE TABLE IF NOT EXISTS results (
    test_id TEXT NOT NULL,
    result TEXT NOT NULL,
    result_image TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (test_id, result),
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);
INSERT INTO results (
        test_id,
        result,
        result_image,
        summary,
        created_at,
        updated_at
    )
SELECT test_id,
    code,
    image,
    summary,
    created_at,
    updated_at
FROM outcomes;
DROP TABLE outcomes;
-- Recreate indexes
DROP INDEX IF EXISTS idx_questions_test_ord;
DROP INDEX IF EXISTS idx_answers_test_question_ord;
DROP INDEX IF EXISTS idx_outcomes_test_code;
DROP INDEX IF EXISTS idx_results_test_result;
CREATE INDEX IF NOT EXISTS idx_questions_test_ord ON questions(test_id, ord);
CREATE INDEX IF NOT EXISTS idx_answers_test_question_ord ON answers(test_id, question_id, ord);
CREATE INDEX IF NOT EXISTS idx_results_test_result ON results(test_id, result);
PRAGMA foreign_keys = ON;