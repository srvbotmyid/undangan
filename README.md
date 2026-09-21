# Undangan + Buku Tamu Digital QR

Alur: **QR cetak → Amplop Digital (gift) → Form Ucapan (pilih 1 dari 5 frame + Canvas overlay) → Galeri Publik (moderasi admin).**

Stack: **Node 24 + Express 4 + SQLite bawaan (`node:sqlite`) + Vanilla HTML/CSS/JS + Canvas.** Tanpa build step, tanpa native module (tidak butuh Visual Studio).

## Struktur

```
d:\undangan\
  server.js | db.js | schema.sql | .env
  frame\frame1.png...frame5.png   (master asli, jangan dihapus)
  public\
    index.html  (amplop + form + canvas)
    galeri.html | admin.html
    css\style.css | js\app.js | js\galeri.js | js\admin.js
    frames\frameN.png/.jpg (web, ~150-1100KB) + thumbs\ (grid)
    qr-undangan.png
  uploads\cards\  (hasil kartu, gitignore)
  data\guestbook.sqlite (DB, gitignore)
  tools\optimize-frames.mjs | tools\make-qr.mjs
```

## Jalankan

```powershell
Set-Location 'd:\undangan'
npm install
npm run optimize-frames   # jika frame\ berubah
npm start                 # atau: npm run dev (watch)
```

Buka: `http://localhost:3000/?to=Nama+Tamu` • `/galeri` • `/admin` (password di `.env`, default `admin123`).

## API

| Method | Endpoint | Ket |
|---|---|---|
| GET | `/api/frames` | daftar 5 frame |
| POST | `/api/greetings` | multipart `sender_name, message(≤500), frame_id, card(blob), guest_token?` → `pending` |
| GET | `/api/greetings?page&limit` | publik, hanya `approved` |
| POST | `/api/admin/login` | `{password}` → `{token}` |
| GET | `/api/admin/stats`, `/api/admin/greetings?status=` | header `x-admin-token` |
| PATCH | `/api/admin/greetings/:id` | `{status: approved\|rejected}` |
| DELETE | `/api/admin/greetings/:id` | hapus + file kartu |

## Ganti konten dummy

1. Rekening/e-wallet: edit `public\index.html` (blok `#gift`).
2. QRIS: simpan file sebagai `public\qris.png`, ubah `<img class="qris" src="/qris.png">`.
3. Posisi teks tiap frame: ubah `box:{x,y,w,h}` di `public\js\app.js` (fraksi 0-1). Default tengah 64% — kalibrasi setelah lihat visual frame.
4. Password admin + URL publik: edit `.env`, lalu `npm run make-qr -- https://domain-kamu.id`.

## Catatan

- Frame web dioptimasi 8 MB → ~150 KB (JPG) agar cepat dibuka dari QR di HP. Master tetap di `frame\`.
- Submit selalu `pending`; galeri hanya menampilkan `approved`.
- `node:sqlite` masih experimental di Node 24 tetapi stabil untuk beban acara (<10rb baris).
