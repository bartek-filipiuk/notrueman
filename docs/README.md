# No True Man Show

A 24/7 AI agent living in a pixel art room, rendered with Phaser 3 in the browser.

## Quick Start

### Prerequisites
- Node.js >= 20
- npm >= 10
- Docker & Docker Compose (for database services)

### Install & Run

```bash
# Install dependencies
npm install

# Start dev services (PostgreSQL, Redis, Ollama)
docker compose up -d

# Start the dev server
npm run dev

# Open http://localhost:5173 in your browser
```

### Build & Test

```bash
# Build all packages
npm run build

# Run all tests
npm run test

# Type check
npm run typecheck
```

## Directory Structure

```
notrueman/
  packages/
    shared/          # Shared types, schemas, constants (@nts/shared)
    renderer/        # Phaser 3 game client (@nts/renderer)
    agent-brain/     # AI agent logic (@nts/agent-brain)
    memory-service/  # Memory & embeddings (@nts/memory-service)
  apps/              # Application entry points
  docs/              # Documentation & specs
  docker-compose.yml # Dev services
  turbo.json         # Turborepo config
```

## Tech Stack

- **Frontend:** Phaser 3 (CANVAS, pixelArt), Vite, TypeScript
- **Backend:** Node.js, PostgreSQL 17 + pgvector, Redis 7, Ollama
- **Build:** Turborepo, npm workspaces
- **Testing:** Vitest
