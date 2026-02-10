-- Schema v2: analytics + publishing + image metadata table
-- Safe to run multiple times.

ALTER TABLE tests ADD COLUMN question_count INTEGER DEFAULT 0;
ALTER TABLE tests ADD COLUMN is_published INTEGER DEFAULT 0;
ALTER TABLE tests ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE tests ADD COLUMN created_ts TEXT;
ALTER TABLE tests ADD COLUMN updated_ts TEXT;

CREATE INDEX IF NOT EXISTS idx_tests_title ON tests(title);
CREATE INDEX IF NOT EXISTS idx_tests_published_updated
ON tests(is_published, updated_at DESC);

CREATE TABLE IF NOT EXISTS test_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id TEXT NOT NULL,
  image_key TEXT NOT NULL,
  image_type TEXT NOT NULL,
  image_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  uploaded_at TEXT,
  UNIQUE(test_id, image_name),
  FOREIGN KEY (test_id) REFERENCES tests(test_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_images_test_id
ON test_images(test_id);
