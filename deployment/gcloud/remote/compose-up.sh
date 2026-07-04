#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_APP_DIR="${1:?REMOTE_APP_DIR argument is required}"
COMPOSE_PROJECT_NAME="${2:?COMPOSE_PROJECT_NAME argument is required}"

cd "$REMOTE_APP_DIR"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker compose \
  -p "$COMPOSE_PROJECT_NAME" \
  --env-file .env \
  -f solution-system/docker-compose.yml \
  up -d --build --remove-orphans

docker compose \
  -p "$COMPOSE_PROJECT_NAME" \
  --env-file .env \
  -f solution-system/docker-compose.yml \
  ps
