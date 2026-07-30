#!/bin/zsh

set -euo pipefail

SCRIPT_DIRECTORY="${0:A:h}"
"${SCRIPT_DIRECTORY}/compose.sh" down
