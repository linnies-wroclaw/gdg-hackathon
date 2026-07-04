#!/usr/bin/env bash

require_local_prerequisites() {
  log "Checking local prerequisites."
  require_cmd gcloud
  require_cmd tar
  require_cmd mktemp

  local account
  account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n 1 || true)"
  [[ -n "$account" ]] || die "No active gcloud account. Run: gcloud auth login"

  log "Using gcloud account: $account"
}
