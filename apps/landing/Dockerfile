FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "start"]
