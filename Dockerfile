FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY skill ./skill
VOLUME ["/data"]
ENV HOME=/data
EXPOSE 3000
CMD ["node", "dist/cli.js", "serve-http", "--host", "0.0.0.0", "--port", "3000"]
