# Stage 1: Build Vue.js Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ .

# Build frontend for production
RUN npm run build

# Stage 2: Setup Backend and Final Image
FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies (production only)
RUN npm ci --production

# Copy backend source
COPY backend/ .

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directories
RUN mkdir -p /app/data/bots /app/data/logs

# Expose port
EXPOSE 3000

# Unraid Template Labels
LABEL net.unraid.docker.managed="dockerman" \
      net.unraid.docker.webui="http://[IP]:[PORT:9090]" \
      net.unraid.docker.icon="https://raw.githubusercontent.com/Andre3671/DiscBot/main/icon.png" \
      net.unraid.docker.shell="sh" \
      org.opencontainers.image.title="DiscBot" \
      org.opencontainers.image.description="Create, customize, and manage multiple Discord bots through an easy-to-use web interface" \
      org.opencontainers.image.vendor="andreroygaard" \
      org.opencontainers.image.url="https://github.com/Andre3671/DiscBot" \
      org.opencontainers.image.source="https://github.com/Andre3671/DiscBot"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "src/server.js"]
