#!/usr/bin/env bash
set -euo pipefail

source_sha="${SOURCE_SHA:-}"
if [[ -z "${source_sha}" ]]; then
  echo "::error::SOURCE_SHA is required."
  exit 1
fi

git checkout --force "${source_sha}"
