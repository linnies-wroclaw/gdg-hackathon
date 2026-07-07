#!/usr/bin/env bash

enable_gcp_apis() {
  log "Enabling required Google Cloud APIs."
  gcloud_project services enable \
    serviceusage.googleapis.com \
    cloudresourcemanager.googleapis.com \
    compute.googleapis.com \
    iam.googleapis.com
}
