#!/usr/bin/env bash

ensure_service_account() {
  log "Ensuring VM service account exists."
  if gcloud_project iam service-accounts describe "$VM_SERVICE_ACCOUNT_EMAIL" >/dev/null 2>&1; then
    log "Service account already exists: $VM_SERVICE_ACCOUNT_EMAIL"
  else
    gcloud_project iam service-accounts create "$VM_SERVICE_ACCOUNT_NAME" \
      --display-name "${APP_NAME} Compute Engine runtime"
  fi

  gcloud_project projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member "serviceAccount:${VM_SERVICE_ACCOUNT_EMAIL}" \
    --role roles/logging.logWriter \
    --quiet >/dev/null

  gcloud_project projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member "serviceAccount:${VM_SERVICE_ACCOUNT_EMAIL}" \
    --role roles/monitoring.metricWriter \
    --quiet >/dev/null
}
