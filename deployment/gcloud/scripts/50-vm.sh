#!/usr/bin/env bash

ensure_vm() {
  log "Ensuring Compute Engine VM exists."
  if gcloud_project compute instances describe "$VM_NAME" --zone "$GCP_ZONE" >/dev/null 2>&1; then
    log "VM already exists: $VM_NAME"
    gcloud_project compute instances add-tags "$VM_NAME" \
      --zone "$GCP_ZONE" \
      --tags "$VM_TAG" \
      --quiet >/dev/null
  else
    gcloud_project compute instances create "$VM_NAME" \
      --zone "$GCP_ZONE" \
      --machine-type "$MACHINE_TYPE" \
      --subnet "$GCP_SUBNET_NAME" \
      --network-tier PREMIUM \
      --tags "$VM_TAG" \
      --service-account "$VM_SERVICE_ACCOUNT_EMAIL" \
      --scopes "https://www.googleapis.com/auth/cloud-platform" \
      --image-family "$IMAGE_FAMILY" \
      --image-project "$IMAGE_PROJECT" \
      --boot-disk-size "$BOOT_DISK_SIZE" \
      --boot-disk-type pd-balanced
  fi
}

wait_for_vm_ssh() {
  log "Waiting for SSH to become available."
  local attempt
  for attempt in $(seq 1 40); do
    if gcloud_ssh "echo ssh-ready" >/dev/null 2>&1; then
      log "SSH is ready."
      return
    fi
    sleep 10
  done

  die "VM did not become reachable over SSH."
}
