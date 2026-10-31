# Build stage for production
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for Vite (embedded at build time)
ARG VITE_API_BASE_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_COMPOSER_URL
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_RELEASE
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_STUDIO_ALLOWED_DOMAINS

# Make build args available as env vars during build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_COMPOSER_URL=$VITE_COMPOSER_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
ENV VITE_STUDIO_ALLOWED_DOMAINS=$VITE_STUDIO_ALLOWED_DOMAINS

# Copy all workspace package.json files for proper npm workspace resolution
COPY package*.json ./
COPY apps/client/package*.json apps/client/
COPY apps/studio/package*.json apps/studio/
COPY services/api/package*.json services/api/
COPY packages/review-ui/package*.json packages/review-ui/

RUN npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund

COPY . .

RUN npm run build --workspace sako-studio

# Production stage with nginx
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/apps/studio/build /usr/share/nginx/html

# Copy nginx config with gzip compression
COPY apps/studio/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Copy all workspace package.json files for proper npm workspace resolution
COPY package*.json ./
COPY apps/client/package*.json apps/client/
COPY apps/studio/package*.json apps/studio/
COPY services/api/package*.json services/api/
COPY packages/review-ui/package*.json packages/review-ui/

RUN npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund

COPY . .

WORKDIR /app/apps/studio

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
