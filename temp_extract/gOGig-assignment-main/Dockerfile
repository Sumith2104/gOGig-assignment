# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install system dependencies for native builds
RUN apk add --no-cache vips-dev python3 make g++ openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache vips tesseract-ocr openssl

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install tsx

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/worker.ts ./worker.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start"]
