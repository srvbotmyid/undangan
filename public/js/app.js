// Kartu ucapan: pilih bingkai, overlay teks, kirim.
const FRAMES = {
  frame1: { src: '/frames/frame1.png', label: 'Emas Elegan', box: { x: 0.18, y: 0.46, w: 0.64, h: 0.20 }, nameY: 0.85, ink: '#4a3310', zoom: 1.28 },
  frame2: { src: '/frames/frame2.png', label: 'Floral Sage', box: { x: 0.24, y: 0.34, w: 0.52, h: 0.26 }, nameY: 0.875, ink: '#6b5433' },
  frame3: { src: '/frames/frame3.png', label: 'Putih Minimalis', box: { x: 0.22, y: 0.33, w: 0.56, h: 0.36 }, nameY: 0.84, ink: '#8a6d2e' },
  frame4: { src: '/frames/frame4.png', label: 'Blush Romantis', box: { x: 0.27, y: 0.36, w: 0.46, h: 0.22 }, nameY: 0.76, ink: '#6b5433' },
  frame5: { src: '/frames/frame5.png', label: 'Royal Maroon', box: { x: 0.20, y: 0.32, w: 0.60, h: 0.39 }, nameY: 0.845, ink: '#7a5f22' },
  frame6: { src: '/frames/frame6.png', label: 'Anggrek Pink', box: { x: 0.24, y: 0.40, w: 0.52, h: 0.25 }, nameY: 0.81, ink: '#8a1c4f' },
  frame7: { src: '/frames/frame7.png', label: 'Lily Putih', box: { x: 0.22, y: 0.38, w: 0.56, h: 0.36 }, nameY: 0.875, ink: '#8a1c4f' },
  frame8: { src: '/frames/frame8.png', label: 'Tulip Pink', box: { x: 0.24, y: 0.44, w: 0.52, h: 0.30 }, nameY: 0.875, ink: '#5a5a3a' },
  frame9: { src: '/frames/frame9.png', label: 'Satin Lily', box: { x: 0.10, y: 0.30, w: 0.55, h: 0.40 }, nameY: 0.80, ink: '#6b3a2a' },
  frame10: { src: '/frames/frame10.png', label: 'Marble Rose', box: { x: 0.38, y: 0.25, w: 0.54, h: 0.48 }, nameY: 0.82, ink: '#6b5433' }
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

  const nameFs = Math.max(Math.round(W * 0.028), Math.round(fs * 0.95));
  ctx.font = fontSpec(nameFs, true);
  ctx.lineWidth = Math.max(2, Math.round(nameFs / 12));
  const rawName = (state.name || 'Nama Pengirim').slice(0, 100);
  const nameText = rawName;
  const ny = (cfg.nameY || 0.8) * H;
  ctx.strokeText(nameText, W / 2, ny);
  ctx.fillText(nameText, W / 2, ny);
  const fromFs = Math.max(12, Math.round(nameFs * 0.32));
  ctx.font = '500 ' + fromFs + 'px "Jost", sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeText('Dari', W / 2, ny - nameFs * 1.15);
  ctx.fillText('Dari', W / 2, ny - nameFs * 1.15);

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
