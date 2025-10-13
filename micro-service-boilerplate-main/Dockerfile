# Base Image
FROM node:18-alpine

# Set Working Directory
WORKDIR /app

# Copy Package Files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy Source Code
COPY . .

# Build Project
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8086

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  # TO CHANGE: Update the prefix as per your service name
  # CMD wget --no-verbose --tries=1 --spider http://localhost:8086/v1/service/health || exit 1

# Start Command
CMD ["npm", "start"]