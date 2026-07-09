FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock nx.json tsconfig.base.json ./
COPY eslint.config.mjs jest.config.ts jest.preset.js ./
COPY apps ./apps
COPY libs ./libs

RUN bun install --frozen-lockfile
RUN bunx nx build api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "dist/apps/api/main.js"]
