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

function loginNotice(msg, type) {
  const n = $('loginNotice');
  if (!msg) {
    n.className = 'notice';
    n.textContent = '';
    return;
  }
  n.className = 'notice ' + (type || 'err');
  n.textContent = msg;
}

async function login() {
  const btn = $('btnLogin');
  const pass = String($('inpPass').value || '').trim();
  if (!pass) {
    loginNotice('Isi password dulu.');
    return;
  }
  try {
    btn.disabled = true;
    loginNotice('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: pass }),
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {
      throw new Error(res.ok ? 'Server tidak merespons JSON.' : 'Login gagal (HTTP ' + res.status + ').');
    }
    if (!res.ok) {
      loginNotice(data.error || (res.status === 429 ? 'Terlalu banyak percobaan, tunggu sebentar.' : 'Gagal login.'));
      return;
    }
    token = data.token || '';
    if (token) sessionStorage.setItem('admin_token', token);
    else sessionStorage.removeItem('admin_token');
    showDash(true);
    await refresh();
  } catch (e) {
    loginNotice(e.message || 'Tidak bisa menghubungi server.');
  } finally {
    btn.disabled = false;
  }
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}), Accept: 'application/json' };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (token) {
    headers['x-admin-token'] = token;
    headers.Authorization = 'Bearer ' + token;
  }
  const res = await fetch(path, { ...opts, credentials: 'same-origin', headers });
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
      `<td><b>${esc(g.sender_name)}</b><br/><small style="white-space:pre-wrap">${esc(g.message)}</small><br/>` +
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
  $('editFont').value = g.font_id || 'cormorant';
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
        font_id: $('editFont').value,
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
$('btnLogout').addEventListener('click', async () => {
  try {
    const headers = { Accept: 'application/json' };
    if (token) {
      headers['x-admin-token'] = token;
      headers.Authorization = 'Bearer ' + token;
    }
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin', headers });
  } catch { /* tetap keluar di UI */ }
  token = '';
  sessionStorage.removeItem('admin_token');
  showDash(false);
});

(async () => {
  try {
    const res = await api('/api/admin/stats');
    if (!res.ok) throw new Error('unauth');
    showDash(true);
    await refresh();
  } catch {
    showDash(false);
  }
})();
