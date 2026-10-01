// Koneksi SQLite via modul bawaan Node 24 (node:sqlite).
// Tidak butuh better-sqlite3 / Visual Studio Build Tools.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'guestbook.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Terapkan schema.sql
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migrasi ringan: DB lama (sebelum frame6-10) punya CHECK frame_id
// yang hanya mengizinkan frame1-5. SQLite tidak bisa ALTER CHECK,
// jadi buat ulang tabel greetings dengan skema baru sambil mempertahankan data.
try {
  const row = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='greetings'"
  ).get();
  if (row && row.sql && !row.sql.includes('frame10')) {
    db.exec(`CREATE TABLE IF NOT EXISTS greetings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL CHECK(length(message) >= 1 AND length(message) <= 500),
  frame_id TEXT NOT NULL CHECK(frame_id IN ('frame1','frame2','frame3','frame4','frame5','frame6','frame7','frame8','frame9','frame10')),
  card_image_path TEXT,
  guest_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  moderated_at DATETIME,
  moderated_by TEXT DEFAULT 'admin'
);
INSERT INTO greetings_new (id, sender_name, message, frame_id, card_image_path, guest_token, status, created_at, moderated_at, moderated_by)
  SELECT id, sender_name, message, frame_id, card_image_path, guest_token, status, created_at, moderated_at, moderated_by FROM greetings;
DROP TABLE greetings;
ALTER TABLE greetings_new RENAME TO greetings;
CREATE INDEX IF NOT EXISTS idx_greetings_status_created ON greetings(status, created_at DESC);`);
    console.log('Migrasi DB: tabel greetings diperluas ke frame1-frame10.');
  }
} catch (e) {
  console.warn('Migrasi DB frame6-10 dilewati:', e.message);
}

try {
  const cols = db.prepare('PRAGMA table_info(greetings)').all();
  if (!cols.some((c) => c.name === 'font_id')) {
    db.exec("ALTER TABLE greetings ADD COLUMN font_id TEXT NOT NULL DEFAULT 'cormorant'");
    console.log('Migrasi DB: kolom font_id ditambah.');
  }
} catch (e) {
  console.warn('Migrasi DB font_id dilewati:', e.message);
}

// Seed tabel frames (id -> file publik + label)
const seedFrames = [
  ['frame1', '/frames/frame1.png', 'Emas Floral'],
  ['frame2', '/frames/frame2.png', 'Mawar Putih'],
  ['frame3', '/frames/frame3.png', 'Lily Putih'],
  ['frame4', '/frames/frame4.png', 'Blush Mawar'],
  ['frame5', '/frames/frame5.png', 'Emas Barok'],
  ['frame6', '/frames/frame6.png', 'Satin Lily'],
  ['frame7', '/frames/frame7.png', 'Tulip Pink'],
  ['frame8', '/frames/frame8.png', 'Marble Rose'],
  ['frame9', '/frames/frame9.png', 'Kartu Kayu'],
  ['frame10', '/frames/frame10.png', 'Anggrek Pink'],
];
const upsertFrame = db.prepare(
  'INSERT INTO frames (id, file, label) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET file = excluded.file, label = excluded.label'
);
for (const f of seedFrames) upsertFrame.run(...f);

export const FRAME_IDS = ['frame1', 'frame2', 'frame3', 'frame4', 'frame5', 'frame6', 'frame7', 'frame8', 'frame9', 'frame10'];
export const FONT_IDS = ['cormorant', 'vibes', 'dancing', 'playfair', 'merriweather', 'jost'];

export function insertGreeting({ sender_name, message, frame_id, card_image_path, guest_token, font_id }) {
  const stmt = db.prepare(
    `INSERT INTO greetings (sender_name, message, frame_id, card_image_path, guest_token, status, font_id)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  );
  const res = stmt.run(
    sender_name,
    message,
    frame_id,
    card_image_path || null,
    guest_token || null,
    FONT_IDS.includes(font_id) ? font_id : 'cormorant'
  );
  return Number(res.lastInsertRowid);
}

export function listGreetings({ status = 'approved', page = 1, limit = 12 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const rows = db
    .prepare(
      `SELECT id, sender_name, message, frame_id, font_id, card_image_path, status, created_at
       FROM greetings WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(status, limit, offset);
  const total = db
    .prepare('SELECT COUNT(*) AS c FROM greetings WHERE status = ?')
    .get(status).c;
  return { rows, total, page, limit };
}

export function getGreeting(id) {
  return db.prepare(
    `SELECT id, sender_name, message, frame_id, font_id, card_image_path, status, created_at
     FROM greetings WHERE id = ?`
  ).get(id);
}

export function updateGreeting(id, { sender_name, message, frame_id, font_id }) {
  const cur = getGreeting(id);
  if (!cur) return 0;
  const next = {
    sender_name: sender_name !== undefined ? String(sender_name).trim().slice(0, 100) : cur.sender_name,
    message: message !== undefined ? String(message).trim().slice(0, 500) : cur.message,
    frame_id: frame_id !== undefined ? frame_id : cur.frame_id,
    font_id: font_id !== undefined ? font_id : (cur.font_id || 'cormorant'),
  };
  if (!next.sender_name) throw new Error('Nama pengirim wajib diisi.');
  if (!next.message) throw new Error('Ucapan wajib diisi.');
  if (next.message.length > 500) throw new Error('Ucapan maksimal 500 karakter.');
  if (!FRAME_IDS.includes(next.frame_id)) throw new Error('frame_id tidak valid.');
  if (!FONT_IDS.includes(next.font_id)) throw new Error('font_id tidak valid.');
  const info = db
    .prepare(`UPDATE greetings SET sender_name = ?, message = ?, frame_id = ?, font_id = ? WHERE id = ?`)
    .run(next.sender_name, next.message, next.frame_id, next.font_id, id);
  return info.changes;
}

export function setStatus(id, status, by = 'admin') {
  const allowed = ['pending', 'approved', 'rejected'];
  if (!allowed.includes(status)) throw new Error('status tidak valid');
  const info = db
    .prepare(`UPDATE greetings SET status = ?, moderated_at = datetime('now','localtime'), moderated_by = ? WHERE id = ?`)
    .run(status, by, id);
  return info.changes;
}

export function deleteGreeting(id) {
  const row = db.prepare('SELECT card_image_path FROM greetings WHERE id = ?').get(id);
  db.prepare('DELETE FROM greetings WHERE id = ?').run(id);
  return row;
}

export function getStats() {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS c FROM greetings GROUP BY status')
    .all();
  const stats = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const r of rows) {
    stats[r.status] = r.c;
    stats.total += r.c;
  }
  return stats;
}

