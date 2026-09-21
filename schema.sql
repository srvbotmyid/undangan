-- Skema Buku Tamu Digital QR
-- SQLite (dipakai via node:sqlite bawaan Node 24, tanpa native build)

CREATE TABLE IF NOT EXISTS greetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL CHECK(length(message) >= 1 AND length(message) <= 500),
  frame_id TEXT NOT NULL CHECK(frame_id IN ('frame1','frame2','frame3','frame4','frame5')),
  card_image_path TEXT,
  guest_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  moderated_at DATETIME,
  moderated_by TEXT DEFAULT 'admin'
);
CREATE INDEX IF NOT EXISTS idx_greetings_status_created ON greetings(status, created_at DESC);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,
  file TEXT NOT NULL,
  label TEXT NOT NULL
);

-- Seed 5 frame (dijalankan dengan INSERT OR IGNORE dari db.js)
