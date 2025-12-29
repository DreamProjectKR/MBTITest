-- Initial schema for generalized tests (N answers per question) stored in D1 (SQLite).
-- Images remain in R2; we store only R2 object keys (usually `assets/...`) in D1.

-- Tests (top-level metadata + rules)
CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic',
  description_text TEXT NOT NULL DEFAULT '',
  tags_text TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  author_img TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Questions (ordered)
CREATE TABLE IF NOT EXISTS questions (
  test_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  prompt_image TEXT NOT NULL DEFAULT '',
  prompt_text TEXT NOT NULL DEFAULT '',
  prompt_meta_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (test_id, question_id),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Answers (ordered, N per question)
CREATE TABLE IF NOT EXISTS answers (
  test_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (test_id, answer_id),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id, question_id) REFERENCES questions(test_id, question_id) ON DELETE CASCADE
);

-- Outcomes / results (generic, keyed by code)
CREATE TABLE IF NOT EXISTS outcomes (
  test_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (test_id, code),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Indexes (added here for initial perf; additional indexes may follow in 0002)
CREATE INDEX IF NOT EXISTS idx_questions_test_ord ON questions(test_id, ord);
CREATE INDEX IF NOT EXISTS idx_answers_test_question_ord ON answers(test_id, question_id, ord);
CREATE INDEX IF NOT EXISTS idx_outcomes_test_code ON outcomes(test_id, code);


