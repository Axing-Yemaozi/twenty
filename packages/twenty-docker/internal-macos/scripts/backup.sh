#!/bin/zsh

set -euo pipefail
umask 077

SCRIPT_DIRECTORY="${0:A:h}"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env"

if [[ ! -f "${ENVIRONMENT_FILE}" ]]; then
  print -u2 "Missing ${ENVIRONMENT_FILE}."
  exit 1
fi

set -a
source "${ENVIRONMENT_FILE}"
set +a

if [[ -z "${BACKUP_DESTINATION:-}" || "${BACKUP_DESTINATION}" != /* || "${BACKUP_DESTINATION}" == "/" ]]; then
  print -u2 "BACKUP_DESTINATION must be a non-root absolute path."
  exit 1
fi

if [[ ! "${BACKUP_RETENTION_DAYS:-}" =~ '^[0-9]+$' ]]; then
  print -u2 "BACKUP_RETENTION_DAYS must be a non-negative integer."
  exit 1
fi

if [[ ! "${PG_DATABASE_USER}" =~ '^[A-Za-z0-9_]+$' || ! "${PG_DATABASE_NAME}" =~ '^[A-Za-z0-9_]+$' ]]; then
  print -u2 "PG_DATABASE_USER and PG_DATABASE_NAME must contain only letters, numbers, and underscores."
  exit 1
fi

if [[ ! -d "${BACKUP_DESTINATION}" ]]; then
  print -u2 "Backup destination is unavailable: ${BACKUP_DESTINATION}"
  exit 1
fi

BACKUP_DIRECTORY="${BACKUP_DESTINATION}/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 "${BACKUP_DIRECTORY}"

"${SCRIPT_DIRECTORY}/compose.sh" exec -T db \
  pg_dump \
  --username "${PG_DATABASE_USER}" \
  --dbname "${PG_DATABASE_NAME}" \
  --format custom > "${BACKUP_DIRECTORY}/database.dump"

"${SCRIPT_DIRECTORY}/compose.sh" exec -T server \
  tar -C /app/packages/twenty-server -czf - .local-storage \
  > "${BACKUP_DIRECTORY}/local-storage.tgz"

install -m 600 "${ENVIRONMENT_FILE}" "${BACKUP_DIRECTORY}/environment.env"
install -m 600 "${STACK_DIRECTORY}/compose.yaml" "${BACKUP_DIRECTORY}/compose.yaml"

(
  cd "${BACKUP_DIRECTORY}"
  shasum -a 256 \
    database.dump \
    local-storage.tgz \
    environment.env \
    compose.yaml \
    > SHA256SUMS
)

find "${BACKUP_DESTINATION}" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -name '20????????T??????Z' \
  -mtime "+${BACKUP_RETENTION_DAYS}" \
  -exec rm -rf -- {} +

print "Backup completed: ${BACKUP_DIRECTORY}"
