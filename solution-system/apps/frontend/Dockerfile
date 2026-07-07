FROM node:26-alpine AS build

WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY eslint.config.mjs jest.config.ts jest.preset.js ./
COPY apps ./apps

RUN npm install
RUN npx nx build frontend

FROM nginx:alpine

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/frontend/browser /usr/share/nginx/html

EXPOSE 80
