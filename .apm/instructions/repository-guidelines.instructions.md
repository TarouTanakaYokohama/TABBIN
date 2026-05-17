---
description: Repository structure, commands, style, testing, and completion gate for TABBIN agents.
applyTo: "**/*"
---

# Repository Guidelines

## Project Structure & Module Organization
This repository is a WXT-based browser extension (TABBIN). Main entrypoints live in `entrypoints/` (`background.ts`, `options/`, `saved-tabs/`, `changelog/`). Domain features are grouped under `features/` (for example, `features/options` and `features/saved-tabs`). Reusable UI and shared React components live in `components/` and `components/ui/`. Cross-cutting logic lives in `lib/` (background helpers, storage, browser wrappers), with shared types in `types/`, constants in `constants/`, and utilities in `utils/`.

Tests are mostly colocated as `*.test.ts` / `*.test.tsx`. End-to-end tests are in `e2e/` (`*.spec.ts`). Storybook stories are in `stories/`. Generated output directories such as `.output/`, `coverage/`, `playwright-report/`, and `test-results/` should not be edited manually.

## Build, Test, and Development Commands
- `bun install`: install dependencies (CI uses Node `22` and Bun `1.2.8`).
- `bun run dev` / `bun run dev:firefox`: start WXT dev mode for Chrome/Firefox.
- `bun run build` / `bun run build:firefox`: production extension build.
- `bun run zip` / `bun run zip:firefox`: package extension zip artifacts.
- `bun run compile`: TypeScript type-check (`tsgo --noEmit`).
- `bun run test` / `bun run test:coverage`: run Vitest tests (with optional coverage).
- `bun run e2e`: run Playwright browser tests.
- `bun run quality`: run format, lint, Biome check, tests, Knip, and duplication checks.

## Coding Style & Naming Conventions
Use TypeScript + React with ES modules. Formatting/linting is enforced by Biome (`biome.json`): 2-space indentation, 80-column line width, single quotes, and no semicolons (`asNeeded`). Let Biome organize imports.

Use `PascalCase.tsx` for React components (for example, `ImportExportSettings.tsx`) and `camelCase.ts` for utilities/constants (for example, `autoDeleteOptions.ts`). Keep tests next to the code they validate when practical.

## Testing Guidelines
Vitest is the primary test runner (`vitest.ci.config.ts`); Playwright covers E2E flows in `e2e/`. Use `*.test.ts(x)` for unit/integration tests and `*.spec.ts` for Playwright tests. No explicit coverage threshold is enforced by Vitest config, but AI/Codex completion in this repository requires `bun run test:coverage` to report 100% coverage. For non-trivial changes, add or adjust regression tests before opening a PR.

## Agent Notify (Completion Gate)
For AI/Codex agents working in this repository, the following steps are mandatory
before reporting a task as completed to the user:

1. Run `bun run quality`.
2. If `bun run quality` fails, fix the errors and re-run until it passes.
3. Run `bun run test:coverage`.
4. If coverage is not `100`, add/fix tests and re-run until coverage reaches `100`.
5. Do not claim completion until both commands pass and coverage is `100`.

If blocked by an environment/tooling issue (for example, a runtime panic unrelated to
repo code), explicitly report it as a blocker instead of claiming completion.

## Beads Issue Tracker
This project uses Beads (`bd`) for durable issue tracking. Use the `beads`
skill at `.agents/skills/beads/SKILL.md` for workflow guidance, then use the
`bd` CLI for issue operations when it is available.

Run `bd prime` when Beads context is missing or stale. Use `bd ready` to find
available work, `bd show <id>` to inspect issues, `bd update <id> --claim` to
claim work, and `bd close <id>` only after the work is actually complete.

Use Beads for shared project tasks, blockers, dependencies, discovered follow-up
work, and handoff state. Do not create markdown TODO lists as the source of
truth, and keep persistent project memory in Beads via `bd remember`.

When ending a work session, file issues for remaining follow-up work, run the
required quality gates if code changed, update Beads issue status, and push the
finished branch. Work is not complete until `git push` succeeds and `git status`
shows the branch is up to date with origin. If push or Beads operations are
blocked by local tooling or credentials, report that blocker explicitly.

## Commit & Pull Request Guidelines
Recent history uses concise subjects (often Japanese) plus merge commits. Prefer short, imperative commit messages describing a single change. PRs should target `main`, summarize changes under `変更内容`, and confirm local validation in the checklist (`ローカル環境でエラーになっていない`). Link related issues and include screenshots/GIFs for UI changes.

`lefthook` runs `biome check --write` on pre-commit and `bun run quality` on pre-push, so keep the branch green locally before pushing.
