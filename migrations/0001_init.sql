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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Questions (ordered)
CREATE TABLE IF NOT EXISTS questions (
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
-- Answers (ordered, N per question)
CREATE TABLE IF NOT EXISTS answers (
  test_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  -- Designers should not edit JSON. Store evaluation inputs in typed columns instead.
  -- For MBTI:
  mbti_axis TEXT NOT NULL DEFAULT '',
  -- EI/SN/TF/JP
  mbti_dir TEXT NOT NULL DEFAULT 'plus',
  -- plus | minus  (더하기/빼기)
  weight INTEGER NOT NULL DEFAULT 1,
  -- amount (양수, 기본 1)
  -- For score-based tests:
  score_key TEXT NOT NULL DEFAULT '',
  -- e.g. "A" / "summer" / any result key
  score_value INTEGER NOT NULL DEFAULT 0,
  -- points added to score_key
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (test_id, answer_id),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id, question_id) REFERENCES questions(test_id, question_id) ON DELETE CASCADE
);
-- Results (generic, keyed by result)
CREATE TABLE IF NOT EXISTS results (
  test_id TEXT NOT NULL,
  result_id TEXT NOT NULL,
  result_image TEXT NOT NULL DEFAULT '',
  result_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (test_id, result_id),
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);
-- Indexes (added here for initial perf; additional indexes may follow in 0002)
CREATE INDEX IF NOT EXISTS idx_questions_test_ord ON questions(test_id, ord);
CREATE INDEX IF NOT EXISTS idx_answers_test_question_ord ON answers(test_id, question_id, ord);
CREATE INDEX IF NOT EXISTS idx_results_test_result_id ON results(test_id, result_id);