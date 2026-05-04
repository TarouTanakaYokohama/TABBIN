import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

function runCommand(bin, args, cwd, timeoutMs = 240_000) {
  return new Promise(resolve => {
    const child = spawn(bin, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) {
        return
      }
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!settled) {
          child.kill('SIGKILL')
        }
      }, 3_000)
    }, timeoutMs)

    const complete = result => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      resolve(result)
    }

    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', error => {
      complete({ code: 1, stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.on('close', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        complete({
          code: 124,
          stdout,
          stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms.`,
        })
        return
      }
      complete({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function runCodexExec({
  codexBin,
  cwd,
  prompt,
  outputPath,
  schemaPath,
  timeoutMs,
}) {
  const args = [
    '-C',
    cwd,
    'exec',
    '--ephemeral',
    '--sandbox',
    'workspace-write',
    '--full-auto',
    '--skip-git-repo-check',
    '-o',
    outputPath,
  ]
  if (schemaPath) {
    args.push('--output-schema', schemaPath)
  }
  args.push(prompt)

  const result = await runCommand(codexBin, args, cwd, timeoutMs)
  let message = ''
  try {
    message = await readFile(outputPath, 'utf-8')
  } catch {
    message = ''
  }

  return {
    ok: result.code === 0,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    message,
  }
}

export function resolveCodexBinary(explicitBin) {
  const candidates = []
  if (explicitBin) {
    candidates.push(explicitBin)
  }
  if (process.env.CODEX_BIN) {
    candidates.push(process.env.CODEX_BIN)
  }
  candidates.push('codex')

  if (process.env.HOME) {
    candidates.push(
      path.join(
        process.env.HOME,
        '.proto/tools/node/22.14.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex',
      ),
    )
  }

  for (const candidate of candidates) {
    if (candidate === 'codex') {
      return candidate
    }
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return ''
}

export async function runCodexTask(params) {
  return runCodexExec({ ...params, timeoutMs: 240_000 })
}

export async function runCodexReview(params) {
  return runCodexExec({ ...params, timeoutMs: 180_000 })
}
