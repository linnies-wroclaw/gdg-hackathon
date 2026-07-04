#!/usr/bin/env bash

sync_application() {
  log "Packaging solution-system for upload."
  local archive
  archive="$(mktemp "${TMPDIR:-/tmp}/${APP_NAME}.source.XXXXXX.tar.gz")"

  tar -C "$(repo_root)" \
    --exclude='solution-system/.env' \
    --exclude='solution-system/node_modules' \
    --exclude='solution-system/adg-agents/node_modules' \
    --exclude='solution-system/mcp-server/.venv' \
    --exclude='solution-system/dist' \
    --exclude='solution-system/tmp' \
    --exclude='solution-system/.nx' \
    --exclude='solution-system/coverage' \
    -czf "$archive" \
    solution-system

  log "Uploading source archive to VM."
  local remote_archive="/tmp/${APP_NAME}-source.tar.gz"
  gcloud_scp_to_vm "$archive" "$remote_archive"
  rm -f "$archive"

  log "Extracting application on VM."
  gcloud_ssh "set -euo pipefail
sudo mkdir -p '$REMOTE_APP_DIR'
sudo rm -rf '$REMOTE_APP_DIR/solution-system'
sudo tar -xzf '$remote_archive' -C '$REMOTE_APP_DIR'
sudo chown -R \"\$(id -un):\$(id -gn)\" '$REMOTE_APP_DIR'
rm -f '$remote_archive'"
}

write_remote_env() {
  log "Writing remote runtime env files."
  local tmp_env
  tmp_env="$(mktemp "${TMPDIR:-/tmp}/${APP_NAME}.env.XXXXXX")"
  chmod 600 "$tmp_env"

  cat >"$tmp_env" <<EOF
GOOGLE_GENAI_API_KEY=${GOOGLE_GENAI_API_KEY}
GEMINI_API_KEY=${GEMINI_API_KEY}
GOOGLE_API_KEY=${GOOGLE_API_KEY}

ADK_AGENT_PORT=8081
MCP_SERVER_URL=http://mcp-server:8000/mcp

PORT=3000
ADK_AGENT_URL=http://adk-agent:8081

MCP_HOST=0.0.0.0
MCP_PORT=8000
MCP_NAME=triz-mcp-server
AUTH_ENABLED=false

COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}
EOF

  local remote_env="/tmp/${APP_NAME}.env"
  gcloud_scp_to_vm "$tmp_env" "$remote_env"
  rm -f "$tmp_env"

  gcloud_ssh "set -euo pipefail
sudo install -m 0600 '$remote_env' '$REMOTE_APP_DIR/.env'
sudo cp '$REMOTE_APP_DIR/.env' '$REMOTE_APP_DIR/solution-system/.env'
sudo chown \"\$(id -un):\$(id -gn)\" '$REMOTE_APP_DIR/.env' '$REMOTE_APP_DIR/solution-system/.env'
rm -f '$remote_env'"
}
