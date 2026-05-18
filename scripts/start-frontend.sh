#!/usr/bin/env bash
set -euo pipefail

# Inicia el frontend Angular (puerto 4200, proxy a http://localhost:8080).
# Uso: ./scripts/start-frontend.sh  (desde cualquier directorio)
# Si existe .env en la raíz del repo, carga variables (útil si otras herramientas las leen).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

load_dotenv() {
  local env_path="$1"
  [[ -f "$env_path" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ -z "$key" ]] && continue
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ ${#val} -ge 2 ]]; then
      local fc="${val:0:1}"
      local lc="${val:$((${#val}-1)):1}"
      if [[ ( "$fc" == '"' && "$lc" == '"' ) || ( "$fc" == "'" && "$lc" == "'" ) ]]; then
        val="${val:1:$((${#val}-2))}"
      fi
    fi
    export "${key}=${val}"
  done < "$env_path"
}

load_dotenv "$ENV_FILE"

FRONTEND_DIR="$(cd "$SCRIPT_DIR/../frontend" && pwd)"
cd "$FRONTEND_DIR"
if [[ ! -x ./node_modules/.bin/ng ]]; then
  echo "No está instalado Angular CLI local (node_modules)." >&2
  echo "Ejecuta: cd \"$FRONTEND_DIR\" && npm install" >&2
  exit 1
fi
echo "Directorio: $FRONTEND_DIR"
echo "Google Sign-In: configura GOOGLE_CLIENT_ID en .env y arranca el backend; el cliente lee /api/auth/google-config."
exec npm run start -- "$@"
