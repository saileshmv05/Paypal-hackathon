# Production Dockerfile for ClearSettle
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install
RUN npm install --prefix client

# Copy application code
COPY . .

# Seed initial demonstration database and compile
RUN npm run seed
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV ENABLE_DEMO_PROVIDER=true

COPY --from=builder /app /app

EXPOSE 5000

CMD ["npm", "run", "server"]
