# CARA PALING GAMPANG (tanpa kunci — repo kamu sudah Public)

Repo `srvbotmyid/undangan` sekarang terbaca PUBLIC, jadi lupakan Deploy Key / Private Key / Token.
Di Coolify pakai menu ini (tulisannya sama persis seperti di dokumen resmi Coolify):

## Langkah 1 — Buka Project
1. Login Coolify
2. Klik menu kiri **Projects** → pilih project kamu (misal `production`)
3. Klik tombol **+ New** (kanan atas)

## Langkah 2 — Pilih Public Repository
1. Di daftar yang muncul, klik **Public Repository**
   (penjelasan di bawahnya: "can be cloned over HTTPS without authentication")
2. Kalau ditanya server, pilih server/VPS kamu → **Continue**

## Langkah 3 — Paste URL + Check Repository
1. Copy ini persis:
   ```
   https://github.com/srvbotmyid/undangan.git
   ```
2. Paste ke kolom **Repository URL** (JANGAN pakai yang `git@github.com...`)
3. Klik tombol **Check Repository**
4. Tunggu sampai muncul Branch → pilih **main** → klik **Continue / Save**

## Langkah 4 — Isi 3 kolom wajib (abaikan sisanya dulu)
1. **Build Pack:** pilih `Dockerfile`
2. **Ports / Exposed Port:** isi `3000`
3. **Domains:** isi `https://undangan.domain-kamu.id`
   (ganti dengan subdomain kamu. Kalau belum punya domain, kosongkan dulu — bisa tambah nanti)

Lalu klik **Deploy** SEKALI. Tunggu log sampai hijau.

## Langkah 5 — Tambah password + penyimpanan (setelah Deploy pertama hijau)
1. Buka tab **Environment Variables** → tambah:
   ```
   PORT=3000
   NODE_ENV=production
   ADMIN_PASSWORD=ganti-min-16-karakter-acak
   PUBLIC_BASE_URL=https://undangan.domain-kamu.id
   DB_PATH=./data/guestbook.sqlite
   ```
2. Buka tab **Persistent Storage / Storages** → tambah 2 baris:
   - `data-undangan` → `/app/data`
   - `cards-undangan` → `/app/uploads/cards`
   Kalau tidak ada menu ini, data hilang tiap Redeploy — wajib!
3. Tab **Health Checks** → Path: `/healthz`, Port: `3000`
4. Klik **Redeploy** sekali lagi.

## Tes berhasil
- `domain-kamu/healthz` → `{"ok":true}`
- `/` → form muncul, `/admin` → bisa login

## Kalau tulisan di layar kamu beda, kirim saya:
1. Foto layar (HP juga boleh)
2. Tulis: stuck di Langkah berapa + tulisan tombol yang kamu lihat apa
Saya tunjukkan tombol yang diklik — jangan nebak-nebak sendiri.
