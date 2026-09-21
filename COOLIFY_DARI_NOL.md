# TAHAP -1 — Layar Welcome (kamu di sini sekarang)

Kamu lihat: "Welcome to Coolify" + tombol ungu Continue.
Artinya Coolify baru install, belum sambung ke server mana pun. Wajar.

SETUP KAMU (penting, sudah dikonfirmasi):
- Coolify jalan di PC lokal di sini (VPS = PC ini, tanpa IP publik).
- Kamu buka Coolify via DOMAIN (bukan localhost) → artinya domain → PC ini
  SUDAH TERSAMBUNG (via Cloudflare Tunnel / reverse proxy / NAT rumah).
- Jadi JANGAN pakai pola "VPS ada IP publik + record A". Domain kamu BUKAN
  menunjuk IP VPS, melainkan menembus NAT ke PC ini. Ikuti Tahap 3-Versi-PC di bawah.

## Klik 1 tombol saja:
Klik **Continue** (ungu, tengah bawah).

## Setelah klik Continue, kamu masuk 3 langkah otomatis:
1. **Server connection** — "Connect through SSH to host your resources."
   - Pilih **Localhost / This server** (Coolify + aplikasi jalan di PC yang SAMA).
     Tidak perlu IP, tidak perlu kunci. Klik Validate/Save.
   - JANGAN pilih Remote server — itu untuk VPS beda mesin.

2. **Docker environment** — "Validate and configure the deployment runtime."
   - Klik **Validate / Check** → tunggu centang hijau Docker installed.
   - Kalau merah: di PC jalankan `docker --version`, kalau belum ada pasang Docker Desktop / Docker Engine dulu.

3. **Project structure** — "Create a project and its first environment."
   - Project name: `undangan`
   - Environment: `production` → Create.

Selesai Tahap -1 kalau sudah masuk Dashboard (menu kiri ada Projects/Servers).
Kirim foto layar berikutnya kalau beda — saya tunjukkan tombolnya.

---

# COOLIFY DARI NOL — Config Awal sampai Hijau (ikuti urutan, jangan loncat)

Target akhir: `https://undangan.domain-kamu.id/healthz` balas `{"ok":true}`.
Waktu: ~10 menit kalau ikuti urutan. Jangan ubah yang tidak disuruh.

---

## TAHAP 0 — Siapkan 3 hal ini dulu (2 menit) — VERSI PC LOKAL

Centang satu-satu sebelum lanjut:

- [ ] **Coolify bisa dibuka via domain.** Buktinya: kamu sedang buka layar Welcome
  ini via domain (bukan localhost). ✅ Sudah terbukti dari info kamu.
  Artinya jalur domain → PC ini SUDAH JALAN. Jangan diubah-ubah.
- [ ] **Docker jalan di PC ini.** Di PC jalankan `docker --version` → keluar nomor versi.
  Kalau belum ada → pasang Docker Desktop (Windows) / Docker Engine (Linux) dulu.
- [ ] **Punya subdomain untuk undangan.** Contoh: `undangan.domain-kamu.id`.
  Ini BEDA dengan domain Coolify. Rulenya: 1 domain masuk → teruskan ke
  service undangan port 3000 (lihat Tahap 3-Versi-PC).

Kalau 3 ini oke, lanjut Tahap 1. Jangan setting DNS A ke IP publik — PC ini tidak punya.

---

## TAHAP 1 — Buat Application (klik persis ini)

1. Dashboard → kiri **Projects** → pilih project (misal `production`).
2. Kanan atas klik **+ New** → pilih **Application** (bukan Database/Service).
3. Pilih jenis source:
   - Repo kamu `srvbotmyid/undangan` sekarang **Public** → klik **Public Repository**.
   - (Kalau nanti jadi Private lagi, ulangi pakai **Private Repository (Deploy Key)** — caranya di `DEPLOY_COOLIFY.md`.)
4. Kalau ditanya server → pilih VPS kamu → **Continue**.
5. Kolom **Repository URL**, paste persis (HTTPS, jangan SSH):
   ```
   https://github.com/srvbotmyid/undangan.git
   ```
6. Klik **Check Repository** → tunggu daftar branch muncul → pilih **main** → **Continue/Save**.

STOP. Jangan klik Deploy dulu. Lanjut Tahap 2.

---

## TAHAP 2 — Config awal (WAJIB sebelum Deploy pertama)

Buka aplikasi yang baru dibuat. Isi 4 tab ini SATU-SATU:

### 2a. Tab General / Configuration
- **Build Pack:** `Dockerfile`
- **Dockerfile Location:** `/Dockerfile`
- **Port / Exposed Port:** `3000`
- **Base Directory:** kosongkan (root)

