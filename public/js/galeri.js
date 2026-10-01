let page = 1;
const limit = 12;
let totalPages = 1;

async function load(reset = false) {
  if (reset) { page = 1; document.getElementById('gallery').innerHTML = ''; }
  const res = await fetch(`/api/greetings?page=${page}&limit=${limit}`);
  const data = await res.json();
  totalPages = data.totalPages || 1;
  const box = document.getElementById('gallery');
  document.getElementById('empty').style.display = data.rows.length ? 'none' : 'block';
  for (const g of data.rows) {
    const div = document.createElement('div');
    div.className = 'g-item';
    const img = g.card_image_path
      ? `<button type="button" class="g-thumb" data-src="${escapeHtml(g.card_image_path)}" data-alt="Kartu ${escapeHtml(g.sender_name)}"><img src="${escapeHtml(g.card_image_path)}" alt="Kartu ${escapeHtml(g.sender_name)}" loading="lazy" /></button>`
      : '';
    const fontClass = 'font-' + (g.font_id || 'cormorant');
    const snippet = escapeHtml(g.message.slice(0, 120)) + (g.message.length > 120 ? '…' : '');
    div.innerHTML = `${img}<div class="meta"><b>${escapeHtml(g.sender_name)}</b>` +
      `<small class="${fontClass}">${snippet.replace(/\n/g, '<br>')}</small></div>`;
    box.appendChild(div);
  }
  document.getElementById('btnMore').style.display = page < totalPages ? '' : 'none';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

document.getElementById('btnMore').addEventListener('click', () => {
  if (page < totalPages) { page += 1; load(); }
});

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

function openPreview(src, alt) {
  lightboxImg.src = src;
  lightboxImg.alt = alt || 'Kartu ucapan';
  lightbox.hidden = false;
  document.body.classList.add('lightbox-open');
}

function closePreview() {
  lightbox.hidden = true;
  lightboxImg.src = '';
  document.body.classList.remove('lightbox-open');
}

document.getElementById('gallery').addEventListener('click', (e) => {
  const btn = e.target.closest('.g-thumb');
  if (!btn) return;
  openPreview(btn.dataset.src, btn.dataset.alt);
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.closest('[data-close]')) closePreview();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) closePreview();
});

load(true);
