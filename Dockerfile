# PCSO HRIS — production image (TOR 3.1.2: Docker deployment)
#
# Multi-stage build: deps -> builder -> standalone runner.
#
# IMPORTANT — build-time environment:
#   NEXT_PUBLIC_* variables are inlined into the client bundle by `next build`,
#   so they MUST be provided as --build-arg (docker-compose.yml wires them from
#   .env.local via build.args). Server-only secrets (SUPABASE_SERVICE_ROLE_KEY,
#   DATABASE_URL, JWT_SECRET, RESEND_API_KEY, CRON_SECRET, ...) are NOT baked
#   into the image — supply them at runtime (env_file / -e).
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#     --build-arg NEXT_PUBLIC_APP_URL=https://hris.pcso.gov.ph \
#     --build-arg NEXT_PUBLIC_APP_NAME="PCSO HRIS" \
#     -t pcso-hris .

# ─── Stage 1: dependencies ───────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* build args → env so `next build` can inline them.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# BUILD_STANDALONE=1 switches next.config.mjs to output: "standalone"
# (required for the minimal runner below; `next start` deploys stay unaffected).
ENV BUILD_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Non-root user (least privilege).
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
