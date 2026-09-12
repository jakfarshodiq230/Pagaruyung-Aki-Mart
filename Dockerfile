# 1. Tahap Install Dependensi
FROM node:20-alpine AS deps
# Menambahkan libc6-compat (sering dibutuhkan oleh package node tertentu di alpine)
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Menyalin file package.json dari dalam folder WebServer
COPY WebServer/package.json WebServer/package-lock.json* WebServer/yarn.lock* WebServer/pnpm-lock.yaml* ./

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm install; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile tidak ditemukan." && exit 1; \
  fi

# 2. Tahap Build Aplikasi
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Menyalin seluruh source code dari dalam folder WebServer
COPY WebServer .

# Membangun aplikasi Next.js
RUN npm run build

# 3. Tahap Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Menyalin file statis public
COPY --from=builder /app/public ./public

# Menyalin output standalone agar ukurannya super kecil
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
