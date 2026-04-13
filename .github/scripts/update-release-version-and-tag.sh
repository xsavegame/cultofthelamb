#!/usr/bin/env bash
set -euo pipefail

tag_name="${RELEASE_TAG_NAME:-}"
target_branch="${RELEASE_TARGET_BRANCH:-}"
target_branch="${target_branch#refs/heads/}"
release_version="${tag_name#v}"

if [[ -z "$tag_name" ]]; then
  echo "::error::RELEASE_TAG_NAME is required."
  exit 1
fi

if [[ -z "$target_branch" ]]; then
  echo "::error::RELEASE_TARGET_BRANCH is required."
  exit 1
fi

if ! [[ "$release_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::Release tag '${tag_name}' does not contain a valid semver version."
  exit 1
fi

if ! git ls-remote --exit-code --heads origin "refs/heads/${target_branch}" >/dev/null 2>&1; then
  echo "::error::release.target_commitish '${target_branch}' is not a branch in origin."
  exit 1
fi

git fetch origin "refs/heads/${target_branch}:refs/heads/${target_branch}" --tags

original_tag_sha="$(git rev-parse "${tag_name}^{commit}")"
source_author_name="$(git show -s --format=%an "${original_tag_sha}")"
source_author_email="$(git show -s --format=%ae "${original_tag_sha}")"

git checkout "${target_branch}"

node "${GITHUB_WORKSPACE}/.github/scripts/set-package-version.mjs" "${release_version}" "package.json"

if git diff --quiet -- package.json; then
  new_source_sha="${original_tag_sha}"
else
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git add package.json
  git commit --author="${source_author_name} <${source_author_email}>" -m "chore(release): bump version to ${release_version}"
  git push origin "HEAD:${target_branch}"
  new_source_sha="$(git rev-parse HEAD)"
fi

git tag -f "${tag_name}" "${new_source_sha}"
git push origin "refs/tags/${tag_name}" --force

{
  echo "source_sha=${new_source_sha}"
  echo "source_ref=${tag_name}"
} >> "$GITHUB_OUTPUT"
