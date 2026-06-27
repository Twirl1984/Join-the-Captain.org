# ── Build-Stage ─────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Build ohne DB/Keys möglich – Route-Module greifen erst zur Laufzeit zu.
RUN npm run build

# ── Runtime-Stage ───────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Nur Produktions-Dependencies.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
COPY next.config.ts tsconfig.json ./

EXPOSE 3000
CMD ["npm", "run", "start"]
