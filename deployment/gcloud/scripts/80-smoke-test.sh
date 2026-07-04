#!/usr/bin/env bash

run_smoke_test() {
  log "Running remote smoke test."
  gcloud_ssh "set -euo pipefail
cd '$REMOTE_APP_DIR'
deadline=\$((SECONDS + $DEPLOY_HEALTH_TIMEOUT_SECONDS))
while true; do
  if sudo docker compose -p '$COMPOSE_PROJECT_NAME' --env-file .env -f solution-system/docker-compose.yml ps --services --filter status=running | grep -qx frontend \
    && curl -fsS 'http://localhost:${FRONTEND_PORT}/' >/dev/null; then
    break
  fi

  if (( SECONDS >= deadline )); then
    sudo docker compose -p '$COMPOSE_PROJECT_NAME' --env-file .env -f solution-system/docker-compose.yml ps
    sudo docker compose -p '$COMPOSE_PROJECT_NAME' --env-file .env -f solution-system/docker-compose.yml logs --tail=120
    exit 1
  fi

  sleep 5
done

running_services=\$(sudo docker compose -p '$COMPOSE_PROJECT_NAME' --env-file .env -f solution-system/docker-compose.yml ps --services --filter status=running)
for service in frontend api postgres adk-agent mcp-server; do
  grep -qx \"\$service\" <<<\"\$running_services\"
done"

  if is_true "$RUN_AGENT_SMOKE_TEST"; then
    log "Running API/agent smoke test."
    gcloud_ssh "set -euo pipefail
cd '$REMOTE_APP_DIR'
payload='{\"message\":\"Deployment smoke test: call get_random_principles and return one TRIZ principle name in one short sentence.\"}'
if ! curl -fsS -m '$AGENT_SMOKE_TEST_TIMEOUT_SECONDS' \
  -H 'Content-Type: application/json' \
  -d \"\$payload\" \
  'http://localhost:${FRONTEND_PORT}/api/agent/messages' | grep -q '\"text\"'; then
  sudo docker compose -p '$COMPOSE_PROJECT_NAME' --env-file .env -f solution-system/docker-compose.yml logs --tail=120 api postgres adk-agent mcp-server
  exit 1
fi"
  else
    warn "Skipping API/agent smoke test because RUN_AGENT_SMOKE_TEST=false."
  fi

  local ip
  ip="$(vm_external_ip)"
  log "Deployment ready: http://${ip}:${FRONTEND_PORT}"
}
