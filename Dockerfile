# Multi-stage Dockerfile for No True Man Show V1.0
# Builds: companion-web (static) + agent-brain API (Node.js)

# === Stage 1: Build ===
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# Copy all needed packages
COPY packages/shared/ packages/shared/
COPY packages/memory-service/ packages/memory-service/
COPY packages/agent-brain/ packages/agent-brain/
COPY packages/renderer/ packages/renderer/
COPY apps/companion-web/ apps/companion-web/

# Install dependencies and build everything
RUN npm ci --ignore-scripts && \
    npx turbo build --filter=@nts/companion-web --filter=@nts/agent-brain --filter=@nts/renderer

# === Stage 2: Production ===
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/memory-service/package.json packages/memory-service/
COPY packages/agent-brain/package.json packages/agent-brain/
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

# Copy built outputs
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/memory-service/dist packages/memory-service/dist
COPY --from=builder /app/packages/memory-service/package.json packages/memory-service/
COPY --from=builder /app/packages/agent-brain/dist packages/agent-brain/dist
COPY --from=builder /app/packages/agent-brain/package.json packages/agent-brain/

# Copy companion-web static build
COPY --from=builder /app/apps/companion-web/dist /app/public

# Copy renderer static build
COPY --from=builder /app/packages/renderer/dist /app/public/game

# Install serve for static files
RUN npm install -g serve@14

# Create non-root user
RUN groupadd -r nts && useradd -r -g nts nts
RUN chown -R nts:nts /app

USER nts

# API on 3001, static on 5173
EXPOSE 3001 5173

# Start both API and static server
CMD ["sh", "-c", "serve -s /app/public -l 5173 --no-clipboard & node packages/agent-brain/dist/index.js"]
