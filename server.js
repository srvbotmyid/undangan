// Server undangan: Express + SQLite
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  db,
  FRAME_IDS,
  FONT_IDS,
  insertGreeting,
  listGreetings,
  getStats,
  setStatus,
  deleteGreeting,
  updateGreeting,
  getAllSettings,
  getPublicSettings,
  updateSettings,
  insertPayment,
  getPaymentByToken,
  getPaymentById,
  listPayments,
  setPaymentStatus,
  deletePayment,
  getPaymentStats,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      }
    }
  } catch { /* .env opsional */ }
}
loadEnv();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'admin123').trim();
if (ADMIN_PASSWORD === 'admin123') {
  console.warn('WARNING: ADMIN_PASSWORD masih default. Ganti di .env sebelum deploy!');
}

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
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

// Storage untuk Bukti Transfer
const proofDir = path.join(__dirname, 'uploads', 'proofs');
fs.mkdirSync(proofDir, { recursive: true });
const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
    const safe = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `proof-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${safe}`);
  },
});
const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('File bukti transfer harus format PNG/JPG/WebP'));
  },
});

// Storage untuk QRIS Admin
const qrisDir = path.join(__dirname, 'uploads', 'qris');
fs.mkdirSync(qrisDir, { recursive: true });
const qrisStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, qrisDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '.png').toLowerCase();
    const safe = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
    cb(null, `qris-${Date.now()}${safe}`);
  },
});
const uploadQris = multer({
  storage: qrisStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('File QRIS harus gambar PNG/JPG/WebP'));
  },
});

// Helper Kirim Notifikasi Telegram
async function notifyTelegram({ title, message, photoPath }) {
  const cfg = getAllSettings();
  const token = (process.env.TELEGRAM_BOT_TOKEN || cfg.telegram_bot_token || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || cfg.telegram_chat_id || '').trim();
  const enabled = cfg.telegram_enabled === '1' || Boolean(process.env.TELEGRAM_BOT_TOKEN);
  if (!enabled || !token || !chatId) return { ok: false, reason: 'Telegram belum aktif atau token kosong' };

  try {
    const caption = `<b>${title}</b>\n\n${message}`;
    if (photoPath && fs.existsSync(photoPath)) {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      const fileBytes = fs.readFileSync(photoPath);
      const blob = new Blob([fileBytes]);
      form.append('photo', blob, path.basename(photoPath));
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      return { ok: data.ok, data };
    } else {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: 'HTML' }),
      });
      const data = await res.json();
      return { ok: data.ok, data };
    }
  } catch (err) {
    console.warn('Gagal kirim notif telegram:', err.message);
    return { ok: false, error: err.message };
  }
}


function validateGreeting({ sender_name, message, frame_id, font_id }) {
  const errors = [];
  if (!sender_name || !String(sender_name).trim()) errors.push('Nama pengirim wajib diisi.');
  if (String(sender_name || '').length > 100) errors.push('Nama maksimal 100 karakter.');
  if (!message || !String(message).trim()) errors.push('Ucapan wajib diisi.');
  if (String(message || '').length > 500) errors.push('Ucapan maksimal 500 karakter.');
  if (!FRAME_IDS.includes(frame_id)) errors.push('frame_id tidak valid.');
  if (font_id && !FONT_IDS.includes(font_id)) errors.push('font_id tidak valid.');
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
app.get('/api/settings', (_req, res) => {
  res.json(getPublicSettings());
});

app.post('/api/payments/submit', rateLimit, uploadProof.single('proof'), async (req, res) => {
  try {
    const bb = req.body || {};
    const payer_name = String(bb.payer_name || '').trim();
    if (!payer_name) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Nama pengirim / pemilik rekening wajib diisi.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Foto bukti transfer wajib diunggah.' });
    }
    const token = crypto.randomUUID();
    const settings = getAllSettings();
    const proof_image_path = '/uploads/proofs/' + req.file.filename;
    const paymentId = insertPayment({
      payer_name,
      amount: settings.price_amount || '500.000',
      bank_target: bb.bank_target || 'BCA',
      proof_image_path,
      access_token: token,
      note: bb.note || '',
    });

    // Kirim notifikasi bot Telegram jika aktif
    notifyTelegram({
      title: '🔔 Pembayaran Masuk (Rp ' + (settings.price_amount || '500.000') + ')',
      message: `ID: #${paymentId}\nNama Pengirim: <b>${payer_name}</b>\nTujuan: <b>${bb.bank_target || 'BCA'}</b>\nWaktu: ${new Date().toLocaleString('id-ID')}\n\nSilakan cek panel /admin untuk verifikasi.`,
      photoPath: req.file.path,
    }).catch(() => {});

    res.status(201).json({
      ok: true,
      token,
      message: 'Bukti transfer berhasil dikirim. Menunggu verifikasi admin.',
    });
  } catch (err) {
    console.error('Submit payment error:', err);
    res.status(500).json({ error: 'Gagal mengirim bukti transfer.' });
  }
});

