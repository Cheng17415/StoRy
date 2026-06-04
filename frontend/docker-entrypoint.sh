#!/bin/sh
set -eu

PORT="${PORT:-8080}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8080}"
BACKEND_URL="${BACKEND_URL%/}"

export PORT BACKEND_URL
envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
