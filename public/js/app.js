// Kartu ucapan: pilih bingkai, overlay teks, kirim.
// box = area ucapan (di bawah nama mempelai, di atas label "Dari:").
// nameX/nameY = nama pengirim, tepat di bawah "Dari:".
const FRAMES = {
  frame1: { src: '/frames/frame1.png', label: 'Emas Floral', box: { x: 0.18, y: 0.36, w: 0.64, h: 0.36 }, nameX: 0.50, nameY: 0.875, ink: '#8a7348' },
  frame2: { src: '/frames/frame2.png', label: 'Mawar Putih', box: { x: 0.24, y: 0.34, w: 0.52, h: 0.32 }, nameX: 0.50, nameY: 0.815, ink: '#8a7348' },
  frame3: { src: '/frames/frame3.png', label: 'Lily Putih', box: { x: 0.20, y: 0.34, w: 0.60, h: 0.33 }, nameX: 0.50, nameY: 0.835, ink: '#2f6b45' },
  frame4: { src: '/frames/frame4.png', label: 'Blush Mawar', box: { x: 0.22, y: 0.36, w: 0.56, h: 0.36 }, nameX: 0.50, nameY: 0.875, ink: '#a68455' },
  frame5: { src: '/frames/frame5.png', label: 'Emas Barok', box: { x: 0.16, y: 0.30, w: 0.68, h: 0.40 }, nameX: 0.50, nameY: 0.855, ink: '#a68455' },
  frame6: { src: '/frames/frame6.png', label: 'Satin Lily', box: { x: 0.05, y: 0.28, w: 0.42, h: 0.40 }, nameX: 0.10, nameY: 0.90, nameAlign: 'left', nameMaxW: 0.40, ink: '#8a4a55' },
  frame7: { src: '/frames/frame7.png', label: 'Tulip Pink', box: { x: 0.20, y: 0.34, w: 0.60, h: 0.30 }, nameX: 0.50, nameY: 0.80, ink: '#7a2a55' },
  frame8: { src: '/frames/frame8.png', label: 'Marble Rose', box: { x: 0.46, y: 0.26, w: 0.46, h: 0.34 }, nameX: 0.62, nameY: 0.90, ink: '#7a2a55' },
  frame9: { src: '/frames/frame9.png', label: 'Kartu Kayu', box: { x: 0.30, y: 0.28, w: 0.40, h: 0.24 }, nameX: 0.50, nameY: 0.785, ink: '#a68455' },
  frame10: { src: '/frames/frame10.png', label: 'Anggrek Pink', box: { x: 0.22, y: 0.32, w: 0.56, h: 0.26 }, nameX: 0.50, nameY: 0.835, ink: '#7a2a55' }
};

const state = { frameId: 'frame1', fontId: 'cormorant', message: '', name: '', guestToken: '', giftProof: '', payToken: '' };

const FONTS = {
  cormorant: { label: 'Elegan', family: '"Cormorant Garamond", Georgia, serif', style: 'italic 600' },
  vibes: { label: 'Script', family: '"Great Vibes", cursive', style: '400' },
  dancing: { label: 'Tulisan Tangan', family: '"Dancing Script", cursive', style: '600' },
  playfair: { label: 'Klasik', family: '"Playfair Display", Georgia, serif', style: 'italic 500' },
  merriweather: { label: 'Serif', family: '"Merriweather", Georgia, serif', style: 'italic 400' },
  jost: { label: 'Modern', family: '"Jost", sans-serif', style: '500' },
};
const imageCache = {};
const $ = (id) => document.getElementById(id);

(function personalize() {
  const q = new URLSearchParams(location.search);
  const to = (q.get('to') || '').trim();
  if (to) {
    const guest = $('guestName');
    const inner = $('guestNameInner');
    if (guest) guest.textContent = to;
    if (inner) inner.textContent = to;
    const nameInput = $('inpName');
    if (nameInput && !nameInput.value) {
      nameInput.value = to;
      state.name = to;
    }
  }
  state.guestToken = (q.get('token') || '').slice(0, 50);
})();

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = btn.getAttribute('data-copy');
    const text = document.getElementById(id)?.textContent?.trim() || '';
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Tersalin';
      setTimeout(() => (btn.textContent = 'Salin'), 1500);
    } catch (e) { prompt('Salin nomor ini:', text); }
  });
});

const PAY_KEY = 'pay_access_token';
let pollTimer = null;

