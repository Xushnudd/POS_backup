# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:24-slim AS deps

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --engine-strict
RUN npx prisma generate

# Local HTTP development only. The final/default stage remains the production runner.
FROM deps AS local-development
COPY . .
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
RUN node scripts/build-offline.cjs \
    && node node_modules/typescript/bin/tsc -p tsconfig.worker.json \
    && mkdir -p /app/.next \
    && touch /app/next-env.d.ts \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --create-home --uid 1001 --gid nodejs nextjs \
    && chown 1001:1001 /app /app/.next /app/next-env.d.ts /app/tsconfig.json
USER 1001:1001
CMD ["node", "node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "0.0.0.0", "--port", "3000"]

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:24-slim AS builder
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run worker:build
RUN APP_ORIGIN=https://build.example.invalid DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

# Standalone tracing covers Next routes, but raw compiled worker modules also
# require packages bundled away by webpack. Keep their production dependency
# closure, with the same lockfile, rather than copying individual missing files.
FROM deps AS runtime-deps
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:24-slim AS runner
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

# Install openssl — required by Prisma query engine at runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.worker-build ./.worker-build
COPY --from=builder /app/scripts/worker-resolver.cjs ./scripts/worker-resolver.cjs
COPY --from=builder /app/scripts/ops/release-entrypoint.mjs ./scripts/ops/release-entrypoint.mjs

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
