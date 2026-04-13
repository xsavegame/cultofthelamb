#!/usr/bin/env bash
set -euo pipefail

generate_experiments_metadata() {
  local experiments_dir="docs/${REPO_NAME}/experiments"
  local branches_json_file="${experiments_dir}/branches.json"

  mkdir -p "${experiments_dir}"

  mapfile -t branches < <(
    git ls-remote --heads origin "refs/heads/experiments/*" \
      | awk '{print $2}' \
      | sed 's#^refs/heads/##' \
      | sort
  )

  branch_list_file="$(mktemp)"
  printf "%s\n" "${branches[@]}" > "${branch_list_file}"

  REPO_NAME="${REPO_NAME}" \
  BRANCH_LIST_FILE="${branch_list_file}" \
  BRANCHES_JSON_FILE="${branches_json_file}" \
  node "${GITHUB_WORKSPACE}/.github/scripts/build-experiments-branches-json.mjs"

  rm -f "${branch_list_file}"
}

if [[ "${MODE}" == "deploy" ]]; then
  dist_dir="${GITHUB_WORKSPACE}/dist"
  if [[ ! -d "${dist_dir}" ]]; then
    echo "::error::dist folder does not exist for deploy mode."
    exit 1
  fi

  rm -rf "${TARGET_DIR}"
  mkdir -p "${TARGET_DIR}"
  cp -a "${dist_dir}/." "${TARGET_DIR}/"
elif [[ "${MODE}" == "cleanup" ]]; then
  rm -rf "${TARGET_DIR}"
fi

generate_experiments_metadata

git add -A
if git diff --cached --quiet; then
  echo "changed=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

commit_title="chore(pages): refresh experiments metadata"
if [[ "${MODE}" == "deploy" ]]; then
  commit_title="chore(pages): sync ${TARGET_DIR}"
elif [[ "${MODE}" == "cleanup" ]]; then
  commit_title="chore(pages): remove ${TARGET_DIR}"
elif [[ -n "${SOURCE_BRANCH_NAME:-}" ]]; then
  commit_title="chore(pages): refresh experiments metadata for ${SOURCE_BRANCH_NAME}"
fi

author_name="${SOURCE_AUTHOR_NAME:-${GITHUB_ACTOR}}"
author_email="${SOURCE_AUTHOR_EMAIL:-${GITHUB_ACTOR}@users.noreply.github.com}"

GIT_COMMITTER_NAME="github-actions[bot]" \
GIT_COMMITTER_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" \
git commit --author="${author_name} <${author_email}>" \
  -m "${commit_title}" \
  -m "Source Ref: ${SOURCE_REF:-n/a}" \
  -m "Source SHA: ${SOURCE_SHA:-n/a}"

echo "changed=true" >> "$GITHUB_OUTPUT"