function readPayToken() {
  try { return sessionStorage.getItem(PAY_KEY) || ''; } catch { return ''; }
}
function savePayToken(token) {
  state.payToken = token;
  try { sessionStorage.setItem(PAY_KEY, token); } catch {}
}
function isGiftUnlocked() {
  return state.giftProof === 'approved';
}
function applyGiftLock() {
  const form = $('form');
  const open = isGiftUnlocked();
  if (form) form.classList.toggle('hide-lock', open);
  const hint = $('lockHint');
  if (hint && !open) {
    hint.textContent = state.payToken
      ? 'Bukti sudah dikirim. Menunggu persetujuan admin.'
      : 'Unggah bukti transfer dan tunggu persetujuan admin.';
  }
}
function unlockGift() {
  state.giftProof = 'approved';
  applyGiftLock();
  const form = $('form');
  const wait = $('payWait');
  if (wait) {
    wait.style.display = 'block';
    wait.textContent = 'Pembayaran disetujui. Silakan tulis ucapan di bawah.';
  }
  if (form) setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
}
function payNotice(msg, type) {
  const el = $('payNotice');
  if (!el) return;
  el.className = 'notice ' + (type || 'ok');
  el.textContent = msg;
}
async function pollPayment() {
  if (!state.payToken || isGiftUnlocked()) return;
  try {
    const res = await fetch('/api/payments/status/' + encodeURIComponent(state.payToken));
    const data = await res.json();
    if (!res.ok) return;
    const wait = $('payWait');
    if (data.status === 'approved') {
      if (pollTimer) clearInterval(pollTimer);
      unlockGift();
      return;
    }
    if (wait) {
      wait.style.display = 'block';
      wait.className = 'notice ' + (data.status === 'rejected' ? 'err' : 'ok');
      wait.textContent = data.status === 'rejected'
        ? 'Bukti ditolak. Unggah ulang bukti transfer yang jelas.'
        : 'Menunggu verifikasi admin. Halaman ini akan terbuka otomatis.';
    }
  } catch { /* coba lagi di tick berikutnya */ }
}
$('payForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('btnPaySubmit');
  const name = $('payerName')?.value?.trim() || '';
  const file = $('proofFile')?.files?.[0];
  if (!name) { payNotice('Nama pengirim wajib diisi.', 'err'); return; }
  if (!file) { payNotice('Foto bukti transfer wajib diunggah.', 'err'); return; }
  try {
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    const fd = new FormData();
    fd.append('payer_name', name);
    fd.append('bank_target', $('bankTarget')?.value || '');
    fd.append('proof', file);
    const res = await fetch('/api/payments/submit', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengirim bukti.');
    savePayToken(data.token);
    payNotice('Bukti terkirim. Menunggu persetujuan admin.', 'ok');
    applyGiftLock();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollPayment, 4000);
    pollPayment();
  } catch (err) {
    payNotice(err.message || 'Gagal mengirim bukti.', 'err');
  }
  btn.disabled = false;
  btn.textContent = 'Kirim Bukti';
});

async function loadPublicSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();
    const set = (id, val) => { const el = $(id); if (el && val) el.textContent = val; };
    set('coverNames', s.couple_names);
    set('heroNames', s.couple_names);
    set('footNames', s.couple_names);
    set('priceAmount', s.price_amount);
    if (s.bank1_name) {
      const label = $('bank1Label');
      if (label) label.textContent = (s.bank1_bank || 'BCA') + ' · a.n. ' + s.bank1_name;
      set('rek1', s.bank1_number);
      const opt = $('bankTarget')?.options?.[0];
      if (opt) { opt.value = (s.bank1_bank || 'BCA') + ' ' + s.bank1_name; opt.textContent = (s.bank1_bank || 'BCA') + ' · ' + s.bank1_name; }
    }
    if (s.bank2_name) {
      const label = $('bank2Label');
      if (label) label.textContent = (s.bank2_bank || 'BCA') + ' · a.n. ' + s.bank2_name;
      set('rek2', s.bank2_number);
      const opt = $('bankTarget')?.options?.[1];
      if (opt) { opt.value = (s.bank2_bank || 'BCA') + ' ' + s.bank2_name; opt.textContent = (s.bank2_bank || 'BCA') + ' · ' + s.bank2_name; }
    }
    if (s.qris_image_path) {
      const img = $('qrisImg');
      if (img) { img.src = s.qris_image_path; img.style.display = 'block'; }
    }
    document.title = s.cover_title || s.couple_names || document.title;
  } catch { /* pakai teks default di HTML */ }
}

state.payToken = readPayToken();
applyGiftLock();
loadPublicSettings();
if (state.payToken) {
  pollTimer = setInterval(pollPayment, 4000);
  pollPayment();
}

