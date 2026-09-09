# syntax=docker/dockerfile:1
ARG PLAYWRIGHT_VERSION=1.62.1

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS deps

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8001
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

ENV CRAWLEE_STORAGE_DIR=/tmp/crawlee-storage

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY serviceAccount.json ./serviceAccount.json

RUN mkdir -p "$CRAWLEE_STORAGE_DIR" \
    && chown -R pwuser:pwuser /app "$CRAWLEE_STORAGE_DIR"
USER pwuser

EXPOSE 8001

CMD ["node", "src/app.js"]
