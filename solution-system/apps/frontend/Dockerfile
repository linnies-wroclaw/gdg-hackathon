FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock nx.json tsconfig.base.json ./
COPY eslint.config.mjs jest.config.ts jest.preset.js ./
COPY apps ./apps

RUN bun install --frozen-lockfile
RUN bunx nx build frontend

FROM nginx:alpine

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/frontend/browser /usr/share/nginx/html

EXPOSE 80