(function renderPicker() {
  const grid = $('frameGrid');
  grid.innerHTML = '';
  Object.entries(FRAMES).forEach(([id, cfg]) => {
    const label = document.createElement('label');
    label.className = 'frame-item';
    const checked = id === state.frameId ? 'checked' : '';
    label.innerHTML =
      '<input type="radio" name="frame" value="' + id + '" ' + checked + '>' +
      '<img src="/frames/thumbs/' + id + '.jpg" alt="' + cfg.label + '" loading="lazy">' +
      '<span>' + cfg.label + '</span>';
    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      state.frameId = id;
      renderCard().catch((e) => notice('Gagal render: ' + e.message, 'err'));
    });
    label.addEventListener('click', () => {
      state.frameId = id;
      renderCard().catch(() => {});
    });
    grid.appendChild(label);
  });
})();

let t = null;
$('inpMessage').addEventListener('input', (e) => {
  state.message = e.target.value;
  $('charCount').textContent = String(state.message.length);
  clearTimeout(t);
  t = setTimeout(() => renderCard().catch(() => {}), 180);
});
$('inpName').addEventListener('input', (e) => {
  state.name = e.target.value;
  clearTimeout(t);
  t = setTimeout(() => renderCard().catch(() => {}), 180);
});

(function renderFontPicker() {
  const grid = $('fontGrid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.entries(FONTS).forEach(([id, cfg]) => {
    const label = document.createElement('label');
    label.className = 'font-item';
    const checked = id === state.fontId ? 'checked' : '';
    label.innerHTML =
      '<input type="radio" name="wishFont" value="' + id + '" ' + checked + '>' +
      '<span class="font-swatch font-' + id + '">Aa</span>' +
      '<small>' + cfg.label + '</small>';
    label.querySelector('input').addEventListener('change', () => {
      state.fontId = id;
      $('inpMessage').className = 'font-' + id;
      renderCard().catch(() => {});
    });
    grid.appendChild(label);
  });
  $('inpMessage').className = 'font-' + state.fontId;
})();

function loadImage(src) {
  if (imageCache[src]) return Promise.resolve(imageCache[src]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache[src] = img; resolve(img); };
    img.onerror = () => reject(new Error('gagal load ' + src));
    img.src = src;
  });
}

