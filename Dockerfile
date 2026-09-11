# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN rm -f package-lock.json && npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN rm -f package-lock.json && npm install --omit=dev

# Install drizzle-kit globally (for running db:push in production if needed)
RUN rm -f package-lock.json && npm install drizzle-kit

# Copy built artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/drizzle.config.ts ./

EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["npm", "run", "start"]
