#!/usr/bin/env bash

log() {
  printf '[deploy] %s\n' "$*"
}

warn() {
  printf '[deploy][warn] %s\n' "$*" >&2
}

die() {
  printf '[deploy][error] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

is_true() {
  case "${1:-}" in
    true|TRUE|1|yes|YES|y|Y) return 0 ;;
    *) return 1 ;;
  esac
}

assert_name() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]] || die "$name must use lowercase letters, digits, and hyphens; start with a letter; and end with a letter or digit."
}

assert_number() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^[1-9][0-9]*$ ]] || die "$name must be a positive integer."
}

assert_port() {
  local name="$1"
  local value="$2"

  assert_number "$name" "$value"
  (( value <= 65535 )) || die "$name must be between 1 and 65535."
}

assert_max_length() {
  local name="$1"
  local value="$2"
  local max="$3"

  (( ${#value} <= max )) || die "$name must be ${max} characters or fewer."
}

assert_absolute_safe_path() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "$name must be an absolute path containing only letters, digits, dot, underscore, slash, or hyphen."
}

deployment_dir() {
  if [[ -n "${DEPLOYMENT_DIR:-}" ]]; then
    printf '%s\n' "$DEPLOYMENT_DIR"
    return
  fi

  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

repo_root() {
  cd "$(deployment_dir)/../.." && pwd
}

load_config() {
  local env_file="$1"

  [[ -f "$env_file" ]] || die "Env file not found: $env_file"

  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  set +a

  : "${APP_NAME:=buildwithai}"
  : "${GCP_REGION:=europe-west1}"
  : "${GCP_ZONE:=${GCP_REGION}-b}"
  : "${MACHINE_TYPE:=e2-standard-2}"
  : "${BOOT_DISK_SIZE:=50GB}"
  : "${FRONTEND_PORT:=4200}"
  : "${SSH_SOURCE_RANGE:=0.0.0.0/0}"
  : "${HTTP_SOURCE_RANGE:=0.0.0.0/0}"
  : "${EXPOSE_INTERNAL_PORTS:=false}"
  : "${REMOTE_APP_DIR:=/opt/${APP_NAME}}"
  : "${DEPLOY_HEALTH_TIMEOUT_SECONDS:=900}"
  : "${RUN_AGENT_SMOKE_TEST:=true}"
  : "${AGENT_SMOKE_TEST_TIMEOUT_SECONDS:=180}"

  : "${GCP_NETWORK_NAME:=${APP_NAME}-net}"
  : "${GCP_SUBNET_NAME:=${APP_NAME}-subnet}"
  : "${GCP_SUBNET_RANGE:=10.20.0.0/24}"
  : "${VM_NAME:=${APP_NAME}-vm}"
  : "${VM_TAG:=${APP_NAME}-public}"
  : "${VM_SERVICE_ACCOUNT_NAME:=${APP_NAME}-vm}"
  : "${IMAGE_FAMILY:=ubuntu-2204-lts}"
  : "${IMAGE_PROJECT:=ubuntu-os-cloud}"
  : "${COMPOSE_PROJECT_NAME:=${APP_NAME}}"

  [[ -n "${GCP_PROJECT_ID:-}" ]] || die "GCP_PROJECT_ID is required in the env file."
  [[ -n "${GOOGLE_GENAI_API_KEY:-}" ]] || die "GOOGLE_GENAI_API_KEY is required in the env file."

  assert_name APP_NAME "$APP_NAME"
  assert_name VM_NAME "$VM_NAME"
  assert_name VM_TAG "$VM_TAG"
  assert_name GCP_NETWORK_NAME "$GCP_NETWORK_NAME"
  assert_name GCP_SUBNET_NAME "$GCP_SUBNET_NAME"
  assert_name VM_SERVICE_ACCOUNT_NAME "$VM_SERVICE_ACCOUNT_NAME"
  assert_port FRONTEND_PORT "$FRONTEND_PORT"
  assert_number DEPLOY_HEALTH_TIMEOUT_SECONDS "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  assert_number AGENT_SMOKE_TEST_TIMEOUT_SECONDS "$AGENT_SMOKE_TEST_TIMEOUT_SECONDS"
  assert_max_length VM_SERVICE_ACCOUNT_NAME "$VM_SERVICE_ACCOUNT_NAME" 30
  assert_absolute_safe_path REMOTE_APP_DIR "$REMOTE_APP_DIR"

  if [[ "$GOOGLE_GENAI_API_KEY" == *$'\n'* ]]; then
    die "GOOGLE_GENAI_API_KEY must be a single-line value."
  fi

  : "${GEMINI_API_KEY:=${GOOGLE_GENAI_API_KEY}}"
  : "${GOOGLE_API_KEY:=${GOOGLE_GENAI_API_KEY}}"

  VM_SERVICE_ACCOUNT_EMAIL="${VM_SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
  export APP_NAME GCP_PROJECT_ID GCP_REGION GCP_ZONE MACHINE_TYPE BOOT_DISK_SIZE
  export FRONTEND_PORT SSH_SOURCE_RANGE HTTP_SOURCE_RANGE EXPOSE_INTERNAL_PORTS
  export REMOTE_APP_DIR DEPLOY_HEALTH_TIMEOUT_SECONDS RUN_AGENT_SMOKE_TEST AGENT_SMOKE_TEST_TIMEOUT_SECONDS
  export GCP_NETWORK_NAME GCP_SUBNET_NAME
  export GCP_SUBNET_RANGE VM_NAME VM_TAG VM_SERVICE_ACCOUNT_NAME VM_SERVICE_ACCOUNT_EMAIL
  export IMAGE_FAMILY IMAGE_PROJECT COMPOSE_PROJECT_NAME GOOGLE_GENAI_API_KEY
  export GEMINI_API_KEY GOOGLE_API_KEY
}

gcloud_project() {
  gcloud --project "$GCP_PROJECT_ID" "$@"
}

gcloud_ssh() {
  local command="$1"
  gcloud compute ssh "$VM_NAME" \
    --project "$GCP_PROJECT_ID" \
    --zone "$GCP_ZONE" \
    --quiet \
    --command "$command"
}

gcloud_scp_to_vm() {
  local local_path="$1"
  local remote_path="$2"
  gcloud compute scp "$local_path" "$VM_NAME:$remote_path" \
    --project "$GCP_PROJECT_ID" \
    --zone "$GCP_ZONE" \
    --quiet
}

vm_external_ip() {
  gcloud_project compute instances describe "$VM_NAME" \
    --zone "$GCP_ZONE" \
    --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
}

print_config_summary() {
  log "Project: $GCP_PROJECT_ID"
  log "Region/zone: $GCP_REGION / $GCP_ZONE"
  log "VM: $VM_NAME ($MACHINE_TYPE, $BOOT_DISK_SIZE)"
  log "Network: $GCP_NETWORK_NAME / $GCP_SUBNET_NAME"
  log "Remote app dir: $REMOTE_APP_DIR"
}
