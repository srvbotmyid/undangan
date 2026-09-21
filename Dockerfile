# --- Undangan QR Guestbook — production image untuk Coolify ---
FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Install deps dulu (cache layer) — butuh package-lock.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Salin sisa source
COPY . .

# Pastikan folder persisten ada (DB + hasil kartu)
RUN mkdir -p data uploads/cards

EXPOSE 3000

# Healthcheck bawaan Docker/Coolify (pakai /healthz yang sudah ada)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
