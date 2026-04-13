#!/usr/bin/env bash
set -euo pipefail

for attempt in 1 2 3; do
  if git push origin gh-pages; then
    exit 0
  fi

  if [[ "$attempt" -eq 3 ]]; then
    echo "::error::Failed to push gh-pages after 3 attempts."
    exit 1
  fi

  git fetch origin gh-pages
  git rebase origin/gh-pages
done
