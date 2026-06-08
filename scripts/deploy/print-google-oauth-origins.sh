#!/usr/bin/env bash
# Muestra los orígenes JavaScript que debes añadir al OAuth 2.0 Web Client en GCP.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

ensure_gcloud_on_path || true
gcloud_require_auth 2>/dev/null || true

FRONTEND_URL="$(cloud_run_url "$SERVICE_FRONTEND" 2>/dev/null || true)"
PROJECT_NUM="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)' 2>/dev/null || echo '240510895601')"
FRONTEND_URL_ALT="https://${SERVICE_FRONTEND}-${PROJECT_NUM}.${GCP_REGION}.run.app"

CONSOLE="https://console.cloud.google.com/auth/clients?project=${GCP_PROJECT_ID}"

echo ""
echo "=== Google Sign-In: orígenes JavaScript (OAuth 2.0 Web Client) ==="
echo "Consola: ${CONSOLE}"
echo "Cliente (GOOGLE_CLIENT_ID en .env): abre el cliente tipo \"Aplicación web\"."
echo "Añade en \"Orígenes autorizados de JavaScript\":"
echo "  - http://localhost:4200"
[[ -n "$FRONTEND_URL" ]] && echo "  - ${FRONTEND_URL}"
[[ -n "$FRONTEND_URL_ALT" ]] && echo "  - ${FRONTEND_URL_ALT}"
echo ""
echo "Guarda y espera 1-2 minutos antes de probar de nuevo."
echo ""
