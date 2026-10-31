FROM node:25-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate; npm start"]
