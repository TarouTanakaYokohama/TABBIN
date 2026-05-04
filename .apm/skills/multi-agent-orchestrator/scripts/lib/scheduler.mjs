function includesAny(text, patterns) {
  return patterns.some(pattern => text.includes(pattern))
}

export function parseWorkerCount(value) {
  if (!value || value === 'auto') {
    return 'auto'
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new Error('--workers must be auto or an integer in range 1..10')
  }
  return parsed
}

export function createPlan(goal, requestedWorkers, maxWorkers = 10) {
  const normalizedGoal = goal.toLowerCase()
  const tasks = []

  const testFocused = includesAny(normalizedGoal, [
    'test',
    'testing',
    'spec',
    'coverage',
    '検証',
    'テスト',
  ])

  if (
    testFocused ||
    includesAny(normalizedGoal, ['rust', 'tauri', 'cargo', 'backend'])
  ) {
    tasks.push({
      id: 'worker-rust-tests',
      title: 'Rust testing work',
      description:
        'Add or improve Rust tests and test infrastructure for backend modules.',
      effort_points: 3,
      area: 'rust',
    })
  }

  if (
    testFocused ||
    includesAny(normalizedGoal, [
      'react',
      'frontend',
      'ui',
      'vitest',
      'component',
    ])
  ) {
    tasks.push({
      id: 'worker-react-tests',
      title: 'React testing work',
      description:
        'Add or improve React component and state tests in the frontend.',
      effort_points: 3,
      area: 'react',
    })
  }

  if (includesAny(normalizedGoal, ['ci', 'workflow', 'actions'])) {
    tasks.push({
      id: 'worker-ci',
      title: 'CI updates',
      description: 'Update CI to run relevant checks for changed test suites.',
      effort_points: 1,
      area: 'infra',
    })
  }

  if (tasks.length === 0) {
    tasks.push({
      id: 'worker-general',
      title: 'General implementation',
      description: goal,
      effort_points: 2,
      area: 'shared',
    })
  }

  const computedMax =
    requestedWorkers === 'auto'
      ? Math.min(maxWorkers, Math.max(1, tasks.length))
      : Math.min(maxWorkers, requestedWorkers)

  return {
    goal,
    max_workers: computedMax,
    tasks,
  }
}
