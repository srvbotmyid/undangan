# COOLIFY DARI NOL — Config Awal sampai Hijau (ikuti urutan, jangan loncat)

Target akhir: `https://undangan.domain-kamu.id/healthz` balas `{"ok":true}`.
Waktu: ~10 menit kalau ikuti urutan. Jangan ubah yang tidak disuruh.

---

## TAHAP 0 — Siapkan 3 hal ini dulu (2 menit)

Centang satu-satu sebelum lanjut:

- [ ] **VPS ADA IP PUBLIK.** Cek: di VPS jalankan `curl -4 ifconfig.me` → keluar angka IP.
  Kalau error / tidak ada IP → STOP, Coolify tidak bisa. Pakai Tunnel (lihat `TUNNEL_CLOUDFLARE.md`).
- [ ] **Coolify + server sudah hijau.** Dashboard → Servers → server kamu status Connected/Up.
- [ ] **Punya subdomain.** Contoh: `undangan.domain-kamu.id`. Belum punya? Tetap lanjut,
  pakai domain gratis dari Coolify dulu (ada di Tahap 3), custom domain belakangan.

Kalau 3 ini belum oke, jangan lanjut — pasti gagal.

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

## TAHAP 3 — Domains (pilih salah satu)

### Opsi 1 — Punya subdomain sendiri (disarankan untuk undangan)
1. Tab **Domains** → Add → isi `https://undangan.domain-kamu.id` → Save.
2. Buka Cloudflare → DNS → Add record:
   - Type `A`, Name `undangan`, Content = **IP publik VPS**, TTL Auto,
   - Proxy **MATI dulu (abu-abu / DNS only)** — JANGAN oranye dulu!
3. Tunggu 1–2 menit. Lanjut Tahap 4.

### Opsi 2 — Belum punya domain (pakai gratisan Coolify dulu)
1. Tab **Domains** → pakai **Generate Domain / Use Coolify Domain** (misal `xxx.coolify.io`).
2. Tidak perlu setting DNS manual. Langsung Tahap 4.

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
