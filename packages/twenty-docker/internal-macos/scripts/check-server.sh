#!/bin/zsh

set -euo pipefail

SCRIPT_DIRECTORY="${0:A:h}"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env"

if [[ ! -f "${ENVIRONMENT_FILE}" ]]; then
  print -u2 "Prepare the environment first."
  exit 1
fi

set -a
source "${ENVIRONMENT_FILE}"
set +a

curl \
  --connect-timeout 10 \
  --fail \
  --max-time 30 \
  --retry 12 \
  --retry-all-errors \
  --retry-delay 5 \
  --show-error \
  --silent \
  "${SERVER_URL}/healthz"
print
