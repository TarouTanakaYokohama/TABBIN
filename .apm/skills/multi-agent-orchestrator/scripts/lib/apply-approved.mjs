import path from 'node:path'
import { spawn } from 'node:child_process'

function runGitApply(repoRoot, args, diffPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', repoRoot, 'apply', ...args, diffPath], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(
        new Error(`git apply ${args.join(' ')} failed: ${stderr || stdout}`),
      )
    })
  })
}

export async function applyApprovedDiffs(repoRoot, workerRuns, reviews) {
  const approvedWorkerIds = new Set(
    reviews.filter(item => item.approved).map(item => item.worker_id),
  )
  const applied = []
  const applyTargets = []

  for (const worker of workerRuns) {
    if (!approvedWorkerIds.has(worker.worker_id)) {
      continue
    }
    const diffPath = path.join(repoRoot, worker.diff_path)
    applyTargets.push({
      worker_id: worker.worker_id,
      diff_path: diffPath,
    })
  }

  // Verify all patches first to avoid partial application.
  for (const target of applyTargets) {
    await runGitApply(repoRoot, ['--check', '--3way'], target.diff_path)
  }

  for (const target of applyTargets) {
    await runGitApply(repoRoot, ['--3way'], target.diff_path)
    applied.push(target.worker_id)
  }

  return applied
}
