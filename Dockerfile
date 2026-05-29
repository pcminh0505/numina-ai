FROM node:22-alpine

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json pnpm-lock.yaml ./

# Install all deps (tsx + typescript are devDeps but needed at runtime)
RUN pnpm install --frozen-lockfile

# Copy only what the server needs at runtime
COPY server/ ./server/
COPY src/ ./src/
COPY tsconfig.json tsconfig.server.json ./

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["node_modules/.bin/tsx", "server/index.ts"]
