# Stage 1: Build
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install Python + build tools + canvas native dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Copy TypeScript + NestJS config files before install & build
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install ALL dependencies (devDependencies needed for nest build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build


# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:20-bullseye-slim

WORKDIR /app

# Install dumb-init + canvas runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nestjs

# Copy package files + config
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built dist from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads/ocr-temp /app/uploads/sales-ocr-temp && \
    chown -R nestjs:nodejs /app/uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check TCP (pas besoin d'endpoint /health)
# Vérifie juste que le port 3001 est ouvert
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('net').createConnection(3001, 'localhost').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
# Supprimer le .env pour forcer l'utilisation des variables Kubernetes
RUN rm -f /app/.env /app/.env.production /app/.env.local 2>/dev/null || true
# Supprimer le .env pour que Kubernetes injecte les vraies variables
RUN rm -f /app/.env /app/.env.* 2>/dev/null || true
# Start the application
CMD ["node", "dist/main.js"]