# Deploy ke Coolify — Repo Private `srvbotmyid/undangan`

Aplikasi: Node 24 + Express, port **3000**, healthcheck `GET /healthz`.

## 1. Hubungkan GitHub Private ke Coolify (pilih SALAH SATU)

### Opsi A — GitHub App (paling rapi, disarankan)
1. Coolify Dashboard → **Sources → GitHub → Add / Configure**.
2. Klik **Install / Authorize GitHub App**, login sebagai `srvbotmyid`.
3. Saat diminta akses repo, pilih **Only select repositories → `srvbotmyid/undangan`**.
4. Kembali ke Coolify, Source GitHub sudah hijau/connected.

### Opsi B — Deploy Key SSH (cepat, tanpa GitHub App)
1. Di Coolify → **Keys & Tokens → Private Keys → Generate** (ED25519).
   - Copy **public key** (`ssh-ed25519 AAAA...`).
2. Buka GitHub → repo `srvbotmyid/undangan` → **Settings → Deploy keys → Add deploy key**.
   - Title: `coolify-vps`
   - Key: paste public key tadi
   - ✅ **Allow write access JANGAN dicentang** (read-only cukup)
   - Add key.
3. Di Coolify saat buat Application pilih **Private Repository (SSH)** dan pilih key tadi.

### Opsi C — Personal Access Token (kalau A/B gagal)
1. GitHub → Settings → Developer settings → **Personal access tokens → Tokens (classic)** → Generate.
   - Scope: centang **`repo`** saja, expire 30–90 hari.
2. Di Coolify → tambah Source/Token GitHub, paste token `ghp_...`.

## 2. Buat Application di Coolify

1. Coolify → **Projects → <project> → Environment `production` → + Add → Application**.
2. Source: **GitHub Private → `srvbotmyid/undangan`**, Branch: **`main`**.
3. Isi:
   - **Build Pack:** `Dockerfile`
   - **Dockerfile Location:** `/Dockerfile`
   - **Port:** `3000`
   - **Domains:** `https://undangan.domain-kamu.id` (ganti dengan subdomain kamu)
4. Tab **Env / Environment Variables**, isi:
   ```
   PORT=3000
   NODE_ENV=production
   ADMIN_PASSWORD=ganti-min-16-karakter-acak
   PUBLIC_BASE_URL=https://undangan.domain-kamu.id
   DB_PATH=./data/guestbook.sqlite
   ```
5. Tab **Storages / Persistent Storage — WAJIB** (tanpa ini DB + foto hilang tiap redeploy):
   - Volume 1 → Source/persistent name: `data-undangan`, Destination: `/app/data`
   - Volume 2 → Source/persistent name: `cards-undangan`, Destination: `/app/uploads/cards`
6. Tab **Health Check**:
   - Path: `/healthz`, Port: `3000`
7. Klik **Deploy**.

Cek sukses:
- `/healthz` → `{"ok":true}`
- `/` form muncul, `/admin` bisa login, `/galeri` tampil.

## 3. Subdomain Cloudflare → VPS Coolify

1. Cloudflare → domain → **DNS → Records → Add**:
   - Type `A`, Name `undangan`, IPv4 = **IP publik VPS Coolify**, TTL Auto, Proxy **DNS only (abu-abu)** dulu.
2. Di Coolify Domains pastikan `https://undangan.domain-kamu.id` dan tunggu sertifikat **Valid** (Let's Encrypt).
3. Kalau mau CDN/WAF, ubah ke **Proxied (oranye)** + `SSL/TLS → Full (strict)`.
4. Bypass cache API: `Caching → Cache Rules → Bypass` untuk `undangan.domain-kamu.id/api/*` dan `/uploads/*`.

## 4. Update berikutnya

```powershell
cd d:\undangan
git add -A; git commit -m "update"; git push
```
Lalu di Coolify klik **Redeploy** (atau aktifkan Auto-deploy on push).

## Troubleshooting

| Gejala | Sebab / Solusi |
|---|---|
| `repository not found` saat connect | Belum login sebagai `srvbotmyid` / token tanpa scope `repo` / Deploy Key belum dipasang |
| `502 / unhealthy` | Cek Logs: pastikan volume `/app/data` terpasang & port 3000 |
| Data hilang tiap redeploy | Volume persistent belum dipasang |
| `429 Too many requests` | Wajar (rate-limit 30/menit/IP). Sudah `trust proxy`, aman di belakang Cloudflare |
| Sertifikat invalid | Pertama deploy pakai DNS-only, jangan langsung Proxied |
