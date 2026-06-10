# --- Stage 1: build frontend ---
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# --- Stage 2: server with built frontend ---
FROM node:22-alpine AS server
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY server/ ./
COPY --from=web /web/dist ./src/public

# Drop build deps to keep image small
RUN apk del python3 make g++ || true

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=9797
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/tao.db

EXPOSE 9797

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:9797/api/health || exit 1

CMD ["node", "src/index.js"]
