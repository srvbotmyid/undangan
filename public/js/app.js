// Logika utama: personalisasi ?to=, picker frame, canvas overlay, submit.
// BOX per-frame dikalibrasi dari visual full-res (koordinat relatif 0-1).
// - frame1: judul 0.28-0.33 + logo N&I 0.37-0.49, [Dari] di ~0.72 → pesan 0.48-0.65, nama di 0.795, zoom 1.25 agar kotak lebih besar
// - frame2: Dari: ~0.79-0.80 → pesan 0.34-0.60, nama di 0.875 (di bawah Dari:)
// - frame4: Dari: ~0.68 → pesan 0.36-0.58, nama di 0.76
const FRAMES = {
  frame1: { src: '/frames/frame1.png', label: 'Emas Elegan', box: { x: 0.18, y: 0.46, w: 0.64, h: 0.20 }, nameY: 0.85, ink: '#4a3310', zoom: 1.28 },
  frame2: { src: '/frames/frame2.png', label: 'Floral Sage', box: { x: 0.24, y: 0.34, w: 0.52, h: 0.26 }, nameY: 0.875, ink: '#6b5433' },
  frame3: { src: '/frames/frame3.png', label: 'Putih Minimalis', box: { x: 0.22, y: 0.33, w: 0.56, h: 0.36 }, nameY: 0.84, ink: '#8a6d2e' },
  frame4: { src: '/frames/frame4.png', label: 'Blush Romantis', box: { x: 0.27, y: 0.36, w: 0.46, h: 0.22 }, nameY: 0.76, ink: '#6b5433' },
  frame5: { src: '/frames/frame5.png', label: 'Royal Maroon', box: { x: 0.20, y: 0.32, w: 0.60, h: 0.39 }, nameY: 0.845, ink: '#7a5f22' }
};

const state = { frameId: 'frame1', message: '', name: '', guestToken: '', giftProof: '' };
const imageCache = {};
const $ = (id) => document.getElementById(id);

(function personalize() {
  const q = new URLSearchParams(location.search);
  const to = (q.get('to') || '').trim();
  if (to) $('guestName').textContent = to;
  state.guestToken = (q.get('token') || '').slice(0, 50);
})();

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = btn.getAttribute('data-copy');
    const text = document.getElementById(id)?.textContent?.trim() || '';
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Tersalin OK';
      setTimeout(() => (btn.textContent = 'Salin'), 1500);
    } catch (e) { prompt('Salin manual nomor ini:', text); }
    // Syarat terpenuhi: sudah copy amplop → buka akses kartu ucapan.
    unlockGift('copy:' + id);
  });
});

// GATE: amplop dulu, baru kartu ucapan. Kunci disimpan di localStorage
// agar tetap terbuka walau halaman di-refresh / kembali dari /gift.
const GIFT_KEY = 'gift_unlocked';
function isGiftUnlocked() {
  try { return localStorage.getItem(GIFT_KEY) === '1'; } catch { return false; }
}
function applyGiftLock() {
  const form = $('form');
  const status = $('giftStatus');
  const open = isGiftUnlocked();
  if (form) form.classList.toggle('hide-lock', open);
  if (status) {
    if (open) {
      status.style.display = 'block';
      status.textContent = 'Terima kasih sudah berbagi kebahagiaan 🙏 Akses Kartu Ucapan sudah terbuka — silakan isi di bawah.';
    } else {
      status.style.display = 'none';
    }
  }
}
function unlockGift(source) {
  try { localStorage.setItem(GIFT_KEY, '1'); } catch {}
  // Tandai asal (copy / tombol / halaman gift) untuk audit ringan di server.
  state.giftProof = (source || 'manual').slice(0, 50);
  applyGiftLock();
  const form = $('form');
  if (form && !form.classList.contains('scrolled-once')) {
    form.classList.add('scrolled-once');
    setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
}
$('btnGiftDone')?.addEventListener('click', () => unlockGift('button'));
applyGiftLock();

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
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? line + ' ' + w : w;
    if (ctx.measureText(trial).width > maxW && line) { lines.push(line); line = w; }
    else { line = trial; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
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

  // Kotak teks per-frame (sudah dikalibrasi agar tidak menabrak
  // judul "NARA & ILYAS" di atas dan "Dari:" bawaan gambar di bawah).
  // Sengaja TANPA panel kaca agar motif bunga/emas tetap terlihat.
  const box = cfg.box;
  const bx = box.x * W, by = box.y * H;
  const bw = box.w * W, bh = box.h * H;

  ctx.textAlign = 'center';
  ctx.fillStyle = cfg.ink || '#3a2b1a';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  let fs = Math.round(Math.min(W * 0.028, bh * 0.28));
  const minFs = Math.round(W * 0.014);
  const setF = (px) => { ctx.font = 'italic 600 ' + px + "px Georgia, serif"; };
  setF(fs);
  const msg = state.message || 'Tuliskan doa terbaik Anda di sini...';
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
  // Vertikal: tengah di dalam box agar selalu rapi.
  let y = by + (bh - totalH) / 2 + fs * 0.95;
  ctx.lineWidth = Math.max(2, Math.round(fs / 10));
  for (const l of shown) {
    ctx.strokeText(l, bx + bw / 2, y);
    ctx.fillText(l, bx + bw / 2, y);
    y += fs * 1.45;
  }

  // Nama pengirim: ditaruh tepat di bawah teks "Dari:" bawaan frame,
  // jadi hanya nama saja (tanpa "-- --" agar menyatu dengan desain).
  const nameFs = Math.max(Math.round(W * 0.016), Math.round(fs * 0.62));
  ctx.font = 'italic 700 ' + nameFs + 'px Georgia, serif';
  ctx.lineWidth = Math.max(2, Math.round(nameFs / 10));
  const nameText = (state.name || 'Nama Pengirim').slice(0, 100);
  const ny = (cfg.nameY || 0.8) * H;
  ctx.strokeText(nameText, W / 2, ny);
  ctx.fillText(nameText, W / 2, ny);

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

$('btnSubmit').addEventListener('click', async () => {
  const btn = $('btnSubmit');
  try {
    if (!isGiftUnlocked()) { notice('Silakan berbagi via Amplop Digital dulu (salin nomor / klik tombol di Langkah 1) untuk membuka akses kartu ucapan.', 'err'); document.getElementById('giftGate')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
    fd.append('gift_proof', state.giftProof || (isGiftUnlocked() ? 'unlocked' : ''));
    if (state.guestToken) fd.append('guest_token', state.guestToken);
    fd.append('card', blob, 'kartu-ucapan.png');
    const res = await fetch('/api/greetings', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
    const box = $('successBox');
    box.style.display = 'block';
    let html = 'Berhasil! ID #' + json.id + ' status: <b>pending</b>. ';
    if (json.card_url) html += '<a href="' + json.card_url + '" target="_blank">Lihat hasil kartu</a> - ';
    html += '<a href="/galeri">Lihat Galeri</a>';
    box.innerHTML = html;
    notice('Ucapan terkirim. Menunggu persetujuan admin.', 'ok');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    notice(e.message || 'Gagal mengirim.', 'err');
  }
  btn.disabled = false;
  btn.textContent = 'Kirim & Buat Kartu';
});

renderCard().catch((e) => console.error(e));

