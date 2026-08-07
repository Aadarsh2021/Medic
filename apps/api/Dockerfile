# Multi-stage Dockerfile for NestJS API with Puppeteer & Prisma support
FROM node:20-slim AS builder

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root monorepo files for npm workspace resolution
COPY package*.json ./
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Install dependencies and build shared packages & NestJS API
RUN npm ci
RUN npm run build:types
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build:api

# Production Stage
FROM node:20-slim AS runner

# Install Chromium & system dependencies for Puppeteer & Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy built workspace and node_modules from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 5555

WORKDIR /app/apps/api

CMD ["sh", "-c", "npx prisma generate --schema=prisma/schema.prisma && npx prisma migrate deploy && node dist/main.js"]