### 2b. Tab Environment Variables (klik Add, 5 baris)
```
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=ganti-min-16-karakter-acak
PUBLIC_BASE_URL=https://undangan.domain-kamu.id
DB_PATH=./data/guestbook.sqlite
```
- `ADMIN_PASSWORD`: bikin acak min 16 huruf+angka. JANGAN pakai `admin123`.
- `PUBLIC_BASE_URL`: ganti dengan subdomain kamu. Kalau belum punya domain,
  isi sementara `http://localhost:3000`, nanti ganti setelah dapat domain.

### 2c. Tab Storages / Persistent Storage (WAJIB — tanpa ini data hilang!)
Tambah 2 volume:
| Name | Destination (di container) |
|---|---|
| `data-undangan` | `/app/data` |
| `cards-undangan` | `/app/uploads/cards` |

### 2d. Tab Health Checks
- **Path:** `/healthz`
- **Port:** `3000`

Sudah isi 2a–2d semua? Baru lanjut.

---

## TAHAP 3 — Domains (VERSI PC LOKAL — BACA INI, JANGAN PAKAI CARA VPS!)

Kamu akses Coolify via DOMAIN ke PC tanpa IP publik. Artinya di depan PC ini
sudah ada penerus (Cloudflare Tunnel / reverse proxy / NAT rumah) yang meneruskan
domain → PC ini. Jadi domain undangan MENGIKUTI JALUR YANG SAMA, bukan record A ke IP.

### Cara benar:
1. Tab **Domains** di aplikasi undangan → Add → isi:
   `https://undangan.domain-kamu.id` → Save.
   (Ganti dengan subdomain kamu. Harus BEDA dengan domain Coolify!)
2. Samakan penerusnya dengan domain Coolify:
   - **Kalau domain Coolify jalan via Cloudflare Tunnel:** tambah hostname
     `undangan.domain-kamu.id` → service `http://coolify-proxy:80` (atau ke
     IP proxy Coolify di PC ini). Jangan arahkan langsung ke port 3000 —
     biar lewat proxy Coolify (SSL + routing otomatis).
   - **Kalau via reverse proxy (Nginx/Traefik di depan):** tambah server block /
     router `undangan.domain-kamu.id` → `http://127.0.0.1:3000` (atau ke
     container proxy Coolify).
   - **Tidak tahu pakai yang mana?** Lihat domain Coolify kamu: cek di Cloudflare
     → Networks → Tunnels → hostname domain Coolify mengarah ke service apa.
     Duplikat polanya untuk subdomain undangan.
3. Tunggu 1–2 menit. Lanjut Tahap 4.

### JANGAN lakukan ini (pasti gagal di PC tanpa IP publik):
- ❌ Buat record A `undangan → IP publik` (PC ini tidak punya IP publik).
- ❌ Proxy oranye + sertifikat Let's Encrypt via HTTP-01 (tidak bisa validasi tanpa IP publik).
  Biarkan SSL ditangani penerus yang sudah jalan (Tunnel/proxy yang sama dengan domain Coolify).

---

## TAHAP 4 — Deploy pertama (1 klik)

1. Klik tombol **Deploy** (kanan atas). JANGAN klik 2x.
2. Buka tab **Deployments / Logs**, tunggu sampai status **Running / Healthy** (hijau).
   Build pertama 2–5 menit (download Node 24). Normal.
3. Tes di browser:
   - `https://domain-kamu/healthz` → harus `{"ok":true}`
   - `/` → form muncul. `/admin` → login pakai ADMIN_PASSWORD tadi.

---

## TAHAP 5 — Kalau gagal (baca log, jangan ulangi Deploy buta)

| Tulisan di log | Artinya | Betulkan di mana |
|---|---|---|
| `repository not found` | Repo jadi Private / URL salah | Ganti URL ke HTTPS di atas, atau pasang Deploy Key |
| `EADDRINUSE / port in use` | Port bentrok | Pastikan Port = 3000, 1 app 1 port |
| `unhealthy / 502 Bad Gateway` | App jalan tapi healthcheck gagal | Cek Env PORT=3000 + Health Path `/healthz` |
| `no such file /app/data` | Volume belum dipasang | Lengkapi Tahap 2c, Redeploy |
| `certificate / SSL error` | DNS/Proxy salah | Kembali ke DNS-only abu-abu, tunggu Valid baru Proxied |
| `admin123 warning` | Lupa ganti password | Ganti ADMIN_PASSWORD di Env, Redeploy |

Setelah hijau: Proxied oranye boleh dinyalakan + SSL `Full (strict)`.
Tambah Cache Rule Bypass untuk `/api/*` dan `/uploads/*` biar galeri selalu segar.

Update kode berikutnya:
```powershell
cd d:\undangan
git add -A; git commit -m "update"; git push
```
Lalu di Coolify klik **Redeploy** (atau nyalakan Auto Deploy on Push).
