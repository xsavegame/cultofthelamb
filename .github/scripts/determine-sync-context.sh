#!/usr/bin/env bash
set -euo pipefail

repo_name="${GITHUB_REPOSITORY#*/}"
mode="skip"
source_ref=""
source_sha=""
target_dir=""
segment=""
branch_name=""
base_url=""

is_valid_segment() {
  local value="$1"
  [[ -n "$value" ]] || return 1
  [[ "$value" != */* ]] || return 1
  [[ "$value" =~ ^[A-Za-z0-9._-]+$ ]]
}

if [[ "${GITHUB_EVENT_NAME}" == "release" ]]; then
  mode="deploy"
  source_ref="${RELEASE_TAG_NAME:-}"
  target_dir="docs/${repo_name}/latest"
  base_url="/${repo_name}/latest/"
elif [[ "${GITHUB_EVENT_NAME}" == "push" ]]; then
  branch_name="${GITHUB_REF_NAME}"
  if [[ "$branch_name" == experiments/* ]]; then
    segment="${branch_name#experiments/}"
    if is_valid_segment "$segment"; then
      mode="deploy"
      source_ref="$branch_name"
      source_sha="${GITHUB_SHA}"
      target_dir="docs/${repo_name}/experiments/${segment}"
      base_url="/${repo_name}/experiments/${segment}/"
    else
      mode="index_only"
    fi
  fi
elif [[ "${GITHUB_EVENT_NAME}" == "delete" ]]; then
  if [[ "${DELETE_REF_TYPE:-}" == "branch" ]]; then
    branch_name="${DELETE_REF_NAME:-}"
    if [[ "$branch_name" == experiments/* ]]; then
      segment="${branch_name#experiments/}"
      if is_valid_segment "$segment"; then
        mode="cleanup"
        target_dir="docs/${repo_name}/experiments/${segment}"
        base_url="/${repo_name}/experiments/${segment}/"
      else
        mode="index_only"
      fi
    fi
  fi
fi

if [[ -n "${EXPLICIT_BASE_URL:-}" ]]; then
  base_url="${EXPLICIT_BASE_URL}"
fi

{
  echo "repo_name=${repo_name}"
  echo "mode=${mode}"
  echo "source_ref=${source_ref}"
  echo "source_sha=${source_sha}"
  echo "target_dir=${target_dir}"
  echo "segment=${segment}"
  echo "branch_name=${branch_name}"
  echo "base_url=${base_url}"
} >> "$GITHUB_OUTPUT"
