#!/usr/bin/env bash

destroy_resources() {
  log "Deleting Compute Engine VM if it exists."
  if gcloud_project compute instances describe "$VM_NAME" --zone "$GCP_ZONE" >/dev/null 2>&1; then
    gcloud_project compute instances delete "$VM_NAME" \
      --zone "$GCP_ZONE" \
      --delete-disks=all \
      --quiet
  else
    log "VM not found: $VM_NAME"
  fi

  delete_firewall_rule "${APP_NAME}-allow-internal-ports"
  delete_firewall_rule "${APP_NAME}-allow-frontend"
  delete_firewall_rule "${APP_NAME}-allow-ssh"

  log "Deleting subnet if it exists."
  if gcloud_project compute networks subnets describe "$GCP_SUBNET_NAME" --region "$GCP_REGION" >/dev/null 2>&1; then
    gcloud_project compute networks subnets delete "$GCP_SUBNET_NAME" \
      --region "$GCP_REGION" \
      --quiet
  else
    log "Subnet not found: $GCP_SUBNET_NAME"
  fi

  log "Deleting network if it exists."
  if gcloud_project compute networks describe "$GCP_NETWORK_NAME" >/dev/null 2>&1; then
    gcloud_project compute networks delete "$GCP_NETWORK_NAME" --quiet
  else
    log "Network not found: $GCP_NETWORK_NAME"
  fi

  log "Deleting VM service account if it exists."
  if gcloud_project iam service-accounts describe "$VM_SERVICE_ACCOUNT_EMAIL" >/dev/null 2>&1; then
    gcloud_project projects remove-iam-policy-binding "$GCP_PROJECT_ID" \
      --member "serviceAccount:${VM_SERVICE_ACCOUNT_EMAIL}" \
      --role roles/logging.logWriter \
      --quiet >/dev/null 2>&1 || true
    gcloud_project projects remove-iam-policy-binding "$GCP_PROJECT_ID" \
      --member "serviceAccount:${VM_SERVICE_ACCOUNT_EMAIL}" \
      --role roles/monitoring.metricWriter \
      --quiet >/dev/null 2>&1 || true
    gcloud_project iam service-accounts delete "$VM_SERVICE_ACCOUNT_EMAIL" --quiet
  else
    log "Service account not found: $VM_SERVICE_ACCOUNT_EMAIL"
  fi

  log "Destroy complete."
}

delete_firewall_rule() {
  local name="$1"
  if gcloud_project compute firewall-rules describe "$name" >/dev/null 2>&1; then
    log "Deleting firewall rule: $name"
    gcloud_project compute firewall-rules delete "$name" --quiet
  else
    log "Firewall rule not found: $name"
  fi
}
