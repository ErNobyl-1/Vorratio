# Multi-stage build for Vorratio

# Stage 1: Build
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/web/package*.json ./packages/web/

# Install all dependencies
RUN npm install

# Copy source files
COPY tsconfig.base.json ./
COPY packages/api ./packages/api
COPY packages/web ./packages/web

# Generate Prisma client
WORKDIR /app/packages/api
RUN npx prisma generate

# Build API (TypeScript compilation)
RUN npx tsc

# Build Web (pass build-time args)
WORKDIR /app/packages/web
ARG VITE_DEFAULT_LOCALE=en
ENV VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files for production install
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Install production dependencies only
RUN npm install --omit=dev

# Copy Prisma schema and generate client in production
COPY packages/api/prisma ./packages/api/prisma
WORKDIR /app/packages/api
RUN npx prisma generate

# Copy built files
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# Create data directory and fix permissions for node user
RUN mkdir -p /data && \
    chown -R node:node /data && \
    chown -R node:node /app

# Set environment
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/vorratio.db
ENV TZ=Europe/Berlin

# Use non-root user
USER node

WORKDIR /app/packages/api

EXPOSE 3000

# Initialize database and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
