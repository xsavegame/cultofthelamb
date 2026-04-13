#!/usr/bin/env bash
set -euo pipefail

worktree_path="${WORKTREE_PATH:-}"
if [[ -z "${worktree_path}" ]]; then
  exit 0
fi

git worktree remove --force "${worktree_path}" || true
