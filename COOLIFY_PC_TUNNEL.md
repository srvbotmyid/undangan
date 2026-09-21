# COOLIFY di PC Lokal + Cloudflare Tunnel (kasus kamu)

Setup kamu (21 Sep 2026):
- Coolify: https://coolify.srvbot.my.id/ v4.3.23
- Posisi: Root Team / undangan / production = "No resources yet" = Tahap -1 SELESAI.
- PC di sini tanpa IP publik, online via Cloudflare Tunnel.
- Repo: https://github.com/srvbotmyid/undangan.git (Public), branch main.
- App: Node 24, port 3000, health /healthz, bind 0.0.0.0 (sudah benar).

JANGAN buat record A ke IP. Domain undangan = Public Hostname baru di Tunnel
yang sama dengan coolify.srvbot.my.id, mengarah ke proxy Coolify.

## LANGKAH 1 — Dari layar fotomu (klik 2 tombol)

Kamu lihat tombol:
- Tengah: "+ Add Resource"
- Kanan atas ungu: "+ New Resource"
Keduanya SAMA. Klik salah satu, misal kanan atas **+ New Resource**.

## LANGKAH 2 — Pilih Application

Layar berikutnya ada pilihan: Application / Database / Service.
Klik **Application** (bukan yang lain).

## LANGKAH 3 — Pilih Public Repository

Pilih **Public Repository** (tulisannya: can be cloned over HTTPS without authentication).
Alasan: repo srvbotmyid/undangan sedang Public, jadi tanpa kunci.

## LANGKAH 4 — Isi source

- Server / Destination: pilih server lokal kamu (kalau cuma 1, pilih itu) → Continue.
- Repository URL, paste persis:
  https://github.com/srvbotmyid/undangan.git
- Branch: main
- Klik Check Repository / Continue. JANGAN klik Deploy dulu.

## LANGKAH 5 — Config wajib sebelum Deploy

Di halaman aplikasi, isi:

1. General / Build:
   - Build Pack: Dockerfile
   - Dockerfile Location: /Dockerfile
   - Port: 3000

2. Environment Variables (tambah 5 baris):
   PORT=3000
   NODE_ENV=production
   ADMIN_PASSWORD=ganti-min-16-karakter-acak
   PUBLIC_BASE_URL=https://undangan.srvbot.my.id
   DB_PATH=./data/guestbook.sqlite
   Ganti undangan.srvbot.my.id dengan subdomain yang kamu mau.
   Kalau belum punya, isi http://localhost:3000 dulu.

3. Storages (WAJIB, 2 baris):
   data-undangan -> /app/data
   cards-undangan -> /app/uploads/cards
   Tanpa ini DB + foto hilang tiap redeploy.

4. Health Check:
   Path: /healthz
   Port: 3000

5. Domains:
   Tambah https://undangan.srvbot.my.id (Save, jangan Deploy dulu).

## LANGKAH 6 — Sambungkan Tunnel (ini pengganti record A)

Di Cloudflare → Zero Trust → Networks → Tunnels → pilih tunnel yang dipakai
coolify.srvbot.my.id → Public Hostnames → Add:
- Hostname: undangan.srvbot.my.id
- Service Type: HTTP
- URL: IP-proxy-Coolify-di-PC-ini:80
  Contoh: kalau coolify.srvbot.my.id mengarah ke http://127.0.0.1:80 atau
  http://coolify-proxy:80, pakai nilai yang SAMA persis.
  Jangan langsung ke port 3000 — biar lewat proxy Coolify (routing + SSL otomatis).
- Save. Tunggu 1-2 menit.

Cara cek service proxy: lihat hostname coolify.srvbot.my.id di tunnel itu
mengarah ke mana → duplikat untuk undangan.

## LANGKAH 7 — Deploy

Kembali ke Coolify → aplikasi undangan → klik Deploy 1x.
Buka tab Logs/Deployments, tunggu Running/Healthy (hijau). Build pertama 2-5 menit.
Tes:
- https://undangan.srvbot.my.id/healthz → {"ok":true}
- / → form muncul, /admin → login pakai ADMIN_PASSWORD tadi.

## Kalau gagal

- repository not found → URL salah / repo jadi private. Pakai URL HTTPS di atas.
- 502 / unhealthy → cek PORT=3000 + health /healthz + app sudah bind 0.0.0.0 (sudah).
- No such file /app/data → lengkapi Storages, Redeploy.
- SSL error → jangan pakai Let's Encrypt HTTP-01 (PC tanpa IP publik pasti gagal).
  Biarkan SSL dari Tunnel/Cloudflare.

Update kode:
cd d:\undangan
git add -A
git commit -m "update"
git push
Lalu Redeploy di Coolify.
