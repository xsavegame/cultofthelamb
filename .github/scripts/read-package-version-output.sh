#!/usr/bin/env bash
set -euo pipefail

package_file="${PACKAGE_FILE:-package.json}"
app_version="$(node "${GITHUB_WORKSPACE}/.github/scripts/read-package-version.mjs" "${package_file}")"
echo "value=${app_version}" >> "$GITHUB_OUTPUT"