app.get('/api/payments/status/:token', (req, res) => {
  const token = String(req.params.token || '');
  if (!token) return res.status(400).json({ error: 'Token diperlukan.' });
  const row = getPaymentByToken(token);
  if (!row) return res.status(404).json({ error: 'Data pembayaran tidak ditemukan.' });
  res.json({
    status: row.status,
    payer_name: row.payer_name,
    amount: row.amount,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
  });
});



// --- Auth admin: password tunggal, token disimpan di data/admin-tokens.json ---
const TOKEN_FILE = path.join(__dirname, 'data', 'admin-tokens.json');
function loadAdminTokens() {
  try {
    const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    const now = Date.now();
    return new Set((Array.isArray(raw) ? raw : []).filter((t) => t && t.token && (!t.exp || t.exp > now)).map((t) => t.token));
  } catch {
    return new Set();
  }
}
function saveAdminTokens() {
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify([...adminTokens].map((token) => ({ token, exp }))));
  } catch (e) {
    console.warn('Gagal simpan token admin:', e.message);
  }
}
const adminTokens = loadAdminTokens();
const COOKIE_NAME = 'admin_session';

function cookieShouldBeSecure(req) {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setAdminCookie(req, res, token) {
  const parts = [
    COOKIE_NAME + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + String(7 * 24 * 60 * 60),
  ];
  if (cookieShouldBeSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAdminCookie(req, res) {
  const parts = [COOKIE_NAME + '=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (cookieShouldBeSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function readAdminToken(req) {
  const header = req.headers['x-admin-token'] || '';
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const cookie = parseCookies(req)[COOKIE_NAME] || '';
  return String(header || bearer || cookie || '').trim();
}

app.post('/api/admin/login', rateLimit, (req, res) => {
  const password = String((req.body || {}).password || '').trim();
  if (password && password === ADMIN_PASSWORD) {
    const token = crypto.randomUUID();
    adminTokens.add(token);
    saveAdminTokens();
    setAdminCookie(req, res, token);
    return res.json({ ok: true, token });
  }
  res.status(401).json({ error: 'Password salah.' });
});

app.post('/api/admin/logout', (req, res) => {
  const t = readAdminToken(req);
  if (t) adminTokens.delete(t);
  saveAdminTokens();
  clearAdminCookie(req, res);
  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  const t = readAdminToken(req);
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
  const { status, sender_name, message, frame_id, font_id } = req.body || {};
  try {
    // Mode edit isi (nama/pesan/frame/font), boleh digabung dengan ganti status.
    if (sender_name !== undefined || message !== undefined || frame_id !== undefined || font_id !== undefined) {
      const changes = updateGreeting(Number(req.params.id), { sender_name, message, frame_id, font_id });
      if (!changes) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    }
    if (status !== undefined) {
      const changes = setStatus(Number(req.params.id), status);
      if (!changes) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    }
    if (sender_name === undefined && message === undefined && frame_id === undefined && font_id === undefined && status === undefined) {
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
// --- Admin: Settings API ---
app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json(getAllSettings());
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const updated = updateSettings(req.body || {});
    res.json({ ok: true, settings: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/upload-qris', requireAdmin, uploadQris.single('qris'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File QRIS wajib diunggah.' });
  const qrisPath = '/uploads/qris/' + req.file.filename;
  updateSettings({ qris_image_path: qrisPath });
  res.json({ ok: true, qris_url: qrisPath });
});

app.post('/api/admin/telegram/test', requireAdmin, async (_req, res) => {
  const result = await notifyTelegram({
    title: '🔔 Tes Notifikasi Undangan Digital',
    message: 'Koneksi bot Telegram berhasil terhubung!\nPanel Admin siap menerima bukti pembayaran.',
  });
  if (result.ok) res.json({ ok: true, message: 'Pesan tes berhasil dikirim ke Telegram.' });
  else res.status(400).json({ error: result.reason || result.error || 'Gagal mengirim pesan ke Telegram.' });
});

// --- Admin: Payments Moderation API ---
app.get('/api/admin/payments', requireAdmin, (req, res) => {
  const status = String(req.query.status || 'pending');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const data = listPayments({ status, page, limit });
  const stats = getPaymentStats();
  res.json({ ...data, stats, totalPages: Math.ceil(data.total / limit) });
});

app.patch('/api/admin/payments/:id', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  try {
    const id = Number(req.params.id);
    const changes = setPaymentStatus(id, status);
    if (!changes) return res.status(404).json({ error: 'Pembayaran tidak ditemukan.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/payments/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = deletePayment(id);
  if (row && row.proof_image_path) {
    const p = path.join(__dirname, row.proof_image_path.replace(/^\//, ''));
    fs.unlink(p, () => {});
  }
  res.json({ ok: true });
});


app.get('/galeri', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'galeri.html')));
app.get('/gift', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'gift.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.post('/api/greetings', rateLimit, upload.single('card'), (req, res) => {
  try {
    const bb = req.body || {};
    const sender_name = bb.sender_name || '';
    const message = bb.message || '';
    const frame_id = bb.frame_id || '';
    const guest_token = bb.guest_token || '';
    const font_id = bb.font_id || 'cormorant';
    const errors = validateGreeting({ sender_name, message, frame_id, font_id });
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
      font_id,
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

