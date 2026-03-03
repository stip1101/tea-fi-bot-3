# Build stage — install dependencies
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .

# Runtime stage
FROM oven/bun:1-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd -r -u 1001 -g root appuser

COPY --from=builder --chown=appuser:root /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:root /app/package.json ./
COPY --from=builder --chown=appuser:root /app/tsconfig.json ./
COPY --from=builder --chown=appuser:root /app/drizzle.config.ts ./
COPY --from=builder --chown=appuser:root /app/src ./src

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "src/index.ts"]
