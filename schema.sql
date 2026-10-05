-- Skema Buku Tamu Digital QR
-- SQLite (dipakai via node:sqlite bawaan Node 24, tanpa native build)

CREATE TABLE IF NOT EXISTS greetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL CHECK(length(message) >= 1 AND length(message) <= 500),
  frame_id TEXT NOT NULL CHECK(frame_id IN ('frame1','frame2','frame3','frame4','frame5','frame6','frame7','frame8','frame9','frame10')),
  card_image_path TEXT,
  guest_token TEXT,
  font_id TEXT NOT NULL DEFAULT 'cormorant',
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

-- Pengaturan dinamis sistem (rekening, harga, teks, bot telegram, qris)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Pembayaran / transfer masuk untuk membuka template ucapan
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payer_name VARCHAR(100) NOT NULL,
  amount TEXT NOT NULL DEFAULT '500.000',
  bank_target TEXT NOT NULL DEFAULT 'BCA',
  proof_image_path TEXT,
  access_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  note TEXT,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  reviewed_at DATETIME,
  reviewed_by TEXT DEFAULT 'admin',
  mayar_invoice_id TEXT,
  mayar_transaction_id TEXT,
  mayar_link TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_token ON payments(access_token);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_mayar_invoice ON payments(mayar_invoice_id);


