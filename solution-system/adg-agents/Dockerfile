FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY agent.ts ./

ENV NODE_ENV=production

EXPOSE 8081

# Dynamically resolve Cloud Run's injected PORT, falling back to 8081 locally
CMD ["sh", "-c", "npx adk api_server agent.ts --port ${PORT:-8081} --host 0.0.0.0"]
