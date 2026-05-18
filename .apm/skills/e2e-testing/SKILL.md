---
name: e2e-testing
description: Use when adding, changing, debugging, or reviewing Playwright E2E coverage for TABBIN's WXT browser extension flows.
---

# E2E Testing

Use this skill for changes that need end-to-end confidence across the browser
extension UI, background behavior, storage, or cross-entrypoint workflows.

## What Belongs In E2E

Prioritize critical user flows that unit tests cannot cover well:

- Loading the extension entrypoints and navigating between major views.
- Saving, restoring, deleting, importing, or exporting tabs and projects.
- Background actions that affect real tabs, windows, notifications, or storage.
- Flows where popup/options/saved-tabs state must stay consistent.
- Regression tests for bugs that only appear with browser APIs or real routing.

Keep pure data transforms, small UI state, and storage helper edge cases in
Vitest unless a browser lifecycle is essential.

## TABBIN Playwright Workflow

1. Inspect existing tests under `e2e/` and reuse local fixtures/helpers before
   creating new patterns.
2. Use `bun run e2e` for the full E2E gate. Run narrower Playwright commands
   only while iterating, then finish with the repo command when E2E is in scope.
3. Treat screenshots, traces, and videos as debugging artifacts. Use them to
   locate the failure, but do not commit generated reports.
4. Avoid generic web-app assumptions such as a stable `baseURL` when the flow is
   extension-specific. Prefer the repo's WXT/extension loading pattern.
5. Keep selectors user-facing when possible, and add test ids only when the UI
   has no stable accessible target.
6. For flaky failures, identify the awaited browser or storage state instead of
   adding fixed sleeps.

## Done Criteria

- The E2E test covers a user-visible or browser-lifecycle behavior.
- The test fails for the original regression when that is practical to verify.
- The final relevant command is reported with its exit status.
- Broader repo completion still follows `bun run quality` and
  `bun run test:coverage` 100% before claiming completion.
