#!/usr/bin/env bash
set -euo pipefail

repository_url="${EXPLICIT_REPOSITORY_URL:-${DEFAULT_REPOSITORY_URL:-}}"
built_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "repository_url=${repository_url}"
  echo "built_date=${built_date}"
} >> "$GITHUB_OUTPUT"
