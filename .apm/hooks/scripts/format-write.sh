#!/bin/sh
set -eu

cat >/dev/null || true

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"

bun run format
