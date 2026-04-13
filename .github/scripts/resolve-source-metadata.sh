#!/usr/bin/env bash
set -euo pipefail

mode="${MODE:-}"
source_ref="${INITIAL_SOURCE_REF:-}"
source_sha="${INITIAL_SOURCE_SHA:-}"

if [[ "$mode" == "deploy" ]]; then
  if [[ -n "${RELEASE_SOURCE_REF:-}" ]]; then
    source_ref="${RELEASE_SOURCE_REF}"
  fi
  if [[ -n "${RELEASE_SOURCE_SHA:-}" ]]; then
    source_sha="${RELEASE_SOURCE_SHA}"
  fi

  if [[ -z "$source_sha" ]]; then
    source_sha="$(git rev-parse "${source_ref}^{commit}")"
  fi

  author_name="$(git show -s --format=%an "${source_sha}")"
  author_email="$(git show -s --format=%ae "${source_sha}")"
else
  author_name="${GITHUB_ACTOR}"
  author_email="${GITHUB_ACTOR}@users.noreply.github.com"
fi

{
  echo "source_ref=${source_ref}"
  echo "source_sha=${source_sha}"
  echo "author_name=${author_name}"
  echo "author_email=${author_email}"
} >> "$GITHUB_OUTPUT"
