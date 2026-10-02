#!/usr/bin/env bash
# Changes the Edge Function secrets of the HOSTED Supabase project, safely.
#
# Why this exists: run from inside this repo, `supabase secrets set` also picks
# up the local-only [edge_runtime.secrets] block in supabase/config.toml and
# overwrites hosted secrets with it (SMTP_HOST=inbucket, EMAIL_HOOK_SECRET=the
# local one, PUBLIC_API_URL=http://127.0.0.1:54321), which breaks sign-in emails.
# This script runs the CLI from an empty temporary folder, so there is no
# config.toml for it to find, and it only ever touches the project below.
#
# Usage (run `supabase login` once first):
#   scripts/hosted-secrets.sh list
#   scripts/hosted-secrets.sh set SITE_URL=https://kollide.in
#   scripts/hosted-secrets.sh unset SOME_NAME
#
# `list` prints names and fingerprints (SHA-256), never the values.
set -euo pipefail

PROJECT_REF=hehttlojshqmuszpzqsb

action="${1:-}"
case "$action" in
  list | set | unset) shift ;;
  *)
    echo "Usage: $0 list | set NAME=VALUE... | unset NAME..." >&2
    exit 2
    ;;
esac

if [ "$action" = set ] && [ "$#" -eq 0 ]; then
  echo "Nothing to set. Give NAME=VALUE pairs." >&2
  exit 2
fi
for arg in "$@"; do
  case "$arg" in
    --env-file | --env-file=* | --workdir | --workdir=*)
      echo "Refusing $arg: it could read files from this repo." >&2
      exit 2
      ;;
  esac
done

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
npx --prefix "$repo/web" supabase secrets "$action" --project-ref "$PROJECT_REF" "$@"
