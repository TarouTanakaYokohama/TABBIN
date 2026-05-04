#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { applyApprovedDiffs } from './lib/apply-approved.mjs'
import {
  resolveCodexBinary,
  runCodexReview,
  runCodexTask,
} from './lib/codex-runner.mjs'
import { writeFinalReport } from './lib/reporting.mjs'
import { createPlan, parseWorkerCount } from './lib/scheduler.mjs'
import {
  cleanupRunWorktrees,
  collectWorkerDiff,
  createWorkerWorktree,
  listRegisteredWorktrees,
  removeWorkerWorktree,
} from './lib/worktree-manager.mjs'
import { evaluateReviewGate } from './lib/review-gate.mjs'

function parseArgs(argv) {
  const options = {
    mode: 'dry-run',
    workers: 'auto',
    task: '',
    codexBin: process.env.CODEX_BIN ?? '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--mode') {
      options.mode = argv[++i] ?? options.mode
      continue
    }
    if (arg === '--workers') {
      options.workers = argv[++i] ?? options.workers
      continue
    }
    if (arg === '--task') {
      options.task = argv[++i] ?? options.task
      continue
    }
    if (arg === '--codex-bin') {
      options.codexBin = argv[++i] ?? options.codexBin
      continue
    }
  }

  if (options.mode !== 'dry-run' && options.mode !== 'apply') {
    throw new Error('--mode must be dry-run or apply')
  }
  if (!options.task.trim()) {
    throw new Error('--task is required')
  }

  return options
}

function createRunId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
  return `${stamp}-${randomUUID().slice(0, 8)}`
}

function buildWorkerPrompt(goal, task) {
  return [
    `You are worker ${task.id}.`,
    `Goal: ${goal}`,
    `Assigned area: ${task.area}`,
    `Task title: ${task.title}`,
    `Task description: ${task.description}`,
    'Work only inside this repository and implement the task end-to-end.',
    'Prefer adding or improving tests and test infrastructure first.',
    'Avoid unrelated production/runtime behavior changes unless they are strictly required for testability.',
    'Run relevant tests for changed files.',
    'Final response format:',
    '1) changed files',
    '2) test commands run',
    '3) remaining risks',
  ].join('\n')
}

function buildReviewPrompt(goal, task, diff) {
  return [
    'You are a strict reviewer.',
    `Goal: ${goal}`,
    `Worker: ${task.id}`,
    `Assigned area: ${task.area}`,
    `Task title: ${task.title}`,
    'Review this unified diff for correctness, regressions, missing tests, and safety.',
    'Reject if test additions are missing for a test-focused task.',
    'Reject if the diff includes unrelated runtime behavior changes.',
    'Reject on ambiguity.',
    'Return JSON only with fields: worker_id, approved, reason, required_fixes.',
    'Diff:\n',
    diff,
  ].join('\n')
}

function sanitizeWorkerId(value, index) {
  const fallback = `worker-${index + 1}`
  if (typeof value !== 'string') {
    return fallback
  }

  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64)

  return sanitized || fallback
}

function normalizeTask(task, index) {
  return {
    id: sanitizeWorkerId(task.id, index),
    title: task.title ?? `Task ${index + 1}`,
    description: task.description ?? '',
    effort_points: Number(task.effort_points ?? 1),
    area: task.area ?? 'shared',
  }
}

