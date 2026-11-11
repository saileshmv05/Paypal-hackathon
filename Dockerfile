# Production Dockerfile for ClearSettle
# Using Node 22 (Debian slim) to satisfy better-sqlite3@13+ requirement and glibc support
FROM node:22-slim AS builder

WORKDIR /app

# Install native build tools for C++ bindings (node-gyp / better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install root dependencies
COPY package*.json ./
RUN npm install

# Install client dependencies
COPY client/package*.json ./client/
RUN npm install --prefix client

# Copy application code
COPY . .

# Seed initial demonstration database and compile
RUN npm run seed
RUN npm run build

# Production Runner
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV ENABLE_DEMO_PROVIDER=true

COPY --from=builder /app /app

EXPOSE 5000

CMD ["npm", "run", "server"]

