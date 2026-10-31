# Build stage
FROM node:25-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

# Copy package files first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install --no-audit --no-fund

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:25-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma and wget for health checks
RUN apk add --no-cache openssl openssl-dev wget

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm install --omit=dev --no-audit --no-fund && npm install --no-save prisma --no-audit --no-fund

# Generate Prisma Client
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose API port
EXPOSE 3001

# Run migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]

# Development stage
FROM node:25-alpine AS development

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# Expose API port
EXPOSE 3001

# Start development server with hot reload
CMD ["npm", "run", "dev"]
