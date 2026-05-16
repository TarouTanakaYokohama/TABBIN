---
description: RTK routing rules for compact shell command output.
applyTo: "**/*"
---

@/Users/tarou/.codex/RTK.md

# RTK usage in this repository

RTK is installed for Codex shell output compaction. Use it for shell commands when a shell command is appropriate:

- Prefer `rtk git status`, `rtk git diff`, `rtk rg`, `rtk find`, `rtk bun run test`, and similar compact wrappers.
- Keep `context-mode` routing rules higher priority. RTK does not permit forbidden commands such as raw `curl` / `wget`, inline HTTP fetches, or dumping large command output directly into context.
- If a command must be analyzed, counted, filtered, compared, searched, parsed, or transformed, still use `ctx_execute` / `ctx_batch_execute` and write code to print only the answer.
- If RTK hides details needed to debug a failure, use the appropriate unfiltered route intentionally, such as `rtk proxy <cmd>` or a targeted `ctx_execute` script that prints the specific evidence needed.
