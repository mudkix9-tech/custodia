FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g turbo

# Install dependencies needed for node-gyp
RUN apk add --no-cache libc6-compat python3 make g++

COPY . .
RUN turbo prune --scope=api --docker

# Add lockfile and package.json's of isolated subworkspace
FROM node:20-alpine AS installer
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++

# First install dependencies
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci

# Build the project
COPY --from=builder /app/out/full/ .
RUN npm run build --workspace=packages/db

FROM node:20-alpine AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

COPY --from=installer /app .

# Set up env
ENV NODE_ENV=production

# Expose API port
EXPOSE 4000

USER api

CMD ["npm", "run", "start", "--workspace=apps/api"]