function wrapText(ctx, text, maxW) {
  const paragraphs = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const trial = line ? line + ' ' + w : w;
      if (ctx.measureText(trial).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function fontSpec(px, forName) {
  const cfg = FONTS[state.fontId] || FONTS.cormorant;
  const style = forName ? (cfg.style.includes('italic') ? 'italic 700' : '700') : cfg.style;
  return style + ' ' + px + 'px ' + cfg.family;
}

async function ensureFont(px) {
  if (!document.fonts || !document.fonts.load) return;
  const spec = fontSpec(px || 32);
  try { await document.fonts.load(spec); } catch { /* fallback sistem */ }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderCard(exportWidth) {
  const W = exportWidth || 1280;
  const H = Math.round((W * 9) / 16);
  const cfg = FRAMES[state.frameId];
  await ensureFont(48);
  const img = await loadImage(cfg.src);
  const canvas = $('cardCanvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const zoom = cfg.zoom || 1;
  if (zoom > 1) {
    const sw = img.naturalWidth / zoom;
    const sh = img.naturalHeight / zoom;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  } else {
    ctx.drawImage(img, 0, 0, W, H);
  }

  const box = cfg.box;
  const bx = box.x * W, by = box.y * H;
  const bw = box.w * W, bh = box.h * H;

  ctx.textAlign = 'center';
  ctx.fillStyle = cfg.ink || '#3a2b1a';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  let fs = Math.round(Math.min(W * 0.028, bh * 0.28));
  const minFs = Math.round(W * 0.014);
  const setF = (px) => { ctx.font = fontSpec(px); };
  setF(fs);
  const msg = state.message || 'Tulis ucapan di sini';
  let lines = wrapText(ctx, msg, bw - 24);
  let guard = 0;
  while (lines.length * fs * 1.45 > bh && fs > minFs && guard < 40) {
    guard += 1;
    fs -= 2;
    setF(fs);
    lines = wrapText(ctx, msg, bw - 24);
  }
  const maxLines = Math.max(1, Math.floor(bh / (fs * 1.45)));
  const shown = lines.slice(0, maxLines);
  const totalH = shown.length * fs * 1.45;
  let y = by + (bh - totalH) / 2 + fs * 0.95;
  ctx.lineWidth = Math.max(2, Math.round(fs / 10));
  for (const l of shown) {
    ctx.strokeText(l, bx + bw / 2, y);
    ctx.fillText(l, bx + bw / 2, y);
    y += fs * 1.45;
  }

  const nameFs = Math.round(W * 0.038);
  ctx.font = fontSpec(nameFs, true);
  ctx.lineWidth = Math.max(2, Math.round(nameFs / 12));
  const rawName = (state.name || 'Nama Pengirim').slice(0, 40);
  const nameAlign = cfg.nameAlign || 'center';
  ctx.textAlign = nameAlign;
  let nx = (cfg.nameX || 0.5) * W;
  const ny = (cfg.nameY || 0.8) * H;
  const nameMax = (cfg.nameMaxW || (nameAlign === 'left' ? 0.34 : 0.55)) * W;
  let nameText = rawName;
  while (nameText.length > 1 && ctx.measureText(nameText).width > nameMax) {
    nameText = nameText.slice(0, -1);
  }
  if (nameText !== rawName) nameText = nameText.replace(/\s+\S*$/, '') + '…';
  if (nameAlign === 'left') nx = Math.max(nx, 16);
  ctx.strokeText(nameText, nx, ny);
  ctx.fillText(nameText, nx, ny);
  ctx.textAlign = 'center';

  $('btnDownload').href = canvas.toDataURL('image/png');
  return canvas;
}

function notice(msg, type) {
  const el = $('notice');
  el.className = 'notice ' + (type || 'ok');
  el.textContent = msg;
}

$('btnPreview').addEventListener('click', () => {
  renderCard().catch((e) => notice('Gagal memuat gambar frame: ' + e.message, 'err'));
});


(function cover() {
  const el = $('cover');
  const btn = $('btnOpen');
  if (!el || !btn) return;
  document.body.classList.add('cover-on');
  const open = () => {
    el.classList.add('is-open');
    document.body.classList.remove('cover-on');
  };
  btn.addEventListener('click', open);
})();

function formatWishTime(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function loadWishes() {
  const box = $('wishList');
  if (!box) return;
  try {
    const res = await fetch('/api/greetings?page=1&limit=24');
    const data = await res.json();
    const rows = data.rows || [];
    if (!rows.length) {
      box.innerHTML = '<p class="wish-empty">Belum ada ucapan. Jadilah yang pertama.</p>';
      return;
    }
    box.innerHTML = rows.map((g) => {
      const name = escapeHtml(g.sender_name);
      const msg = escapeHtml(g.message).replace(/\n/g, '<br>');
      const when = escapeHtml(formatWishTime(g.created_at));
      const fontClass = 'font-' + (g.font_id && FONTS[g.font_id] ? g.font_id : 'cormorant');
      return '<article class="wish-item"><div class="wish-name">' + name + '</div>' +
        '<time>' + when + '</time><p class="' + fontClass + '">' + msg + '</p></article>';
    }).join('');
  } catch {
    box.innerHTML = '<p class="wish-empty">Ucapan belum bisa dimuat.</p>';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>\"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

loadWishes();

$('btnSubmit').addEventListener('click', async () => {
  const btn = $('btnSubmit');
  try {
    if (!isGiftUnlocked()) { notice('Kartu masih terkunci. Tunggu persetujuan pembayaran.', 'err'); document.getElementById('giftGate')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (!state.message.trim()) { notice('Ucapan wajib diisi.', 'err'); return; }
    if (!state.name.trim()) { notice('Nama pengirim wajib diisi.', 'err'); return; }
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    await renderCard(1600);
    const blob = await new Promise((r) => $('cardCanvas').toBlob(r, 'image/png'));
    await renderCard(1280);
    const fd = new FormData();
    fd.append('sender_name', state.message ? state.name.trim() : '');
    fd.append('message', state.message.trim());
    fd.append('frame_id', state.frameId);
    fd.append('font_id', state.fontId);
    fd.append('gift_proof', state.giftProof || (isGiftUnlocked() ? 'unlocked' : ''));
    if (state.guestToken) fd.append('guest_token', state.guestToken);
    fd.append('card', blob, 'kartu-ucapan.png');
    const res = await fetch('/api/greetings', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
    const box = $('successBox');
    box.style.display = 'block';
    let html = 'Ucapan terkirim (#' + json.id + '). Menunggu persetujuan. ';
    if (json.card_url) html += '<a href="' + json.card_url + '" target="_blank">Lihat kartu</a> · ';
    html += '<a href="/galeri">Galeri</a>';
    box.innerHTML = html;
    notice('Ucapan masuk. Belum tampil di galeri sampai disetujui.', 'ok');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    loadWishes();
  } catch (e) {
    notice(e.message || 'Gagal mengirim.', 'err');
  }
  btn.disabled = false;
  btn.textContent = 'Kirim Ucapan';
});

renderCard().catch((e) => console.error(e));
