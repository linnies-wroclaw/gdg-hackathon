#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$DEPLOYMENT_DIR/lib/common.sh"

usage() {
  cat <<EOF
Usage: bash deploy.sh [--env-file PATH] [--skip-smoke]

Creates or updates a Compute Engine VM and runs the existing Docker Compose app.

Options:
  --env-file PATH  Env file to load. Default: deployment/gcloud/.env
  --skip-smoke     Skip the final remote smoke test.
  -h, --help       Show this help.
EOF
}

ENV_FILE="${DEPLOY_ENV_FILE:-$DEPLOYMENT_DIR/.env}"
SKIP_SMOKE="${SKIP_SMOKE:-false}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      [[ -n "$ENV_FILE" ]] || die "--env-file requires a path."
      shift 2
      ;;
    --skip-smoke)
      SKIP_SMOKE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

load_config "$ENV_FILE"

# shellcheck source=scripts/10-prerequisites.sh
source "$DEPLOYMENT_DIR/scripts/10-prerequisites.sh"
# shellcheck source=scripts/20-apis.sh
source "$DEPLOYMENT_DIR/scripts/20-apis.sh"
# shellcheck source=scripts/30-network.sh
source "$DEPLOYMENT_DIR/scripts/30-network.sh"
# shellcheck source=scripts/40-service-account.sh
source "$DEPLOYMENT_DIR/scripts/40-service-account.sh"
# shellcheck source=scripts/50-vm.sh
source "$DEPLOYMENT_DIR/scripts/50-vm.sh"
# shellcheck source=scripts/60-sync.sh
source "$DEPLOYMENT_DIR/scripts/60-sync.sh"
# shellcheck source=scripts/70-compose.sh
source "$DEPLOYMENT_DIR/scripts/70-compose.sh"
# shellcheck source=scripts/80-smoke-test.sh
source "$DEPLOYMENT_DIR/scripts/80-smoke-test.sh"

print_config_summary
require_local_prerequisites
enable_gcp_apis
ensure_network
ensure_service_account
ensure_vm
wait_for_vm_ssh
sync_application
write_remote_env
install_remote_runtime
deploy_compose_stack

if is_true "$SKIP_SMOKE"; then
  warn "Skipping smoke test."
else
  run_smoke_test
fi
