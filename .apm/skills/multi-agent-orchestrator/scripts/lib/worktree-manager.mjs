import { spawn } from 'node:child_process'
import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'

function runGit(repoRoot, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: repoRoot,
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
      reject(new Error(`git ${args.join(' ')} failed: ${stderr || stdout}`))
    })
  })
}

function parseWorktreeList(stdout) {
  return stdout
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length).trim())
    .filter(Boolean)
}

function isDescendantPath(parentPath, childPath) {
  const rel = path.relative(parentPath, childPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

export async function createWorkerWorktree(repoRoot, worktreePath) {
  await runGit(repoRoot, ['worktree', 'add', '--detach', worktreePath, 'HEAD'])
}

export async function removeWorkerWorktree(repoRoot, worktreePath) {
  try {
    await runGit(repoRoot, ['worktree', 'remove', '--force', worktreePath])
  } catch {
    // Fallback for non-empty directories left by aborted worker processes.
    await rm(worktreePath, { recursive: true, force: true })
    await runGit(repoRoot, ['worktree', 'prune'])
  }
}

export async function collectWorkerDiff(worktreePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', worktreePath, 'diff', '--binary'], {
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
        resolve(stdout)
        return
      }
      reject(new Error(`git diff failed: ${stderr || stdout}`))
    })
  })
}

export async function listRegisteredWorktrees(repoRoot) {
  const result = await runGit(repoRoot, ['worktree', 'list', '--porcelain'])
  return parseWorktreeList(result.stdout)
}

export async function cleanupRunWorktrees(repoRoot, runWorktreesDir) {
  const before = await listRegisteredWorktrees(repoRoot)
  const targeted = before.filter(item =>
    isDescendantPath(runWorktreesDir, item),
  )

  const removedRegistered = []
  for (const worktreePath of targeted) {
    await removeWorkerWorktree(repoRoot, worktreePath)
    removedRegistered.push(worktreePath)
  }

  const removedDirs = []
  try {
    const entries = await readdir(runWorktreesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      const absolute = path.join(runWorktreesDir, entry.name)
      await rm(absolute, { recursive: true, force: true })
      removedDirs.push(absolute)
    }
  } catch {
    // Directory may not exist in early-failure paths.
  }

  await runGit(repoRoot, ['worktree', 'prune'])
  const after = await listRegisteredWorktrees(repoRoot)
  const remainingRegistered = after.filter(item =>
    isDescendantPath(runWorktreesDir, item),
  )

  return {
    targeted,
    removed_registered: removedRegistered,
    removed_dirs: removedDirs,
    remaining_registered: remainingRegistered,
  }
}
