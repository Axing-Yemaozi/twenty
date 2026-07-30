#!/bin/zsh

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIRECTORY="${0:A:h}"
COMPOSE_SCRIPT="${SCRIPT_DIRECTORY}/compose.sh"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env"
TUNNEL_TOKEN_FILE="${STACK_DIRECTORY}/secrets/cloudflared-token"

if [[ ! -f "${ENVIRONMENT_FILE}" ]]; then
  print -u2 "Missing ${ENVIRONMENT_FILE}. Run scripts/prepare-environment.sh first."
  exit 1
fi

if [[ ! -s "${TUNNEL_TOKEN_FILE}" ]]; then
  print -u2 "Missing Cloudflare Tunnel token: ${TUNNEL_TOKEN_FILE}"
  exit 1
fi

set -a
source "${ENVIRONMENT_FILE}"
set +a

if ! docker info >/dev/null 2>&1 && [[ -d /Applications/Docker.app ]]; then
  open -gja Docker
fi

for attempt in {1..60}; do
  if docker info >/dev/null 2>&1; then
    if ! docker image inspect "${TWENTY_IMAGE}" >/dev/null 2>&1; then
      print -u2 "Missing local Twenty image: ${TWENTY_IMAGE}"
      exit 1
    fi

    "${COMPOSE_SCRIPT}" pull --policy missing db redis cloudflared
    "${COMPOSE_SCRIPT}" up -d --wait
    exit 0
  fi

  sleep 2
done

print -u2 "Docker did not become ready within 120 seconds."
exit 1
