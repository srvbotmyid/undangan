let token = sessionStorage.getItem('admin_token') || '';
let tab = 'pending';
let page = 1;
let totalPages = 1;

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function showDash(show) {
  $('loginCard').style.display = show ? 'none' : '';
  $('dashCard').style.display = show ? '' : 'none';
}

async function login() {
  const pass = $('inpPass').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pass }),
  });
  const data = await res.json();
  if (!res.ok) {
    const n = $('loginNotice');
    n.className = 'notice err';
    n.textContent = data.error || 'Gagal login.';
    return;
  }
  token = data.token;
  sessionStorage.setItem('admin_token', token);
  showDash(true);
  refresh();
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), 'x-admin-token': token, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) {
    token = '';
    sessionStorage.removeItem('admin_token');
    showDash(false);
    throw new Error('Sesi habis, silakan login lagi.');
  }
  return res;
}

async function refresh() {
  page = 1;
  $('rows').innerHTML = '';
  await loadStats();
  await loadRows();
}

async function loadStats() {
  try {
    const res = await api('/api/admin/stats');
    const s = await res.json();
    $('stats').innerHTML =
      `<span class="badge pending">${s.pending} pending</span> ` +
      `<span class="badge approved">${s.approved} approved</span> ` +
      `<span class="badge rejected">${s.rejected} rejected</span>`;
  } catch {}
}

async function loadRows() {
  const res = await api(`/api/admin/greetings?status=${tab}&page=${page}&limit=20`);
  const data = await res.json();
  totalPages = data.totalPages || 1;
  const tb = $('rows');
  for (const g of data.rows) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>#${g.id}<br/><small>${esc(g.created_at || '')}</small></td>` +
      `<td><b>${esc(g.sender_name)}</b><br/><small>${esc(g.message)}</small><br/>` +
      `<span class="badge ${g.status}">${g.status}</span></td>` +
      `<td>${esc(g.frame_id)}</td>` +
      `<td>${g.card_image_path ? `<a href="${g.card_image_path}" target="_blank">Lihat</a>` : '-'}</td>` +
      `<td style="white-space:nowrap"></td>`;
    const act = tr.lastElementChild;
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'btn btn-small ' + cls;
      b.textContent = label;
      b.style.marginRight = '6px';
      b.addEventListener('click', () => fn(g.id));
      act.appendChild(b);
    };
    if (tab !== 'approved') mk('Setujui', 'btn-success', approve);
    if (tab !== 'rejected') mk('Tolak', '', reject);
    mk('Edit', '', (id) => openEdit(data.rows.find((x) => x.id === id)));
    mk('Hapus', 'btn-danger', remove);
    tb.appendChild(tr);
  }
  $('btnMoreAdmin').style.display = page < totalPages ? '' : 'none';
}

async function approve(id) {
  await api(`/api/admin/greetings/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
  refresh();
}

async function reject(id) {
  await api(`/api/admin/greetings/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
  refresh();
}

async function remove(id) {
  if (!confirm(`Hapus ucapan #${id}?`)) return;
  await api(`/api/admin/greetings/${id}`, { method: 'DELETE' });
  refresh();
}

let editingId = null;

function editNotice(msg, type) {
  const el = $('editNotice');
  el.className = 'notice ' + (type || 'ok');
  el.textContent = msg;
}

function openEdit(g) {
  if (!g) return;
  editingId = g.id;
  $('editId').textContent = '#' + g.id;
  $('editName').value = g.sender_name || '';
  $('editMessage').value = g.message || '';
  $('editCount').textContent = String(($('editMessage').value || '').length);
  $('editFrame').value = g.frame_id || '';
  $('editNotice').className = 'notice';
  $('editNotice').textContent = '';
  $('editCard').style.display = '';
  $('editCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeEdit() {
  editingId = null;
  $('editCard').style.display = 'none';
}

async function saveEdit() {
  if (!editingId) return;
  const btn = $('btnEditSave');
  try {
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    const res = await api(`/api/admin/greetings/${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sender_name: $('editName').value,
        message: $('editMessage').value,
        frame_id: $('editFrame').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
    editNotice('Perubahan tersimpan.', 'ok');
    closeEdit();
    refresh();
  } catch (e) {
    editNotice(e.message || 'Gagal menyimpan.', 'err');
  }
  btn.disabled = false;
  btn.textContent = 'Simpan Perubahan';
}

document.querySelectorAll('[data-tab]').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    tab = b.getAttribute('data-tab');
    refresh();
  });
});

$('btnLogin').addEventListener('click', login);
$('inpPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
$('btnMoreAdmin').addEventListener('click', () => { if (page < totalPages) { page += 1; loadRows(); } });
$('btnEditSave').addEventListener('click', saveEdit);
$('btnEditCancel').addEventListener('click', closeEdit);
$('editMessage').addEventListener('input', (e) => { $('editCount').textContent = String(e.target.value.length); });
$('btnLogout').addEventListener('click', () => {
  token = '';
  sessionStorage.removeItem('admin_token');
  showDash(false);
});

if (token) { showDash(true); refresh().catch(() => showDash(false)); }
