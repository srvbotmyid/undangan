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

// Seed tabel frames (id -> file publik + label)
const seedFrames = [
  ['frame1', '/frames/frame1.png', 'Emas Elegan'],
  ['frame2', '/frames/frame2.png', 'Floral Sage'],
  ['frame3', '/frames/frame3.png', 'Putih Minimalis'],
  ['frame4', '/frames/frame4.png', 'Blush Romantis'],
  ['frame5', '/frames/frame5.png', 'Royal Maroon'],
];
const insertFrame = db.prepare(
  'INSERT OR IGNORE INTO frames (id, file, label) VALUES (?, ?, ?)'
);
for (const f of seedFrames) insertFrame.run(...f);

export const FRAME_IDS = ['frame1', 'frame2', 'frame3', 'frame4', 'frame5'];

export function insertGreeting({ sender_name, message, frame_id, card_image_path, guest_token }) {
  const stmt = db.prepare(
    `INSERT INTO greetings (sender_name, message, frame_id, card_image_path, guest_token, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  );
  const res = stmt.run(sender_name, message, frame_id, card_image_path || null, guest_token || null);
  return Number(res.lastInsertRowid);
}

export function listGreetings({ status = 'approved', page = 1, limit = 12 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const rows = db
    .prepare(
      `SELECT id, sender_name, message, frame_id, card_image_path, status, created_at
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
    `SELECT id, sender_name, message, frame_id, card_image_path, status, created_at
     FROM greetings WHERE id = ?`
  ).get(id);
}

export function updateGreeting(id, { sender_name, message, frame_id }) {
  const cur = getGreeting(id);
  if (!cur) return 0;
  const next = {
    sender_name: sender_name !== undefined ? String(sender_name).trim().slice(0, 100) : cur.sender_name,
    message: message !== undefined ? String(message).trim().slice(0, 500) : cur.message,
    frame_id: frame_id !== undefined ? frame_id : cur.frame_id,
  };
  if (!next.sender_name) throw new Error('Nama pengirim wajib diisi.');
  if (!next.message) throw new Error('Ucapan wajib diisi.');
  if (next.message.length > 500) throw new Error('Ucapan maksimal 500 karakter.');
  if (!FRAME_IDS.includes(next.frame_id)) throw new Error('frame_id tidak valid.');
  const info = db
    .prepare(`UPDATE greetings SET sender_name = ?, message = ?, frame_id = ? WHERE id = ?`)
    .run(next.sender_name, next.message, next.frame_id, id);
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
