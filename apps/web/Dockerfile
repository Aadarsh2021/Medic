FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/types ./packages/types
COPY apps/web ./apps/web

RUN npm ci
RUN npm --prefix packages/types run build
RUN npm --prefix apps/web run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