// --- Pengaturan Dinamis (Settings) ---
const DEFAULT_SETTINGS = {
  cover_title: 'Ucapan Digital',
  couple_names: 'Nara & Ilyas',
  wedding_date: '15 Agustus 2026',
  hero_kicker: 'The Wedding of',
  hero_lead: 'Tulis ucapan dan doa untuk kami. Kartu terbuka setelah transfer diverifikasi.',
  thank_note: 'Atas doa restunya, kami ucapkan terima kasih.',
  bank1_bank: 'BCA',
  bank1_name: 'Nadita Ranasya',
  bank1_number: '7314191995',
  bank2_bank: 'BCA',
  bank2_name: 'Ilyas Abdussalam',
  bank2_number: '7313160621',
  price_amount: '500.000',
  payment_note: 'Kirim tanda kasih Rp 500.000 untuk mendapatkan dan membuka template ucapan digital.',
  qris_image_path: '',
  telegram_bot_token: '',
  telegram_chat_id: '',
  telegram_enabled: '0',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  insertSetting.run(k, v);
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function getPublicSettings() {
  const all = getAllSettings();
  // Tidak mengirim telegram_bot_token & telegram_chat_id ke publik
  const { telegram_bot_token, telegram_chat_id, ...pub } = all;
  return pub;
}

export function updateSettings(pairs) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(pairs)) {
    if (v !== undefined && v !== null) {
      stmt.run(k, String(v));
    }
  }
  return getAllSettings();
}

// --- Manajemen Pembayaran (Payments) ---
export function insertPayment({ payer_name, amount, bank_target, proof_image_path, access_token, note }) {
  const stmt = db.prepare(`
    INSERT INTO payments (payer_name, amount, bank_target, proof_image_path, access_token, status, note)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `);
  const res = stmt.run(
    String(payer_name).trim().slice(0, 100),
    String(amount || '500.000').slice(0, 50),
    String(bank_target || 'BCA').slice(0, 50),
    String(proof_image_path),
    String(access_token),
    note ? String(note).slice(0, 255) : null
  );
  return Number(res.lastInsertRowid);
}

export function getPaymentByToken(token) {
  return db.prepare('SELECT id, payer_name, amount, bank_target, proof_image_path, access_token, status, created_at, reviewed_at FROM payments WHERE access_token = ?').get(token);
}

export function getPaymentById(id) {
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
}

export function listPayments({ status = 'pending', page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  let rows, total;
  if (status === 'all') {
    rows = db.prepare('SELECT * FROM payments ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
    total = db.prepare('SELECT COUNT(*) AS c FROM payments').get().c;
  } else {
    rows = db.prepare('SELECT * FROM payments WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(status, limit, offset);
    total = db.prepare('SELECT COUNT(*) AS c FROM payments WHERE status = ?').get(status).c;
  }
  return { rows, total, page, limit };
}

export function setPaymentStatus(id, status, by = 'admin') {
  const allowed = ['pending', 'approved', 'rejected'];
  if (!allowed.includes(status)) throw new Error('status tidak valid');
  const info = db.prepare(`
    UPDATE payments SET status = ?, reviewed_at = datetime('now','localtime'), reviewed_by = ? WHERE id = ?
  `).run(status, by, id);
  return info.changes;
}

export function deletePayment(id) {
  const row = db.prepare('SELECT proof_image_path FROM payments WHERE id = ?').get(id);
  db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  return row;
}

export function getPaymentStats() {
  const rows = db.prepare('SELECT status, COUNT(*) AS c FROM payments GROUP BY status').all();
  const stats = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const r of rows) {
    stats[r.status] = r.c;
    stats.total += r.c;
  }
  return stats;
}

