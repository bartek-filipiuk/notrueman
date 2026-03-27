# Multi-stage Dockerfile for No True Man Show
# Targets: api (Node.js API server), web (static files via nginx)

# ===== Stage: Build =====
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/agent-brain/package.json packages/agent-brain/
COPY packages/memory-service/package.json packages/memory-service/
COPY apps/companion-web/package.json apps/companion-web/
RUN npm ci --ignore-scripts
COPY packages/ packages/
COPY apps/companion-web/ apps/companion-web/
COPY config/ config/
RUN npx turbo build --filter=@nts/agent-brain --filter=@nts/companion-web

# ===== Target: API Server =====
FROM node:22-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist/
COPY --from=build /app/packages/agent-brain/package.json packages/agent-brain/
COPY --from=build /app/packages/agent-brain/dist packages/agent-brain/dist/
COPY --from=build /app/packages/memory-service/package.json packages/memory-service/
COPY --from=build /app/packages/memory-service/dist packages/memory-service/dist/
COPY --from=build /app/config/ config/
RUN npm ci --omit=dev --ignore-scripts && \
    cd packages/agent-brain && npm rebuild bcrypt
EXPOSE 3001
USER node
CMD ["node", "packages/agent-brain/dist/health-server.js"]

# ===== Target: Web (Static Files) =====
FROM nginx:alpine AS web
COPY --from=build /app/apps/companion-web/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /ws/ {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
EXPOSE 80
