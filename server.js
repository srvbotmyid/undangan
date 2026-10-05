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
  getPaymentByMayarInvoice,
  listPayments,
  setPaymentStatus,
  deletePayment,
  getPaymentStats,
} from './db.js';
import { mountMcp } from './mcp.js';

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
// Bukti transfer ikut volume /app/uploads/cards yang sudah dipasang di Coolify.
// Folder /uploads/proofs tidak dipasang, jadi file di sana hilang tiap redeploy.
const proofDir = path.join(__dirname, 'uploads', 'cards', 'proofs');
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
async function notifyTelegram({ title, message, photoPath, buttons }) {
  const cfg = getAllSettings();
  const { token, chatIds, enabled } = telegramCfg();
  if (!enabled || !token || !chatIds.length) return { ok: false, reason: 'Telegram belum aktif atau token kosong' };

  try {
    const caption = `<b>${title}</b>\n\n${message}`;
    const reply_markup = buttons ? { inline_keyboard: buttons } : undefined;
    const results = [];
    for (const chatId of chatIds) {
      if (photoPath && fs.existsSync(photoPath)) {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption.slice(0, 1000));
        form.append('parse_mode', 'HTML');
        if (reply_markup) form.append('reply_markup', JSON.stringify(reply_markup));
        form.append('photo', new Blob([fs.readFileSync(photoPath)]), path.basename(photoPath));
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
        results.push((await res.json()).ok);
      } else {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: 'HTML', reply_markup }),
        });
        results.push((await res.json()).ok);
      }
    }
    return { ok: results.some(Boolean) };
  } catch (err) {
    console.warn('Gagal kirim notif telegram:', err.message);
    return { ok: false, error: err.message };
  }
}

function telegramCfg() {
  const cfg = getAllSettings();
  const raw = process.env.TELEGRAM_CHAT_ID || cfg.telegram_chat_id || '';
  const chatIds = [...new Set(String(raw).split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean))];
  return {
    token: (process.env.TELEGRAM_BOT_TOKEN || cfg.telegram_bot_token || '').trim(),
    chatIds,
    enabled: cfg.telegram_enabled === '1' || Boolean(process.env.TELEGRAM_BOT_TOKEN),
  };
}

function escHtml(value) {
  return String(value || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function notifyMayarPaid(row) {
  if (!row) return;
  notifyTelegram({
    title: 'Pembayaran Mayar lunas',
    message: 'Nama: <b>' + escHtml(row.payer_name) + '</b>\nNominal: Rp ' + escHtml(row.amount) + '\nStatus: otomatis disetujui, form ucapan terbuka.',
  }).catch(() => {});
}

async function answerTelegramCallback(id, text) {
  const { token } = telegramCfg();
  if (!token || !id) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text }),
  }).catch(() => {});
}

