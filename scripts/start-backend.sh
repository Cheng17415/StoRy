#!/usr/bin/env bash
set -euo pipefail

# Inicia el backend Spring Boot (perfil dev → Postgres en Supabase).
# Uso: ./scripts/start-backend.sh  (desde cualquier directorio)
# Requiere .env con SPRING_DATASOURCE_* (y opcionalmente GOOGLE_CLIENT_ID, RESEND_*).

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

# macOS Homebrew installa OpenJDK 17 como "keg-only" (sin java en PATH). El proyecto usa Java 17 (pom.xml).
# /usr/bin/java existe como stub sin JRE real; comprobar que java -version funcione, no solo command -v.
java_usable() {
  command -v java >/dev/null 2>&1 && java -version >/dev/null 2>&1
}
if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]] && "${JAVA_HOME}/bin/java" -version >/dev/null 2>&1; then
  :
elif java_usable; then
  :
else
  for jdk in "/opt/homebrew/opt/openjdk@17" "/usr/local/opt/openjdk@17"; do
    if [[ -x "${jdk}/bin/java" ]]; then
      export JAVA_HOME="$jdk"
      export PATH="${JAVA_HOME}/bin:${PATH}"
      break
    fi
  done
fi
if ! java_usable; then
  echo "Error: JDK 17 no encontrado. Instala con: brew install openjdk@17" >&2
  exit 1
fi

BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"
cd "$BACKEND_DIR"
echo "Directorio: $BACKEND_DIR"
exec ./mvnw spring-boot:run "$@"
