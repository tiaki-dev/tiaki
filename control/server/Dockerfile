FROM node:24-alpine AS server-builder
RUN apk upgrade --no-cache && corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile --filter tiaki-server
COPY server ./server
RUN pnpm --filter tiaki-server run build

FROM node:24-alpine AS client-builder
RUN apk upgrade --no-cache && corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile --filter tiaki-client...
COPY client ./client
COPY server/src ./server/src
RUN pnpm --filter tiaki-client run build

FROM node:24-alpine AS runner
RUN apk upgrade --no-cache && corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace
ENV NODE_ENV=production
RUN chown node:node /workspace
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node server/package.json ./server/
RUN pnpm install --frozen-lockfile --prod --filter tiaki-server
COPY --chown=node:node --from=server-builder /workspace/server/dist ./server/dist
COPY --chown=node:node --from=server-builder /workspace/server/drizzle ./server/drizzle
COPY --chown=node:node --from=client-builder /workspace/client/dist ./public
USER node
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
