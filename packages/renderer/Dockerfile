# Renderer Dockerfile — builds and serves the Phaser game via Vite preview
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# Copy only needed packages
COPY packages/shared/ packages/shared/
COPY packages/agent-brain/ packages/agent-brain/
COPY packages/renderer/ packages/renderer/

# Install dependencies and build
RUN npm ci --ignore-scripts && npx turbo build --filter=@nts/renderer

# --- Production stage ---
FROM node:20-slim

WORKDIR /app

# Install a minimal static file server
RUN npm install -g serve@14

# Create non-root user for security
RUN groupadd -r renderer && useradd -r -g renderer renderer

# Copy built renderer output
COPY --from=builder /app/packages/renderer/dist /app/dist

EXPOSE 5173

USER renderer

# Serve static files on port 5173
CMD ["serve", "-s", "dist", "-l", "5173", "--no-clipboard"]
