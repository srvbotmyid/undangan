# Tanpa Coolify, VPS tanpa IP Publik — 2 pilihan gampang

VPS kamu tidak ada IP publik = tamu undangan dari internet TIDAK BISA
langsung buka `http://IP-VPS:3000`. Jadi ada 2 jalan:

## Pilihan A — Tetap pakai VPS itu + Cloudflare Tunnel (GRATIS, disarankan)
Cocok karena: VPS di balik NAT/tanpa IP publik TETAP BISA online
lewat tunnel keluar ke Cloudflare. Tanpa buka port, tanpa IP publik.

- Syarat: 1 domain/subdomain yang DNS-nya di Cloudflare
  contoh: `undangan.domain-kamu.id`
- Cara kerja: di VPS jalan `cloudflared tunnel` yang nyambung KELUAR
  ke Cloudflare, lalu Cloudflare teruskan ke `localhost:3000` di VPS.
- Biaya: gratis. Cocok untuk acara (<10rb tamu).

Lihat langkah klik-per-klik di: `TUNNEL_CLOUDFLARE.md`
File siap pakai: `docker-compose.tunnel.yml` + `cloudflared/config.yml.example`

## Pilihan B — Tidak pakai VPS sama sekali (PaaS, 3x klik)
Cocok kalau kamu mau terima beres, tidak oprek VPS.

- Repo kamu `srvbotmyid/undangan` SUDAH Public + ada `Dockerfile` + `/healthz`,
  jadi langsung bisa deploy ke:
  1. **Railway** (paling gampang, ada volume persisten, free trial $5)
  2. **Render** (free, tapi disk free terbatas + sleep)
  3. **Fly.io** (ada volume, perlu kartu kredit untuk verifikasi)
  4. **Koyeb / Northflank** (alternatif)
- Minus: SQLite butuh Persistent Disk/Volume, kalau lupa pasang
  data/galeri hilang tiap redeploy. Saya tulis caranya di file yang sama.

Lihat langkah di: `DEPLOY_PAAS.md`

## Rekomendasi saya untuk kamu
- Kalau domain sudah di Cloudflare → pilih **A (Tunnel)**. 10 menit jadi,
  VPS tetap di rumah/kantor tanpa IP publik bisa diakses tamu.
- Kalau belum punya domain / tidak mau oprek VPS → pilih **B (Railway)**.
  Tinggal login Railway → New Project → Deploy from GitHub → jadi.

Jawab: "Pilih A" atau "Pilih B", saya pandu 1 langkah demi 1 langkah.
