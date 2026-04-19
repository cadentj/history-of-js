FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Static file server for lessons (avoid interactive `npx` prompts in the PTY).
RUN npm install -g serve@14

WORKDIR /gateway

COPY package.json ./
# Lockfile lives at repo root (pnpm); image build context is this package only.
RUN npm install

COPY tsconfig.json ./
COPY server.ts ./
RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
