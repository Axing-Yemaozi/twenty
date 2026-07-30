#!/bin/zsh

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIRECTORY="${0:A:h}"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
COMPOSE_FILE="${STACK_DIRECTORY}/compose.yaml"
ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env"

if [[ ! -f "${ENVIRONMENT_FILE}" ]]; then
  print -u2 "Missing ${ENVIRONMENT_FILE}. Run scripts/prepare-environment.sh first."
  exit 1
fi

exec docker compose \
  --env-file "${ENVIRONMENT_FILE}" \
  -f "${COMPOSE_FILE}" \
  "$@"
