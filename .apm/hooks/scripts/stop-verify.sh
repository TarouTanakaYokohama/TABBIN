#!/bin/sh
set -eu

cat >/dev/null || true

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"

if bun run compile; then
  exit 0
fi

echo "Stop blocked: bun run compile failed. Fix the type errors before ending the task." >&2
exit 2
