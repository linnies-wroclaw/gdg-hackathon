FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY eslint.config.mjs jest.config.ts jest.preset.js ./
COPY apps ./apps
COPY libs ./libs

RUN npm install
RUN npx nx build api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]
