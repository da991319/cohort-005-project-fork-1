#!/bin/sh
# Serves another ref of the app beside your working copy, so you can take a
# "before" screenshot without leaving your branch. It checks the ref out into a
# throwaway worktree that shares node_modules and a copy of data.db, and
# removes the worktree when the server stops.
# Usage: sh scripts/serve-base.sh [ref] [port]   (default: origin/main 5174)

set -eu

ref=${1:-origin/main}
port=${2:-5174}
root=$(pwd)
dir=$(mktemp -d "${TMPDIR:-/tmp}/serve-base-XXXXXX")
child=

cleanup() {
  if [ -n "$child" ]; then kill "$child" 2>/dev/null || true; fi
  git -C "$root" worktree remove --force "$dir" 2>/dev/null || true
  rm -rf "$dir"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

git worktree add --detach --quiet "$dir" "$ref"
ln -s "$root/node_modules" "$dir/node_modules"
for file in data.db data.db-wal data.db-shm .env; do
  if [ -f "$root/$file" ]; then cp "$root/$file" "$dir/$file"; fi
done

cd "$dir"
echo "Serving $ref from $dir on http://localhost:$port"
"$root/node_modules/.bin/react-router" dev --port "$port" --strictPort &
child=$!
wait "$child"
