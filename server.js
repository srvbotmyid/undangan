// Server Undangan QR + Buku Tamu Digital
// Node 24 + Express 4 + node:sqlite (tanpa native build)
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, FRAME_IDS, insertGreeting, listGreetings, getStats, setStatus, deleteGreeting, updateGreeting } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* .env opsional */ }
}
loadEnv();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
if (ADMIN_PASSWORD === 'admin123') {
  console.warn('WARNING: ADMIN_PASSWORD masih default. Ganti di .env sebelum deploy!');
}

const app = express();
app.set('trust proxy', 1); // wajib di balik proxy Coolify/Cloudflare agar req.ip & rate-limit benar
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (arr.length > 30) return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar.' });
  next();
}

const uploadDir = path.join(__dirname, 'uploads', 'cards');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '.png').toLowerCase();
    const safe = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('File harus gambar PNG/JPG/WebP'));
  },
});

function validateGreeting({ sender_name, message, frame_id }) {
  const errors = [];
  if (!sender_name || !String(sender_name).trim()) errors.push('Nama pengirim wajib diisi.');
  if (String(sender_name || '').length > 100) errors.push('Nama maksimal 100 karakter.');
  if (!message || !String(message).trim()) errors.push('Ucapan wajib diisi.');
  if (String(message || '').length > 500) errors.push('Ucapan maksimal 500 karakter.');
  if (!FRAME_IDS.includes(frame_id)) errors.push('frame_id tidak valid.');
  return errors;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/healthz', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/frames', (_req, res) => {
  const rows = db.prepare('SELECT id, file, label FROM frames ORDER BY CAST(SUBSTR(id, 6) AS INTEGER)').all();
  res.json(rows);
});

app.get('/api/greetings', (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(24, Math.max(1, Number(req.query.limit || 12)));
  const data = listGreetings({ status: 'approved', page, limit });
  res.json({ ...data, totalPages: Math.ceil(data.total / limit) });
});


// --- Auth admin: password tunggal -> token in-memory ---
const adminTokens = new Set();
app.post('/api/admin/login', rateLimit, (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomUUID();
    adminTokens.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Password salah.' });
});

function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'];
  if (t && adminTokens.has(t)) return next();
  res.status(401).json({ error: 'Unauthorized. Silakan login admin.' });
}

app.get('/api/admin/stats', requireAdmin, (_req, res) => res.json(getStats()));

app.get('/api/admin/greetings', requireAdmin, (req, res) => {
  const status = String(req.query.status || 'pending');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status tidak valid' });
  }
  const data = listGreetings({ status, page, limit });
  res.json({ ...data, totalPages: Math.ceil(data.total / limit) });
});

app.patch('/api/admin/greetings/:id', requireAdmin, (req, res) => {
  const { status, sender_name, message, frame_id } = req.body || {};
  try {
    // Mode edit isi (nama/pesan/frame), boleh digabung dengan ganti status.
    if (sender_name !== undefined || message !== undefined || frame_id !== undefined) {
      const changes = updateGreeting(Number(req.params.id), { sender_name, message, frame_id });
      if (!changes) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    }
    if (status !== undefined) {
      const changes = setStatus(Number(req.params.id), status);
      if (!changes) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    }
    if (sender_name === undefined && message === undefined && frame_id === undefined && status === undefined) {
      return res.status(400).json({ error: 'Tidak ada perubahan.' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/greetings/:id', requireAdmin, (req, res) => {
  const row = deleteGreeting(Number(req.params.id));
  if (row && row.card_image_path) {
    const p = path.join(__dirname, row.card_image_path.replace(/^\//, ''));
    fs.unlink(p, () => {});
  }
  res.json({ ok: true });
});

app.get('/galeri', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'galeri.html')));
app.get('/gift', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'gift.html')));

app.post('/api/greetings', rateLimit, upload.single('card'), (req, res) => {
  try {
    const bb = req.body || {};
    const sender_name = bb.sender_name || '';
    const message = bb.message || '';
    const frame_id = bb.frame_id || '';
    const guest_token = bb.guest_token || '';
    const errors = validateGreeting({ sender_name, message, frame_id });
    if (errors.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: errors.join(' ') });
    }
    const card_image_path = req.file ? '/uploads/cards/' + req.file.filename : null;
    const id = insertGreeting({
      sender_name: String(sender_name).trim().slice(0, 100),
      message: String(message).trim().slice(0, 500),
      frame_id,
      card_image_path,
      guest_token: String(guest_token || '').slice(0, 50),
    });
    res.status(201).json({
      id, status: 'pending', card_url: card_image_path,
      message: 'Terima kasih! Ucapanmu tersimpan dan menunggu persetujuan admin.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan ucapan.' });
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Request tidak valid.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Undangan QR jalan di http://localhost:' + PORT);
  console.log('  / (form) | /gift | /galeri | /admin | /healthz');
});

// Shutdown rapi saat Coolify restart/redeploy container
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { db.close(); } catch {}
    process.exit(0);
  });
}

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