async function ensureWorkerReport(reportPath, runResult) {
  const message = (runResult?.message ?? '').trim()
  if (message) {
    return
  }

  const stderr = (runResult?.stderr ?? '').trim()
  const stdout = (runResult?.stdout ?? '').trim()
  const lines = [
    '# Worker Report (Fallback)',
    '',
    'Worker execution completed without a structured report output file.',
    '',
    `- ok: ${Boolean(runResult?.ok)}`,
    `- code: ${runResult?.code ?? 'unknown'}`,
    '',
    '## stderr',
    '',
    '```text',
    stderr || '<empty>',
    '```',
    '',
    '## stdout',
    '',
    '```text',
    stdout || '<empty>',
    '```',
  ]
  await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf-8')
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const repoRoot = process.cwd()
  const runId = createRunId()
  const runDir = path.join(repoRoot, '.agents', 'runs', runId)
  const workersDir = path.join(runDir, 'workers')
  const reviewsDir = path.join(runDir, 'reviews')
  const schemasDir = path.join(runDir, 'schemas')
  const worktreesDir = path.join(runDir, 'worktrees')

  await mkdir(workersDir, { recursive: true })
  await mkdir(reviewsDir, { recursive: true })
  await mkdir(schemasDir, { recursive: true })
  await mkdir(worktreesDir, { recursive: true })
  let preRunWorktrees = []
  let codexBin = ''
  let executionPlan = {
    goal: options.task,
    max_workers: 0,
    tasks: [],
  }
  let workerRuns = []
  let reviews = []
  let gate = { passed: false, rejected: [] }
  let applied = []
  let mainError = null
  let cleanupError = null
  let cleanupCheck = {
    passed: true,
    remaining_registered: [],
    new_registered_from_run: [],
    removed_registered: [],
    removed_dirs: [],
  }

  try {
    preRunWorktrees = await listRegisteredWorktrees(repoRoot)

    codexBin = resolveCodexBinary(options.codexBin)
    if (!codexBin) {
      throw new Error(
        'Codex binary was not found. Set --codex-bin or CODEX_BIN and retry.',
      )
    }

    const requestedWorkers = parseWorkerCount(options.workers)
    const fallbackPlan = createPlan(options.task, requestedWorkers, 10)
    const planSchemaPath = path.join(schemasDir, 'supervisor-plan.schema.json')

    const planSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['goal', 'max_workers', 'tasks'],
      properties: {
        goal: { type: 'string' },
        max_workers: { type: 'integer', minimum: 1, maximum: 10 },
        tasks: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'title', 'description', 'effort_points', 'area'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              effort_points: { type: 'integer', minimum: 1, maximum: 13 },
              area: { type: 'string' },
            },
          },
        },
      },
    }

    await writeFile(
      planSchemaPath,
      `${JSON.stringify(planSchema, null, 2)}\n`,
      'utf-8',
    )

    const supervisorPrompt = [
      'You are Supervisor in a hierarchical multi-agent workflow.',
      `Goal: ${options.task}`,
      `Requested workers: ${requestedWorkers === 'auto' ? 'auto' : requestedWorkers}`,
      'Create an execution plan with up to 10 worker tasks.',
      'Prioritize Rust and React tasks when relevant.',
      'Return JSON only following the provided output schema.',
    ].join('\n')

    const supervisorMessagePath = path.join(runDir, 'supervisor.json')
    let plan = fallbackPlan
    const supervisorResult = await runCodexTask({
      codexBin,
      cwd: repoRoot,
      prompt: supervisorPrompt,
      outputPath: supervisorMessagePath,
      schemaPath: planSchemaPath,
    })

    if (supervisorResult.ok) {
      try {
        const parsed = JSON.parse((supervisorResult.message ?? '').trim())
        plan = {
          goal: parsed.goal,
          max_workers: Math.min(
            10,
            Math.max(1, Number(parsed.max_workers ?? 1)),
          ),
          tasks: (parsed.tasks ?? []).map(normalizeTask),
        }
      } catch {
        plan = fallbackPlan
      }
    }

    const maxWorkers =
      requestedWorkers === 'auto'
        ? Math.min(plan.max_workers, Math.max(1, plan.tasks.length))
        : Math.min(plan.max_workers, requestedWorkers)

    const selectedTasks = plan.tasks.slice(0, maxWorkers)
    executionPlan = {
      goal: plan.goal,
      max_workers: selectedTasks.length,
      tasks: selectedTasks,
    }
    await writeFile(
      path.join(runDir, 'plan.json'),
      `${JSON.stringify(executionPlan, null, 2)}\n`,
      'utf-8',
    )

    workerRuns = await Promise.all(
      selectedTasks.map(async (task, index) => {
        const workerId = sanitizeWorkerId(task.id, index)
        const workerDir = path.join(workersDir, workerId)
        const workerWorktree = path.join(worktreesDir, workerId)
        await mkdir(workerDir, { recursive: true })
        await createWorkerWorktree(repoRoot, workerWorktree)

        const reportPath = path.join(workerDir, 'report.md')
        const diffPath = path.join(workerDir, 'changes.diff')
        let runResult

        try {
          runResult = await runCodexTask({
            codexBin,
            cwd: workerWorktree,
            prompt: buildWorkerPrompt(options.task, task),
            outputPath: reportPath,
          })
          await ensureWorkerReport(reportPath, runResult)
          const diffText = await collectWorkerDiff(workerWorktree)
          await writeFile(diffPath, diffText, 'utf-8')
        } finally {
          await removeWorkerWorktree(repoRoot, workerWorktree)
        }

        return {
          worker_id: workerId,
          task,
          report_path: path.relative(repoRoot, reportPath),
          diff_path: path.relative(repoRoot, diffPath),
          exec_ok: runResult?.ok ?? false,
          exec_stderr: runResult?.stderr ?? '',
        }
      }),
    )

    const reviewSchemaPath = path.join(schemasDir, 'review-result.schema.json')
    const reviewSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['worker_id', 'approved', 'reason', 'required_fixes'],
      properties: {
        worker_id: { type: 'string' },
        approved: { type: 'boolean' },
        reason: { type: 'string' },
        required_fixes: { type: 'array', items: { type: 'string' } },
      },
    }
    await writeFile(
      reviewSchemaPath,
      `${JSON.stringify(reviewSchema, null, 2)}\n`,
      'utf-8',
    )

    reviews = []
    for (const runItem of workerRuns) {
      const diffAbsPath = path.join(repoRoot, runItem.diff_path)
      const diffText = existsSync(diffAbsPath)
        ? await readFile(diffAbsPath, 'utf-8')
        : ''

      if (!diffText.trim()) {
        const autoReject = {
          worker_id: runItem.worker_id,
          approved: false,
          reason: 'Worker produced no diff.',
          required_fixes: ['Produce a concrete code change.'],
        }
        reviews.push(autoReject)
        await writeFile(
          path.join(reviewsDir, `${runItem.worker_id}.json`),
          `${JSON.stringify(autoReject, null, 2)}\n`,
          'utf-8',
        )
        continue
      }

      const reviewOutputPath = path.join(
        reviewsDir,
        `${runItem.worker_id}.raw.txt`,
      )
      const reviewResult = await runCodexReview({
        codexBin,
        cwd: repoRoot,
        prompt: buildReviewPrompt(options.task, runItem.task, diffText),
        outputPath: reviewOutputPath,
        schemaPath: reviewSchemaPath,
      })

      let parsed
      try {
        parsed = JSON.parse((reviewResult.message ?? '').trim())
      } catch {
        parsed = {
          worker_id: runItem.worker_id,
          approved: false,
          reason: reviewResult.ok
            ? 'Reviewer output was invalid JSON.'
            : `Reviewer execution failed: ${reviewResult.stderr}`,
          required_fixes: ['Return valid structured review output.'],
        }
      }

      const normalized = {
        worker_id: runItem.worker_id,
        approved: Boolean(parsed.approved),
        reason: String(parsed.reason ?? ''),
        required_fixes: Array.isArray(parsed.required_fixes)
          ? parsed.required_fixes.map(item => String(item))
          : [],
      }

      reviews.push(normalized)
      await writeFile(
        path.join(reviewsDir, `${runItem.worker_id}.json`),
        `${JSON.stringify(normalized, null, 2)}\n`,
        'utf-8',
      )
    }

    gate = evaluateReviewGate(reviews)
    if (options.mode === 'apply' && gate.passed) {
      applied = await applyApprovedDiffs(repoRoot, workerRuns, reviews)
    }
  } catch (error) {
    mainError = error
  }

  try {
    const cleanup = await cleanupRunWorktrees(repoRoot, worktreesDir)
    const postRunWorktrees = await listRegisteredWorktrees(repoRoot)
    const preRunSet = new Set(preRunWorktrees)
    const newRegisteredFromRun = postRunWorktrees.filter(
      item =>
        item.startsWith(`${worktreesDir}${path.sep}`) && !preRunSet.has(item),
    )
    cleanupCheck = {
      passed:
        cleanup.remaining_registered.length === 0 &&
        newRegisteredFromRun.length === 0,
      remaining_registered: cleanup.remaining_registered,
      new_registered_from_run: newRegisteredFromRun,
      removed_registered: cleanup.removed_registered,
      removed_dirs: cleanup.removed_dirs,
    }
  } catch (error) {
    cleanupError = error
    const message = error instanceof Error ? error.message : String(error)
    cleanupCheck = {
      passed: false,
      remaining_registered: [`cleanup-error: ${message}`],
      new_registered_from_run: [],
      removed_registered: [],
      removed_dirs: [],
    }
  }

  if (mainError) {
    throw mainError
  }

  await writeFinalReport({
    repoRoot,
    runDir,
    mode: options.mode,
    goal: options.task,
    codexBin,
    plan: executionPlan,
    workerRuns,
    reviews,
    gate,
    applied,
    cleanupCheck,
  })

  const summary = {
    run_id: runId,
    mode: options.mode,
    workers: workerRuns.length,
    gate_passed: gate.passed,
    applied_count: applied.length,
    cleanup_passed: cleanupCheck.passed,
    cleanup_remaining_count: cleanupCheck.remaining_registered.length,
    report: path.relative(repoRoot, path.join(runDir, 'final-report.md')),
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)

  if (cleanupError || !cleanupCheck.passed) {
    const reason =
      cleanupError instanceof Error
        ? cleanupError.message
        : `remaining_registered=${cleanupCheck.remaining_registered.length}, new_registered_from_run=${cleanupCheck.new_registered_from_run.length}`
    throw new Error(`Cleanup verification failed: ${reason}`)
  }
}

run().catch(error => {
  process.stderr.write(`orchestrator failed: ${error.message}\n`)
  process.exitCode = 1
})
