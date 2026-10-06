# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:24-slim AS deps

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --engine-strict
RUN npx prisma generate

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:24-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run worker:build
RUN APP_ORIGIN=https://build.example.invalid DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:24-slim AS runner

# Install openssl — required by Prisma query engine at runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.worker-build ./.worker-build
COPY --from=builder /app/scripts/worker-resolver.cjs ./scripts/worker-resolver.cjs

# Copy Prisma CLI for explicit migration job
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

EXPOSE 3000

# The deploy job runs migrations explicitly; web startup never mutates schema.
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs \
    && chown -R nextjs:nodejs /app
USER nextjs
CMD ["node", "server.js"]
