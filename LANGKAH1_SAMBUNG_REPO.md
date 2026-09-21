# LANGKAH 1 SAJA: Sambungkan repo private ke Coolify

Jangan pikirkan domain / Cloudflare dulu. Fokus 5 menit ini saja.

## Kamu butuh 2 tab browser terbuka:
- Tab A: Coolify kamu
- Tab B: github.com/srvbotmyid/undangan

## Di Tab A (Coolify) — 2 klik:
1. Klik menu kiri: **Keys & Tokens** (atau **More > Private Keys** kalau tidak ketemu)
2. Klik **Generate** / **+ Add**, pilih tipe **ED25519**
3. Kamu dapat 2 kunci: PRIVATE (rahasia) dan PUBLIC (diawali `ssh-ed25519 AAAA...`)
4. **Copy yang PUBLIC** saja. Simpan di notepad.

## Di Tab B (GitHub) — 3 klik:
1. Buka `github.com/srvbotmyid/undangan` → klik **Settings** (tab paling kanan)
2. Klik kiri: **Deploy keys** → tombol **Add deploy key**
3. Isi:
   - Title: `coolify`
   - Key: paste kunci PUBLIC dari Coolify tadi
   - **JANGAN centang** Allow write access
4. Klik **Add key** → kunci muncul di daftar. Selesai!

## Balik ke Tab A (Coolify) — buat aplikasi:
1. Klik **Projects → production → + Add → Application**
2. Pilih **Private Repository (SSH / Deploy Key)**
3. Isi:
   - URL: `git@github.com:srvbotmyid/undangan.git`
   - Branch: `main`
   - Private Key: pilih kunci yang tadi kamu generate
4. Klik **Check / Test Connection** — harus hijau / Connected.

STOP SAMPAI SINI. Jangan lanjut ke Build/Domain dulu.

Kalau gagal, kirim ke saya:
- Stuck di nomor berapa? (A-berapa / B-berapa)
- Tulis pesan error merahnya apa?
