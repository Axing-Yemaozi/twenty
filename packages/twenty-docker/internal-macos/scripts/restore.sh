#!/bin/zsh

set -euo pipefail
umask 077

if [[ $# -ne 2 || "$2" != "--confirm" ]]; then
  print -u2 "Usage: $0 /absolute/path/to/backup --confirm"
  exit 1
fi

BACKUP_DIRECTORY="${1:A}"
SCRIPT_DIRECTORY="${0:A:h}"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env"

if [[ \
  ! -f "${BACKUP_DIRECTORY}/database.dump" || \
  ! -f "${BACKUP_DIRECTORY}/local-storage.tgz" \
]]; then
  print -u2 "The selected directory is not a complete Twenty backup."
  exit 1
fi

if [[ ! -f "${ENVIRONMENT_FILE}" ]]; then
  print -u2 "Missing active environment file: ${ENVIRONMENT_FILE}"
  exit 1
fi

set -a
source "${ENVIRONMENT_FILE}"
set +a

if [[ ! "${PG_DATABASE_USER}" =~ '^[A-Za-z0-9_]+$' || ! "${PG_DATABASE_NAME}" =~ '^[A-Za-z0-9_]+$' ]]; then
  print -u2 "PG_DATABASE_USER and PG_DATABASE_NAME must contain only letters, numbers, and underscores."
  exit 1
fi

if [[ -f "${BACKUP_DIRECTORY}/SHA256SUMS" ]]; then
  (cd "${BACKUP_DIRECTORY}" && shasum -a 256 -c SHA256SUMS)
fi

"${SCRIPT_DIRECTORY}/compose.sh" stop cloudflared server worker

"${SCRIPT_DIRECTORY}/compose.sh" exec -T db psql \
  --username "${PG_DATABASE_USER}" \
  --dbname postgres \
  --set ON_ERROR_STOP=1 \
  --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PG_DATABASE_NAME}' AND pid <> pg_backend_pid();"
"${SCRIPT_DIRECTORY}/compose.sh" exec -T db dropdb \
  --username "${PG_DATABASE_USER}" \
  --if-exists "${PG_DATABASE_NAME}"
"${SCRIPT_DIRECTORY}/compose.sh" exec -T db createdb \
  --username "${PG_DATABASE_USER}" \
  "${PG_DATABASE_NAME}"
"${SCRIPT_DIRECTORY}/compose.sh" exec -T db pg_restore \
  --username "${PG_DATABASE_USER}" \
  --dbname "${PG_DATABASE_NAME}" \
  --no-owner \
  --exit-on-error < "${BACKUP_DIRECTORY}/database.dump"

"${SCRIPT_DIRECTORY}/compose.sh" run --rm -T --no-deps --entrypoint sh server \
  -c 'find /app/packages/twenty-server/.local-storage -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /app/packages/twenty-server -xzf -' \
  < "${BACKUP_DIRECTORY}/local-storage.tgz"

"${SCRIPT_DIRECTORY}/compose.sh" up -d --wait server worker cloudflared
print "Restore completed from ${BACKUP_DIRECTORY}."
