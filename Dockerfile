# Stage 1: Build
FROM node:18-bullseye-slim AS builder

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

# ✅ FIX: Copy TypeScript + NestJS config files before install & build
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install ALL dependencies (devDependencies needed for nest build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:18-bullseye-slim

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
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy public folder only if it exists
RUN if [ -d /app/public ]; then echo "public exists"; fi

# Create uploads directory
RUN mkdir -p /app/uploads/ocr-temp /app/uploads/sales-ocr-temp && \
    chown -R nestjs:nodejs /app/uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
