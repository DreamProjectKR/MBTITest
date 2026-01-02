PRAGMA foreign_keys = ON;
-- Core test metadata lives in D1.
-- Full quiz data (questions/answers/results) lives in R2 as `assets/<test>/test.json`.
CREATE TABLE IF NOT EXISTS tests (
  test_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description_json TEXT,
  -- JSON string (array or string)
  author TEXT,
  author_img_path TEXT,
  thumbnail_path TEXT,
  source_path TEXT,
  -- e.g. "test-root-vegetables/test.json" (from index.json)
  tags_json TEXT,
  -- JSON array string (e.g. ["여름","휴가"])
  created_at TEXT,
  -- ISO date string
  updated_at TEXT -- ISO date string
);