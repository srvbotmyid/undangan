// Optimasi frame asli (2-8 MB, 2752x1536) menjadi ramah mobile.
// Input : d:\undangan\frame\frame1.png ... frame5.png
// Output: public\frames\frameN.jpg (max 1600px, q80) + public\frames\thumbs\frameN.jpg (480px)
//         + public\frames\frameN.png versi web (max 1600px, kompresi) untuk canvas.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'frame');
const OUT_DIR = path.join(ROOT, 'public', 'frames');
const THUMB_DIR = path.join(OUT_DIR, 'thumbs');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });

const ids = ['frame1', 'frame2', 'frame3', 'frame4', 'frame5'];

for (const id of ids) {
  const src = path.join(SRC_DIR, `${id}.png`);
  if (!fs.existsSync(src)) {
    console.warn(`[skip] ${src} tidak ditemukan`);
    continue;
  }
  const meta = await sharp(src).metadata();
  console.log(`${id}: asli ${meta.width}x${meta.height} (${(fs.statSync(src).size / 1024 / 1024).toFixed(2)} MB)`);

  // Versi web PNG (max lebar 1600, kompresi) — dipakai canvas <img>/drawImage
  const outPng = path.join(OUT_DIR, `${id}.png`);
  await sharp(src)
    .resize({ width: Math.min(1600, meta.width || 1600), withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPng);

  // Versi JPG ringan (fallback cepat, max 1600, q80)
  const outJpg = path.join(OUT_DIR, `${id}.jpg`);
  await sharp(src)
    .resize({ width: Math.min(1600, meta.width || 1600), withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(outJpg);

  // Thumbnail grid 480px
  const outThumb = path.join(THUMB_DIR, `${id}.jpg`);
  await sharp(src)
    .resize({ width: 480, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toFile(outThumb);

  const sPng = (fs.statSync(outPng).size / 1024).toFixed(0);
  const sJpg = (fs.statSync(outJpg).size / 1024).toFixed(0);
  const sTh = (fs.statSync(outThumb).size / 1024).toFixed(0);
  console.log(`  -> ${id}.png ${sPng} KB | ${id}.jpg ${sJpg} KB | thumbs/${id}.jpg ${sTh} KB`);
}

console.log('Selesai. File web di public/frames/');