let telegramOffset = 0;
async function pollTelegram() {
  const { token, chatIds, enabled } = telegramCfg();
  if (!enabled || !token || !chatIds.length) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=0&offset=${telegramOffset}`);
  const data = await res.json();
  if (!data.ok) return;
  for (const update of data.result || []) {
    telegramOffset = update.update_id + 1;
    const query = update.callback_query;
    if (!query) continue;
    if (!chatIds.includes(String(query.message?.chat?.id || ''))) {
      await answerTelegramCallback(query.id, 'Chat ini tidak diizinkan.');
      continue;
    }
    const [action, kind, rawId] = String(query.data || '').split(':');
    const id = Number(rawId);
    if (!['ok', 'no'].includes(action) || !id) {
      await answerTelegramCallback(query.id, 'Perintah tidak dikenal.');
      continue;
    }
    const status = action === 'ok' ? 'approved' : 'rejected';
    if (kind === 'pay') {
      const changes = setPaymentStatus(id, status, 'telegram');
      await answerTelegramCallback(query.id, changes ? (status === 'approved' ? 'Pembayaran disetujui.' : 'Pembayaran ditolak.') : 'Data tidak ditemukan.');
    } else if (kind === 'greet') {
      const changes = setStatus(id, status, 'telegram');
      await answerTelegramCallback(query.id, changes ? (status === 'approved' ? 'Ucapan disetujui.' : 'Ucapan ditolak.') : 'Data tidak ditemukan.');
    }
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
mountMcp(app, __dirname);

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
    const proof_image_path = '/uploads/cards/proofs/' + req.file.filename;
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
      title: 'Bukti transfer masuk',
      message: `ID: #${paymentId}\nNama: <b>${escHtml(payer_name)}</b>\nTujuan: <b>${escHtml(bb.bank_target || 'BCA')}</b>\nNominal: Rp ${escHtml(settings.price_amount || '500.000')}\n\nTekan Setujui untuk membuka form ucapan.`,
      photoPath: req.file.path,
      buttons: [[
        { text: 'Setujui', callback_data: `ok:pay:${paymentId}` },
        { text: 'Tolak', callback_data: `no:pay:${paymentId}` },
      ]],
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

function parseRupiah(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function mayarConfig() {
  const apiKey = String(process.env.MAYAR_API_KEY || '').trim();
  const base = String(process.env.MAYAR_BASE_URL || 'https://api.mayar.id/hl/v2').replace(/\/$/, '');
  return { apiKey, base, enabled: Boolean(apiKey) };
}

function chargeAmount(settings) {
  const test = parseRupiah(process.env.MAYAR_TEST_AMOUNT);
  if (test > 0) return test;
  return parseRupiah(settings.price_amount) || 500000;
}

function formatRupiah(n) {
  return Number(n).toLocaleString('id-ID');
}

async function mayarFetch(pathname, { method = 'GET', body } = {}) {
  const { apiKey, base } = mayarConfig();
  if (!apiKey) throw new Error('Mayar belum dikonfigurasi.');
  const res = await fetch(base + pathname, {
    method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.statusCode && data.statusCode >= 400)) {
    const msg = data.messages || data.message || ('Mayar error ' + res.status);
    throw new Error(typeof msg === 'string' ? msg : 'Mayar menolak permintaan.');
  }
  return data;
}

function pickInvoiceId(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  return String(data?.paymentLinkId || data?.invoiceId || data?.id || payload?.paymentLinkId || '').trim();
}

async function confirmMayarPaid(invoiceId) {
  if (!invoiceId) return null;
  const detail = await mayarFetch('/invoices/' + encodeURIComponent(invoiceId));
  const row = detail?.data || {};
  if (String(row.status || '').toLowerCase() !== 'paid') return null;
  return row;
}

app.get('/api/payments/config', (_req, res) => {
  const settings = getAllSettings();
  const amount = chargeAmount(settings);
  res.json({
    mayar: mayarConfig().enabled,
    amount,
    amount_label: formatRupiah(amount),
    test_mode: parseRupiah(process.env.MAYAR_TEST_AMOUNT) > 0,
  });
});

app.post('/api/payments/mayar/create', rateLimit, async (req, res) => {
  try {
    if (!mayarConfig().enabled) return res.status(503).json({ error: 'Pembayaran Mayar belum aktif.' });
    const payer_name = String(req.body?.payer_name || '').trim();
    if (!payer_name || payer_name.length > 100) {
      return res.status(400).json({ error: 'Nama pengirim wajib diisi.' });
    }
    const settings = getAllSettings();
    const amount = chargeAmount(settings);
    const token = crypto.randomUUID();
    const expiredAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const created = await mayarFetch('/invoices/create', {
      method: 'POST',
      body: {
        name: payer_name,
        email: 'tamu-' + token.slice(0, 8) + '@undangan.local',
        mobile: '080000000000',
        description: 'Tanda kasih ' + (settings.couple_names || 'undangan'),
        expiredAt,
        items: [{ quantity: 1, rate: amount, description: 'Tanda kasih ucapan digital' }],
        extraData: { access_token: token },
      },
    });
    const invoice = created.data || {};
    const link = String(invoice.link || invoice.paymentUrl || '');
    if (!invoice.id || !link) return res.status(502).json({ error: 'Mayar tidak mengembalikan link pembayaran.' });
    insertPayment({
      payer_name,
      amount: formatRupiah(amount),
      bank_target: 'Mayar',
      proof_image_path: null,
      access_token: token,
      note: 'mayar',
      mayar_invoice_id: invoice.id,
      mayar_transaction_id: invoice.transactionId || '',
      mayar_link: link,
    });
    res.status(201).json({ ok: true, token, link, amount: formatRupiah(amount) });
  } catch (err) {
    console.error('Mayar create error:', err.message);
    res.status(502).json({ error: 'Gagal membuat pembayaran. Coba lagi.' });
  }
});

app.post('/api/mayar/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const event = String(body.event || '').toLowerCase();
    const invoiceId = pickInvoiceId(body);
    if (!invoiceId) return res.json({ ok: true, ignored: true });
    if (event && event !== 'payment.received') return res.json({ ok: true, ignored: true });
    const paid = await confirmMayarPaid(invoiceId);
    if (!paid) return res.json({ ok: true, pending: true });
    const row = getPaymentByMayarInvoice(invoiceId);
    if (row && row.status !== 'approved') {
      setPaymentStatus(row.id, 'approved', 'mayar');
      notifyMayarPaid(row);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Mayar webhook error:', err.message);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/payments/status/:token', async (req, res) => {
  const token = String(req.params.token || '');
  if (!token) return res.status(400).json({ error: 'Token diperlukan.' });
  const row = getPaymentByToken(token);
  if (!row) return res.status(404).json({ error: 'Data pembayaran tidak ditemukan.' });
  if (row.status === 'pending' && row.mayar_invoice_id && mayarConfig().enabled) {
    try {
      const paid = await confirmMayarPaid(row.mayar_invoice_id);
      if (paid && row.status !== 'approved') {
        setPaymentStatus(row.id, 'approved', 'mayar');
        notifyMayarPaid(row);
      }
    } catch (err) {
      console.warn('Cek status Mayar gagal:', err.message);
    }
  }
  const fresh = getPaymentByToken(token) || row;
  res.json({
    status: fresh.status,
    payer_name: fresh.payer_name,
    amount: fresh.amount,
    link: fresh.mayar_link || '',
    created_at: fresh.created_at,
    reviewed_at: fresh.reviewed_at,
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
    notifyTelegram({
      title: 'Ucapan baru',
      message: `ID: #${id}\nNama: <b>${escHtml(sender_name)}</b>\nBingkai: ${escHtml(frame_id)}\n\n${escHtml(String(message).trim().slice(0, 500))}`,
      photoPath: req.file?.path,
      buttons: [[
        { text: 'Setujui', callback_data: `ok:greet:${id}` },
        { text: 'Tolak', callback_data: `no:greet:${id}` },
      ]],
    }).catch(() => {});
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
  setInterval(() => { pollTelegram().catch((err) => console.warn('Telegram poll:', err.message)); }, 4000);
});

// Shutdown rapi saat Coolify restart/redeploy container
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { db.close(); } catch {}
    process.exit(0);
  });
}

