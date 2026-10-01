# Undangan Nara & Ilyas

Kartu ucapan digital: tamu buka tautan (bisa dari QR), kirim tanda kasih ke rekening BCA, tulis ucapan di atas bingkai, lalu admin menyetujui sebelum tampil di galeri.

Node + Express + SQLite. Tanpa build.

## Jalan lokal

```
npm install
npm start
```

Buka `http://localhost:3000`. Admin di `/admin` (password di `.env`).

Kalau file di folder `frame/` berubah:

```
npm run optimize-frames
```

## Isi yang perlu diubah

- Rekening: `public/index.html` dan `public/gift.html` (sekarang BCA 7314191995 a.n. Nadita Ranasya)
- Posisi teks di bingkai: `box` dan `nameY` di `public/js/app.js`
- Password admin dan URL publik: `.env`, lalu `npm run make-qr -- https://domain-kamu.id`

## Catatan

- Bingkai web ada di `public/frames/` (sudah diperkecil). File asli tetap di `frame v2/`.
- Ucapan masuk sebagai menunggu; galeri hanya menampilkan yang disetujui.
- Data: `data/guestbook.sqlite`, kartu di `uploads/cards/`, bukti transfer di `uploads/cards/proofs/` (tidak ikut git).
