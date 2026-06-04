#!/usr/bin/env bash
# Shared helpers for Cloud Run deploy (bash on macOS, Git Bash on Windows).
set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-project-452b770b-b27a-4122-982}"
GCP_REGION="${GCP_REGION:-europe-west1}"
ARTIFACT_REPO="${ARTIFACT_REPO:-story}"
SERVICE_BACKEND="${SERVICE_BACKEND:-story-backend}"
SERVICE_FRONTEND="${SERVICE_FRONTEND:-story-frontend}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"

registry_image() {
  local name="$1"
  echo "${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPO}/${name}"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: no se encontró '$cmd' en PATH." >&2
    exit 1
  fi
}

# Windows Git Bash: gcloud suele instalarse fuera del PATH de la sesión.
ensure_gcloud_on_path() {
  if command -v gcloud >/dev/null 2>&1; then
    return 0
  fi
  local -a candidates=()
  if [[ -n "${LOCALAPPDATA:-}" ]]; then
    candidates+=("$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk/bin")
  fi
  if [[ -n "${ProgramFiles:-}" ]]; then
    candidates+=("$ProgramFiles/Google/Cloud SDK/google-cloud-sdk/bin")
  fi
  candidates+=(
    "/c/Program Files/Google/Cloud SDK/google-cloud-sdk/bin"
    "$HOME/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
  )
  local dir
  for dir in "${candidates[@]}"; do
    [[ -d "$dir" ]] || continue
    if [[ -f "$dir/gcloud.cmd" || -f "$dir/gcloud" ]]; then
      export PATH="$dir:$PATH"
      return 0
    fi
  done
  return 1
}

# Session pooler (5432) → transaction pooler (6543) + prepareThreshold=0 (PgBouncer/Supabase).
cloudrun_datasource_url() {
  load_dotenv "$ENV_FILE"
  local url="${SPRING_DATASOURCE_URL:-}"
  if [[ "$url" == *":5432/"* ]]; then
    url="${url/:5432\//:6543/}"
  fi
  if [[ "$url" != *prepareThreshold* ]]; then
    if [[ "$url" == *\?* ]]; then
      url="${url}&prepareThreshold=0"
    else
      url="${url}?prepareThreshold=0"
    fi
  fi
  printf '%s' "$url"
}

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

yaml_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

# Writes gcloud --env-vars-file YAML from .env plus optional KEY=VAL overrides.
write_env_vars_file() {
  local out_file="$1"
  shift
  : >"$out_file"
  if [[ -f "$ENV_FILE" ]]; then
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
      # Cloud Run reserva PORT; el contenedor ya usa server.port=${PORT:8080}
      [[ "$key" == "PORT" ]] && continue
      val="${val#"${val%%[![:space:]]*}"}"
      val="${val%"${val##*[![:space:]]}"}"
      if [[ ${#val} -ge 2 ]]; then
        local fc="${val:0:1}"
        local lc="${val:$((${#val}-1)):1}"
        if [[ ( "$fc" == '"' && "$lc" == '"' ) || ( "$fc" == "'" && "$lc" == "'" ) ]]; then
          val="${val:1:$((${#val}-2))}"
        fi
      fi
      printf '%s: "%s"\n' "$key" "$(yaml_escape "$val")" >>"$out_file"
    done < "$ENV_FILE"
  fi
  local override
  for override in "$@"; do
    [[ "$override" != *"="* ]] && continue
    local okey="${override%%=*}"
    local oval="${override#*=}"
    local tmp_override
    tmp_override="$(mktemp)"
    if [[ -f "$out_file" ]]; then
      grep -v "^${okey}:" "$out_file" >"$tmp_override" 2>/dev/null || true
    fi
    printf '%s: "%s"\n' "$okey" "$(yaml_escape "$oval")" >>"$tmp_override"
    mv "$tmp_override" "$out_file"
  done
}

gcloud_require_auth() {
  if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
    echo "Error: no hay cuenta activa en gcloud." >&2
    echo "Ejecuta: gcloud auth login" >&2
    echo "Luego: gcloud config set project ${GCP_PROJECT_ID}" >&2
    exit 1
  fi
}

gcloud_setup() {
  ensure_gcloud_on_path || true
  require_cmd gcloud
  gcloud_require_auth
  if ! docker_daemon_ready; then
    echo "Aviso: Docker local no disponible; se usará Cloud Build (USE_CLOUD_BUILD=1)."
    export USE_CLOUD_BUILD=1
  else
    require_cmd docker
  fi
  echo "Proyecto GCP: ${GCP_PROJECT_ID} (${GCP_REGION})"
  gcloud config set project "$GCP_PROJECT_ID" --quiet
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --quiet
  if ! gcloud artifacts repositories describe "$ARTIFACT_REPO" \
    --location="$GCP_REGION" >/dev/null 2>&1; then
    echo "Creando repositorio Artifact Registry: ${ARTIFACT_REPO}"
    gcloud artifacts repositories create "$ARTIFACT_REPO" \
      --repository-format=docker \
      --location="$GCP_REGION" \
      --description="StoRy Docker images" \
      --quiet
  fi
  gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
}

docker_daemon_ready() {
  docker info >/dev/null 2>&1
}

docker_build_push() {
  local context_dir="$1"
  local dockerfile="$2"
  local image="$3"
  echo "Construyendo imagen: ${image}"
  if [[ "${USE_CLOUD_BUILD:-}" == "1" ]] || ! docker_daemon_ready; then
    echo "Usando Cloud Build (Dockerfile remoto)..."
    gcloud builds submit "$context_dir" \
      --project="$GCP_PROJECT_ID" \
      --tag="$image" \
      --quiet
    return 0
  fi
  docker build -t "$image" -f "$dockerfile" "$context_dir"
  docker push "$image"
}

cloud_run_deploy() {
  local service="$1"
  local image="$2"
  local env_file="$3"
  local extra_args=()
  if [[ "${CLOUD_RUN_NO_TRAFFIC:-}" == "1" ]]; then
    extra_args+=(--no-traffic)
  fi
  gcloud run deploy "$service" \
    --image="$image" \
    --region="$GCP_REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=3 \
    --timeout=300 \
    --cpu-boost \
    --env-vars-file="$env_file" \
    "${extra_args[@]}" \
    --quiet
}

cloud_run_url() {
  local service="$1"
  gcloud run services describe "$service" \
    --region="$GCP_REGION" \
    --platform=managed \
    --format='value(status.url)'
}
