#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$DEPLOYMENT_DIR/lib/common.sh"

usage() {
  cat <<EOF
Usage: bash destroy.sh [--env-file PATH] [--yes]

Deletes the Google Cloud resources created by deploy.sh.

Options:
  --env-file PATH  Env file to load. Default: deployment/gcloud/.env
  --yes            Do not prompt for confirmation.
  -h, --help       Show this help.
EOF
}

ENV_FILE="${DEPLOY_ENV_FILE:-$DEPLOYMENT_DIR/.env}"
ASSUME_YES="${DESTROY_CONFIRM:-false}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      [[ -n "$ENV_FILE" ]] || die "--env-file requires a path."
      shift 2
      ;;
    --yes|-y)
      ASSUME_YES=true
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
# shellcheck source=scripts/90-destroy.sh
source "$DEPLOYMENT_DIR/scripts/90-destroy.sh"

print_config_summary
require_local_prerequisites

if ! is_true "$ASSUME_YES"; then
  printf 'This will delete VM/network resources for "%s" in project "%s". Type "%s" to continue: ' "$APP_NAME" "$GCP_PROJECT_ID" "$APP_NAME"
  read -r confirmation
  [[ "$confirmation" == "$APP_NAME" ]] || die "Destroy cancelled."
fi

destroy_resources
