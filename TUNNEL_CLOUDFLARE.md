# Pilihan A — VPS tanpa IP Publik via Cloudflare Tunnel (langkah pelan)

Kenapa ini cocok: VPS kamu TIDAK BUTUH IP publik / buka port.
`cloudflared` di VPS yang nyambung KELUAR ke Cloudflare.

## Yang kamu butuh (siapkan dulu)
1. Domain/subdomain yang nameserver-nya di Cloudflare
   contoh: `undangan.domain-kamu.id`
2. VPS bisa internet keluar (cukup `curl https://cloudflare.com` jalan)
3. Aplikasi sudah jalan di VPS port 3000 (`npm start` → buka `curl localhost:3000/healthz` harus `{"ok":true}`)

## Langkah 1 — Di VPS: jalankan aplikasinya
```bash
cd /opt/undangan
# atau folder tempat kamu git clone https://github.com/srvbotmyid/undangan.git
npm ci --omit=dev
PORT=3000 ADMIN_PASSWORD=ganti-min-16-karakter NODE_ENV=production node server.js
# tes di terminal lain:
curl http://localhost:3000/healthz
```

Kalau sudah `{"ok":true}`, biarkan jalan (pakai tmux / systemd / pm2).

## Langkah 2 — Di VPS: pasang cloudflared (1 perintah)
Debian/Ubuntu:
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
cloudflared --version
```

## Langkah 3 — Login Cloudflare (sekali saja, muncul link)
```bash
cloudflared tunnel login
```
- Muncul link https://dash.cloudflare.com/argotunnel... → buka di laptop, login, pilih domain kamu.
- Hasilnya file `cert.pem` tersimpan di `~/.cloudflared/`.

## Langkah 4 — Buat tunnel + arahkan subdomain
```bash
cloudflared tunnel create undangan-tunnel
# catat Tunnel ID-nya, contoh: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
cloudflared tunnel route dns undangan-tunnel undangan.domain-kamu.id
# GANTI undangan.domain-kamu.id dengan subdomain kamu
```

## Langkah 5 — Config tunnel ke localhost:3000
Buat file `~/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL-ID-DARI-LANGKAH-4>
credentials-file: /home/<user>/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: undangan.domain-kamu.id
    service: http://localhost:3000
  - service: http_status:404
```
Contoh sudah ada di repo: `cloudflared/config.yml.example` — tinggal copy + ganti 2 baris.

Jalankan:
```bash
cloudflared tunnel run undangan-tunnel
```

## Langkah 6 — Tes
- Buka `https://undangan.domain-kamu.id/healthz` → harus `{"ok":true}`
- Buka `/` → form muncul, `/admin` bisa login.
- Kalau 502: berarti app belum jalan di 3000, cek `curl localhost:3000/healthz` dulu.

## Biar jalan terus (systemd)
```bash
sudo cloudflared --config ~/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

## Kalau pakai Docker (opsional)
Lihat `docker-compose.tunnel.yml`:
```bash
docker compose -f docker-compose.tunnel.yml up -d --build
docker logs -f undangan
docker logs -f cloudflared-tunnel
```
Isi `.env` dulu (copy dari `.env.example`, ganti ADMIN_PASSWORD + PUBLIC_BASE_URL).

## Gangguan umum
- `ERR Failed to create tunnel: not authorized` → ulangi `cloudflared tunnel login`, pastikan pilih domain yang benar.
- `DNS sudah ada` → hapus record A lama `undangan` di Cloudflare, ulangi `route dns`.
- `Bad Gateway` → app mati / beda port. Pastikan `PORT=3000` sama dengan `service: http://localhost:3000`.
