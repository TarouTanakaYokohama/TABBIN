---
name: security-review
description: Use when reviewing browser extension security, permissions, storage handling, user-provided content, dependency changes, or release-sensitive code in TABBIN.
---

# Security Review

Use this skill when a change can affect user data, extension permissions,
rendered content, network access, storage, background actions, imports, or
release packaging.

## Review Scope

Check the change against TABBIN's browser extension threat model:

- `manifest` and host permissions stay minimal and justified.
- `chrome.storage` / `browser.storage` do not store secrets, unnecessary
  personal data, or unbounded data without retention behavior.
- User-provided titles, URLs, AI output, markdown, and imported JSON are not
  rendered through unsafe HTML paths.
- Background actions validate inputs before mutating tabs, windows, storage, or
  notification state.
- URL handling preserves scheme and origin boundaries and does not assume a
  trusted page context.
- Logs and errors avoid leaking tokens, prompt content, private URLs, or
  imported tab data.
- Dependencies and dynamic imports are necessary, actively maintained, and do
  not weaken the existing `bun run quality` / `bun run test:coverage` gate.

## Workflow

1. Identify the security-sensitive surfaces touched by the diff.
2. Trace data from entry point to sink: UI input, storage, background messages,
   imported files, AI output, and browser APIs.
3. Check permission and storage minimization before suggesting new capability.
4. Prefer existing wrappers in `src/lib/` and typed data structures over ad hoc
   browser API calls.
5. Add or adjust focused tests for validation, sanitization, permission, or
   storage behavior when the risk is not already covered.
6. Report findings first, with file paths and concrete exploit or failure
   paths. If no issue is found, state the residual risk and the checks run.

## TABBIN-Specific Red Flags

- New `dangerouslySetInnerHTML` usage or markdown/AI output escaping changes.
- New broad host permissions, optional permissions, or background capabilities.
- Storing full URLs, prompts, or imported data without clear need.
- Closing, moving, deleting, or restoring tabs based only on display text.
- Swallowing browser API failures where storage and UI can diverge.
- Security checks that only run in UI code while background code remains
  callable directly.
