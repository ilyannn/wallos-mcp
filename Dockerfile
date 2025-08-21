# Build stage
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY tsconfig.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.2-alpine

# Add labels for container metadata
LABEL maintainer="Wallos MCP Maintainers"
LABEL version="0.1.0"
LABEL description="MCP server for Wallos subscription management"
LABEL org.opencontainers.image.source="https://github.com/ilyannn/wallos-mcp"
LABEL org.opencontainers.image.description="MCP server for Wallos subscription management"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init=1.2.5-r3

# Copy package files
COPY package.json ./

# Install production dependencies only with bun
RUN bun install --production --frozen-lockfile

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Change ownership to bun user
RUN chown -R bun:bun /app

# Switch to non-root user
USER bun

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the MCP server with bun
CMD ["bun", "dist/index.js"]