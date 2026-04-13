#!/usr/bin/env bash
set -euo pipefail

worktree_path="${WORKTREE_PATH:-}"
if [[ -z "${worktree_path}" ]]; then
  echo "::error::WORKTREE_PATH is required."
  exit 1
fi

source_path="${worktree_path}/docs"
artifact_path="${GITHUB_WORKSPACE}/.pages-artifact"

if [[ ! -d "${source_path}" ]]; then
  echo "::error::Expected docs folder at ${source_path}."
  exit 1
fi

rm -rf "${artifact_path}"
mkdir -p "${artifact_path}"
cp -a "${source_path}/." "${artifact_path}/"

echo "path=${artifact_path}" >> "$GITHUB_OUTPUT"
