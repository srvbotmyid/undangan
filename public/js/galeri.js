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
      ? `<img src="${g.card_image_path}" alt="Kartu ${g.sender_name}" loading="lazy" />`
      : '';
    div.innerHTML = `${img}<div class="meta"><b>${escapeHtml(g.sender_name)}</b>` +
      `<small>${escapeHtml(g.message.slice(0, 120))}${g.message.length > 120 ? '…' : ''}</small></div>`;
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

load(true);
