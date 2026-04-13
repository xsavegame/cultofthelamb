#!/usr/bin/env bash
set -euo pipefail

gh_pages_dir="${RUNNER_TEMP}/gh-pages-worktree"
rm -rf "${gh_pages_dir}"
git fetch origin gh-pages --no-tags >/dev/null 2>&1 || true

git branch -D gh-pages >/dev/null 2>&1 || true
if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  git worktree add -B gh-pages "${gh_pages_dir}" refs/remotes/origin/gh-pages
else
  git worktree add --detach "${gh_pages_dir}"
  pushd "${gh_pages_dir}" >/dev/null
  git checkout --orphan gh-pages
  git rm -rf . >/dev/null 2>&1 || true
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  popd >/dev/null
fi

echo "path=${gh_pages_dir}" >> "$GITHUB_OUTPUT"
