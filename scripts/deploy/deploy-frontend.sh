#!/usr/bin/env bash
set -euo pipefail

# Despliega story-frontend en Cloud Run (Docker + nginx proxy al backend).
# Uso: ./scripts/deploy/deploy-frontend.sh
# Requiere story-backend ya desplegado (o BACKEND_URL en el entorno).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

gcloud_setup

BACKEND_URL="${BACKEND_URL:-}"
if [[ -z "$BACKEND_URL" ]]; then
  BACKEND_URL="$(cloud_run_url "$SERVICE_BACKEND" 2>/dev/null || true)"
fi
if [[ -z "$BACKEND_URL" ]]; then
  echo "Error: no se pudo obtener la URL del backend." >&2
  echo "Despliega primero: ./scripts/deploy/deploy-backend.sh" >&2
  echo "O define BACKEND_URL=https://..." >&2
  exit 1
fi
BACKEND_URL="${BACKEND_URL%/}"
echo "Backend URL para proxy nginx: ${BACKEND_URL}"

IMAGE="$(registry_image "${SERVICE_FRONTEND}"):$(date +%Y%m%d%H%M%S)"
IMAGE_LATEST="$(registry_image "${SERVICE_FRONTEND}"):latest"

ENV_YAML="$(mktemp)"
trap 'rm -f "$ENV_YAML"' EXIT

write_env_vars_file "$ENV_YAML" \
  "BACKEND_URL=${BACKEND_URL}"

docker_build_push "$REPO_ROOT/frontend" "$REPO_ROOT/frontend/Dockerfile" "$IMAGE"
if docker_daemon_ready; then
  docker tag "$IMAGE" "$IMAGE_LATEST"
  docker push "$IMAGE_LATEST"
fi

cloud_run_deploy "$SERVICE_FRONTEND" "$IMAGE" "$ENV_YAML"

FRONTEND_URL="$(cloud_run_url "$SERVICE_FRONTEND")"
echo ""
echo "Frontend desplegado: ${SERVICE_FRONTEND}"
echo "URL: ${FRONTEND_URL}"

# Solo añade CORS/invitaciones; no reemplaza todo el .env (evita revisiones rotas).
echo "Actualizando CORS e invitaciones en ${SERVICE_BACKEND}..."
gcloud run services update "$SERVICE_BACKEND" \
  --region="$GCP_REGION" \
  --platform=managed \
  --update-env-vars="APP_CORS_ALLOWED_ORIGINS=${FRONTEND_URL},APP_COMPANY_INVITE_URL_BASE=${FRONTEND_URL}/empresa?inviteToken=" \
  --quiet

echo ""
echo "Listo. Abre: ${FRONTEND_URL}"
