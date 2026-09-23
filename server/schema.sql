-- AI Capsule database schema (SQLite).
-- Run automatically by server/db.js every time the server starts.
-- "IF NOT EXISTS" makes it safe to run repeatedly.

CREATE TABLE IF NOT EXISTS capsules (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT    NOT NULL,          -- GitHub user ID, taken from the verified JWT (never from the browser)
  project_name     TEXT    NOT NULL,
  prompt_title     TEXT    NOT NULL,
  prompt_version   TEXT,                      -- e.g. v1, v2, v3
  prompt_text      TEXT    NOT NULL,
  response_summary TEXT,
  category         TEXT,                      -- Coding / Debugging / Writing / Research / ...
  usefulness       TEXT,                      -- Very Useful / Good / Needs Improvement / Not Useful
  reviewed         INTEGER DEFAULT 0,         -- 0 = No, 1 = Yes
  improved         INTEGER DEFAULT 0,         -- 0 = No, 1 = Yes
  screenshot_url   TEXT,
  notes            TEXT,
  created_at       TEXT    DEFAULT CURRENT_TIMESTAMP,  -- UTC
  updated_at       TEXT                                -- UTC, set on every PUT
);

-- Every query filters by user_id, so index it.
CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules (user_id);
