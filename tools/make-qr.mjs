// Generate QR Code PNG untuk cetak undangan fisik.
// URL diambil dari PUBLIC_BASE_URL di .env (atau argumen CLI).
// Usage: npm run make-qr -- https://domain-kamu.id
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const env = {};
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}

const env = loadEnv();
const target = process.argv[2] || env.PUBLIC_BASE_URL || 'http://localhost:3000';
const out = path.join(ROOT, 'public', 'qr-undangan.png');

await QRCode.toFile(out, target, { width: 800, margin: 2, errorCorrectionLevel: 'M' });
console.log(`QR tersimpan: ${out}\nIsi: ${target}`);
