---
name: agent-introspection-debugging
description: Use when an agent workflow is looping, contradicting prior decisions, losing source-of-truth boundaries, or failing because of tool/context behavior rather than product code.
---

# Agent Introspection Debugging

Use this skill when the failure is in the agent process itself: repeated failed
commands, stale assumptions after compaction, ignored repo instructions,
tool-output flooding, source-of-truth drift, or mismatched completion claims.

## First Separate Code Failure From Agent Failure

Ask which layer is actually broken:

- Product code: a test, build, runtime behavior, or UI flow fails.
- Agent workflow: the agent repeats work, reads the wrong files, edits generated
  artifacts, skips a required gate, loses context, or reports status without
  evidence.
- Tooling/environment: sandbox, network, permissions, missing binaries, or
  generated output ownership blocks progress.

Use `systematic-debugging` for product-code root cause analysis. Use this skill
for the agent/tool/process layer.

## Workflow

1. Restate the current objective as concrete deliverables.
2. Search current and prior context before asking the user to restate history.
3. Build a prompt-to-artifact checklist that maps each requirement to evidence:
   files, commands, generated artifacts, tests, gates, Beads state, or PR state.
4. Identify divergence:
   - source-of-truth edits made only in generated files
   - tests passing that do not cover the requirement
   - repeated commands with hidden failures
   - stale assumptions from earlier runs
   - context-mode / RTK / Serena routing violations
5. Choose one next corrective action and verify it before moving on.
6. Update harness or status files only when they are part of the active task.

## TABBIN Guardrails

- Durable APM changes belong in `.apm/instructions`, `.apm/prompts`,
  `.apm/hooks`, or `.apm/skills`, then generated outputs are refreshed.
- Do not add Planner or Orchestrator layers to the Generator/Evaluator harness.
- Evaluator work is a fresh-context review, not an auto-started hook loop.
- Completion claims require fresh evidence for `bun run quality` and
  `bun run test:coverage` 100% unless the user explicitly scoped the work away
  from code completion and a narrower verifier is justified.
- If a tool hides necessary failure detail, intentionally switch to a targeted
  non-filtered path and print only the evidence needed to decide.
