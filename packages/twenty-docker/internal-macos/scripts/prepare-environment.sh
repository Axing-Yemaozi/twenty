#!/bin/zsh

set -euo pipefail

SCRIPT_DIRECTORY="${0:A:h}"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
SOURCE_ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env.example"
TARGET_ENVIRONMENT_FILE="${STACK_DIRECTORY}/.env"

if [[ -e "${TARGET_ENVIRONMENT_FILE}" ]]; then
  print -u2 "Refusing to overwrite ${TARGET_ENVIRONMENT_FILE}."
  exit 1
fi

DATABASE_PASSWORD="$(openssl rand -hex 24)"
ENCRYPTION_KEY_VALUE="$(openssl rand -hex 32)"
APP_SECRET_VALUE="$(openssl rand -hex 32)"
TEMPORARY_ENVIRONMENT_FILE="$(mktemp)"
BACKUP_DIRECTORY="${STACK_DIRECTORY}/backups"
SECRET_DIRECTORY="${STACK_DIRECTORY}/secrets"
TUNNEL_TOKEN_FILE="${SECRET_DIRECTORY}/cloudflared-token"

trap 'rm -f "${TEMPORARY_ENVIRONMENT_FILE}"' EXIT

awk \
  -v databasePassword="${DATABASE_PASSWORD}" \
  -v encryptionKey="${ENCRYPTION_KEY_VALUE}" \
  -v appSecret="${APP_SECRET_VALUE}" \
  -v backupDirectory="${BACKUP_DIRECTORY}" \
  '{
    sub(/^PG_DATABASE_PASSWORD=.*/, "PG_DATABASE_PASSWORD=" databasePassword)
    sub(/^ENCRYPTION_KEY=.*/, "ENCRYPTION_KEY=" encryptionKey)
    sub(/^APP_SECRET=.*/, "APP_SECRET=" appSecret)
    sub(/^BACKUP_DESTINATION=.*/, "BACKUP_DESTINATION=" backupDirectory)
    print
  }' \
  "${SOURCE_ENVIRONMENT_FILE}" > "${TEMPORARY_ENVIRONMENT_FILE}"

install -m 600 "${TEMPORARY_ENVIRONMENT_FILE}" "${TARGET_ENVIRONMENT_FILE}"
mkdir -p -m 700 "${BACKUP_DIRECTORY}" "${SECRET_DIRECTORY}"

if [[ ! -e "${TUNNEL_TOKEN_FILE}" ]]; then
  install -m 600 /dev/null "${TUNNEL_TOKEN_FILE}"
fi

print "Created ${TARGET_ENVIRONMENT_FILE}."
print "Add the Cloudflare Tunnel token to ${TUNNEL_TOKEN_FILE} before starting."
