# Pilihan B — Deploy tanpa VPS (Railway / Render / Fly, 3x klik)

Repo kamu SUDAH SIAP: Public, ada `Dockerfile`, port 3000, health `/healthz`.
Jadi tidak perlu utak-atik VPS.

## B1. Railway (paling gampang + ada volume, disarankan)
1. Buka https://railway.app → Login with GitHub (sebagai `srvbotmyid`)
2. **+ New Project → Deploy from GitHub repo** → pilih `srvbotmyid/undangan` → branch `main`
3. Railway otomatis deteksi `Dockerfile`. Tunggu build hijau.
4. Tab **Variables**, tambah:
   ```
   PORT=3000
   NODE_ENV=production
   ADMIN_PASSWORD=ganti-min-16-karakter-acak
   PUBLIC_BASE_URL=https://<domain-dari-railway>
   DB_PATH=./data/guestbook.sqlite
   ```
   `PUBLIC_BASE_URL` isi nanti setelah dapat domain (langkah 6), lalu Redeploy.
5. Tab **Volumes / Storage** → **+ Add Volume**:
   - Mount 1: `/app/data` (wajib, biar DB tidak hilang)
   - Mount 2: `/app/uploads/cards` (wajib, biar foto kartu tidak hilang)
6. Tab **Settings → Networking → Generate Domain** → dapat `https://undangan-xxxx.up.railway.app`
   Tes: tambah `/healthz` → harus `{"ok":true}`
7. (Opsional) Custom domain: Settings → Custom Domain → isi `undangan.domain-kamu.id`
   → tambah CNAME di Cloudflare ke domain Railway tadi.

Biaya: trial $5 gratis, setelah itu ~$5/bulan untuk acara kecil. Cukup untuk 1 acara.

## B2. Render (ada free, tapi tidur kalau sepi)
1. https://dashboard.render.com → New → Web Service → Connect `srvbotmyid/undangan`
2. Isi: Environment `Docker`, Dockerfile Path `./Dockerfile`, Health Check Path `/healthz`
3. Env sama seperti di atas (5 baris).
4. **Disks**: Add Disk → Mount Path `/app/data` (1GB) + `/app/uploads/cards` (1GB).
   Tanpa ini data hilang tiap deploy!
5. Create → tunggu hijau → tes `/healthz`.

Minus free: sleep 15 mnt tidak ada tamu → buka pertama agak lama. Untuk pesta tetap oke.

## B3. Fly.io (perlu kartu kredit verifikasi, tapi murah)
```bash
fly launch --from https://github.com/srvbotmyid/undangan
# jawab: port 3000, health /healthz
fly volumes create data --size 1 --region sin
fly volumes create cards --size 1 --region sin
fly secrets set ADMIN_PASSWORD=ganti-min-16-karakter PUBLIC_BASE_URL=https://undangan.domain-kamu.id
fly deploy
```
Mount di `fly.toml`:
```toml
[[mounts]]
  source = "data"
  destination = "/app/data"
[[mounts]]
  source = "cards"
  destination = "/app/uploads/cards"
```

## Pilih yang mana?
- Mau klik-klik jadi + tidak mikir VPS → **Railway B1**
- Mau gratis walau tidur → **Render B2**
- Mau murah + sudah biasa terminal → **Fly B3**
