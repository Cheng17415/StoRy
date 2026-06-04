#!/usr/bin/env bash
set -euo pipefail

# Despliega story-backend en Cloud Run (Docker).
# Uso: ./scripts/deploy/deploy-backend.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

gcloud_setup

IMAGE="$(registry_image "${SERVICE_BACKEND}"):$(date +%Y%m%d%H%M%S)"
IMAGE_LATEST="$(registry_image "${SERVICE_BACKEND}"):latest"

ENV_YAML="$(mktemp)"
trap 'rm -f "$ENV_YAML"' EXIT

TX_URL="$(cloudrun_datasource_url)"
write_env_vars_file "$ENV_YAML" \
  "SPRING_PROFILES_ACTIVE=cloudrun,dev" \
  "SPRING_DATASOURCE_URL=${TX_URL}"

docker_build_push "$REPO_ROOT/backend" "$REPO_ROOT/backend/Dockerfile" "$IMAGE"
if docker_daemon_ready; then
  docker tag "$IMAGE" "$IMAGE_LATEST"
  docker push "$IMAGE_LATEST"
fi

# Despliega sin tráfico para no agotar el pool de Supabase con dos revisiones a la vez.
CLOUD_RUN_NO_TRAFFIC=1 cloud_run_deploy "$SERVICE_BACKEND" "$IMAGE" "$ENV_YAML"

NEW_REV="$(gcloud run revisions list --service="$SERVICE_BACKEND" --region="$GCP_REGION" \
  --platform=managed --sort-by="~metadata.creationTimestamp" --limit=1 --format='value(metadata.name)')"
echo "Comprobando revisión ${NEW_REV}..."
for i in $(seq 1 30); do
  STATUS="$(gcloud run revisions describe "$NEW_REV" --region="$GCP_REGION" --platform=managed \
    --format='value(status.conditions[0].status)' 2>/dev/null || echo "Unknown")"
  if [[ "$STATUS" == "True" ]]; then
    break
  fi
  if [[ "$STATUS" == "False" ]]; then
    echo "Error: la revisión ${NEW_REV} no arrancó. Revisa Cloud Logging." >&2
    exit 1
  fi
  sleep 5
done

gcloud run services update-traffic "$SERVICE_BACKEND" \
  --region="$GCP_REGION" \
  --platform=managed \
  --to-revisions="${NEW_REV}=100" \
  --quiet

URL="$(cloud_run_url "$SERVICE_BACKEND")"
echo ""
echo "Backend desplegado: ${SERVICE_BACKEND}"
echo "URL: ${URL}"
echo "Health: ${URL}/actuator/health"
