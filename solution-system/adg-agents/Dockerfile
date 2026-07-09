FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY agent.ts ./

ENV NODE_ENV=production

EXPOSE 8081

# Dynamically resolve Cloud Run's injected PORT, falling back to 8081 locally
CMD ["sh", "-c", "bunx adk api_server agent.ts --port ${PORT:-8081} --host 0.0.0.0"]
