#!/bin/sh
set -eu

cat >/dev/null || true

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"

if ! bun run compile; then
  echo "Stop blocked: bun run compile failed. Fix the type errors before ending the task." >&2
  exit 2
fi

if ! bun run quality; then
  echo "Stop blocked: bun run quality failed. Fix the reported issues before ending the task." >&2
  exit 2
fi

react_doctor_output="$(mktemp "${TMPDIR:-/tmp}/react-doctor.XXXXXX")"
trap 'rm -f "$react_doctor_output"' EXIT HUP INT TERM

if ! npx -y react-doctor@latest . --verbose >"$react_doctor_output" 2>&1; then
  cat "$react_doctor_output" >&2
  echo "Stop blocked: react-doctor failed. Fix the reported issues before ending the task." >&2
  exit 2
fi

if grep -q "100 / 100" "$react_doctor_output"; then
  cat "$react_doctor_output"
  exit 0
fi

cat "$react_doctor_output" >&2
echo "Stop blocked: react-doctor is not 100/100. Continue fixing until 'npx -y react-doctor@latest . --verbose' reports 100 / 100." >&2
exit 2
