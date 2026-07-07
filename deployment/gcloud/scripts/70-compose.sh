#!/usr/bin/env bash

install_remote_runtime() {
  log "Installing Docker Engine and Compose plugin on the VM if needed."
  local remote_script="/tmp/${APP_NAME}-install-runtime.sh"
  gcloud_scp_to_vm "$(deployment_dir)/remote/install-runtime.sh" "$remote_script"
  gcloud_ssh "sed -i 's/\r$//' '$remote_script' && chmod +x '$remote_script' && sudo '$remote_script' && rm -f '$remote_script'"
}

deploy_compose_stack() {
  log "Building and starting Docker Compose stack on the VM."
  local remote_script="/tmp/${APP_NAME}-compose-up.sh"
  gcloud_scp_to_vm "$(deployment_dir)/remote/compose-up.sh" "$remote_script"
  gcloud_ssh "sed -i 's/\r$//' '$remote_script' && chmod +x '$remote_script' && sudo '$remote_script' '$REMOTE_APP_DIR' '$COMPOSE_PROJECT_NAME' && rm -f '$remote_script'"
}
