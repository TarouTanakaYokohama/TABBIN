import path from 'node:path'
import { writeFile } from 'node:fs/promises'

export async function writeFinalReport({
  repoRoot,
  runDir,
  mode,
  goal,
  codexBin,
  plan,
  workerRuns,
  reviews,
  gate,
  applied,
  cleanupCheck,
}) {
  const lines = [
    '# Multi-Agent Run Report',
    '',
    `- Goal: ${goal}`,
    `- Mode: ${mode}`,
    `- Codex binary: ${codexBin}`,
    `- Workers executed: ${workerRuns.length}`,
    `- Review gate: ${gate.passed ? 'passed' : 'failed'}`,
    `- Applied diffs: ${applied.length}`,
    '',
    '## Plan',
    '',
    '```json',
    JSON.stringify(plan, null, 2),
    '```',
    '',
    '## Worker Results',
    '',
  ]

  for (const worker of workerRuns) {
    lines.push(`- ${worker.worker_id}`)
    lines.push(`  - task: ${worker.task.title}`)
    lines.push(`  - exec_ok: ${worker.exec_ok}`)
    lines.push(`  - report: ${worker.report_path}`)
    lines.push(`  - diff: ${worker.diff_path}`)
  }

  lines.push('', '## Reviews', '')
  for (const review of reviews) {
    lines.push(
      `- ${review.worker_id}: ${review.approved ? 'approved' : 'rejected'}`,
    )
    lines.push(`  - reason: ${review.reason}`)
    if (review.required_fixes?.length) {
      lines.push(`  - required_fixes: ${review.required_fixes.join('; ')}`)
    }
  }

  if (applied.length > 0) {
    lines.push('', '## Applied', '')
    for (const workerId of applied) {
      lines.push(`- ${workerId}`)
    }
  }

  if (cleanupCheck) {
    lines.push('', '## Cleanup Check', '')
    lines.push(`- passed: ${cleanupCheck.passed}`)
    lines.push(
      `- remaining_registered: ${cleanupCheck.remaining_registered.length}`,
    )
    lines.push(
      `- new_registered_from_run: ${cleanupCheck.new_registered_from_run.length}`,
    )
    if (cleanupCheck.remaining_registered.length > 0) {
      for (const item of cleanupCheck.remaining_registered) {
        lines.push(`- remaining: ${item}`)
      }
    }
    if (cleanupCheck.new_registered_from_run.length > 0) {
      for (const item of cleanupCheck.new_registered_from_run) {
        lines.push(`- new_from_run: ${item}`)
      }
    }
  }

  const reportPath = path.join(runDir, 'final-report.md')
  await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf-8')
  await writeFile(
    path.join(runDir, 'result.json'),
    `${JSON.stringify(
      {
        mode,
        goal,
        gate_passed: gate.passed,
        applied,
        cleanup_passed: cleanupCheck?.passed ?? true,
        cleanup_remaining: cleanupCheck?.remaining_registered ?? [],
        cleanup_new_registered_from_run:
          cleanupCheck?.new_registered_from_run ?? [],
        report: path.relative(repoRoot, reportPath),
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )
}
