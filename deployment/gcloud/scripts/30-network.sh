#!/usr/bin/env bash

ensure_network() {
  log "Ensuring VPC network exists."
  if gcloud_project compute networks describe "$GCP_NETWORK_NAME" >/dev/null 2>&1; then
    log "Network already exists: $GCP_NETWORK_NAME"
  else
    gcloud_project compute networks create "$GCP_NETWORK_NAME" \
      --subnet-mode=custom
  fi

  log "Ensuring regional subnet exists."
  if gcloud_project compute networks subnets describe "$GCP_SUBNET_NAME" --region "$GCP_REGION" >/dev/null 2>&1; then
    log "Subnet already exists: $GCP_SUBNET_NAME"
  else
    gcloud_project compute networks subnets create "$GCP_SUBNET_NAME" \
      --network "$GCP_NETWORK_NAME" \
      --region "$GCP_REGION" \
      --range "$GCP_SUBNET_RANGE"
  fi

  ensure_firewall_rule "${APP_NAME}-allow-ssh" "$SSH_SOURCE_RANGE" "tcp:22"
  ensure_firewall_rule "${APP_NAME}-allow-frontend" "$HTTP_SOURCE_RANGE" "tcp:${FRONTEND_PORT}"

  if is_true "$EXPOSE_INTERNAL_PORTS"; then
    warn "EXPOSE_INTERNAL_PORTS=true opens API, ADK, and MCP ports publicly."
    ensure_firewall_rule "${APP_NAME}-allow-internal-ports" "$HTTP_SOURCE_RANGE" "tcp:3000,tcp:8000,tcp:8081"
  else
    delete_firewall_rule_if_exists "${APP_NAME}-allow-internal-ports"
  fi
}

ensure_firewall_rule() {
  local name="$1"
  local source_range="$2"
  local allowed="$3"

  if gcloud_project compute firewall-rules describe "$name" >/dev/null 2>&1; then
    local existing_network
    existing_network="$(gcloud_project compute firewall-rules describe "$name" --format='value(network)')"
    if [[ "$existing_network" != */global/networks/"$GCP_NETWORK_NAME" ]]; then
      warn "Firewall rule $name belongs to another network; recreating it."
      gcloud_project compute firewall-rules delete "$name" --quiet
    else
      log "Updating firewall rule: $name"
      gcloud_project compute firewall-rules update "$name" \
        --rules "$allowed" \
        --source-ranges "$source_range" \
        --target-tags "$VM_TAG"
      return
    fi
  fi

  gcloud_project compute firewall-rules create "$name" \
    --network "$GCP_NETWORK_NAME" \
    --direction INGRESS \
    --priority 1000 \
    --action ALLOW \
    --rules "$allowed" \
    --source-ranges "$source_range" \
    --target-tags "$VM_TAG"
}

delete_firewall_rule_if_exists() {
  local name="$1"

  if gcloud_project compute firewall-rules describe "$name" >/dev/null 2>&1; then
    log "Deleting disabled firewall rule: $name"
    gcloud_project compute firewall-rules delete "$name" --quiet
  fi
}
