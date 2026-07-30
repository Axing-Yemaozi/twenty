#!/bin/zsh

set -euo pipefail

SCRIPT_DIRECTORY="${0:A:h}"
STACK_DIRECTORY="${SCRIPT_DIRECTORY:h}"
LAUNCH_AGENT_DIRECTORY="${HOME}/Library/LaunchAgents"

mkdir -p "${LAUNCH_AGENT_DIRECTORY}"

for label in com.twenty.internal.stack com.twenty.internal.backup; do
  TEMPLATE_PATH="${SCRIPT_DIRECTORY}/${label}.plist.template"
  TARGET_PATH="${LAUNCH_AGENT_DIRECTORY}/${label}.plist"
  ESCAPED_STACK_DIRECTORY="${STACK_DIRECTORY//\//\\/}"

  sed "s/__STACK_DIRECTORY__/${ESCAPED_STACK_DIRECTORY}/g" \
    "${TEMPLATE_PATH}" > "${TARGET_PATH}"
  plutil -lint "${TARGET_PATH}"

  launchctl bootout "gui/${UID}" "${TARGET_PATH}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/${UID}" "${TARGET_PATH}"
done

print "Installed Twenty launch agents for the current macOS user."
