import type {
  AiChartSpec,
  AiSavedUrlRecord,
  InterestEvidenceEntry,
  InterestInferenceResult,
} from '@/features/ai-chat/types'

const countValues = (values: string[]): InterestEvidenceEntry[] => {
  const counts = new Map<string, number>()

  for (const value of values) {
    if (!value) {
      continue
    }
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.value.localeCompare(right.value),
    )
}

const CATEGORY_CHART_SERIES = [
  {
    colorToken: 'chart-1',
    dataKey: 'count',
    label: '保存数',
  },
]

const DOMAIN_CHART_SERIES = [
  {
    colorToken: 'chart-2',
    dataKey: 'count',
    label: '保存数',
  },
]

const toChartData = (entries: InterestEvidenceEntry[]) =>
  entries.map(entry => ({
    count: entry.count,
    label: entry.value,
  }))

const buildChartSpecs = ({
  topCategories,
  topDomains,
}: InterestInferenceResult['evidence']): AiChartSpec[] => {
  const chartSpecs: AiChartSpec[] = []

  if (topCategories.length > 0) {
    const categoryData = toChartData(topCategories)

    chartSpecs.push({
      categoryKey: 'label',
      data: categoryData,
      description: '最近保存したカテゴリ比率',
      series: CATEGORY_CHART_SERIES,
      title: 'よく保存しているジャンル',
      type: 'pie',
      valueFormat: 'count',
    })
    chartSpecs.push({
      data: categoryData,
      description: '最近保存したカテゴリ件数',
      series: CATEGORY_CHART_SERIES,
      title: 'ジャンル別の保存数',
      type: 'bar',
      valueFormat: 'count',
      xKey: 'label',
    })
  }

  if (topDomains.length > 0) {
    chartSpecs.push({
      data: toChartData(topDomains),
      description: '最近保存したドメイン件数',
      series: DOMAIN_CHART_SERIES,
      title: 'よく保存しているドメイン',
      type: 'bar',
      valueFormat: 'count',
      xKey: 'label',
    })
  }

  return chartSpecs
}

export const inferUserInterests = (
  records: AiSavedUrlRecord[],
): InterestInferenceResult => {
  const topDomains = countValues(records.map(record => record.domain)).slice(
    0,
    3,
  )
  const topCategories = countValues(
    records.flatMap(record => [
      ...new Set([
        ...record.parentCategories,
        ...record.subCategories,
        ...record.projectCategories,
      ]),
    ]),
  ).slice(0, 3)
  const isTentative = records.length < 3

  if (records.length === 0) {
    return {
      chartSpecs: [],
      summary: 'まだ保存データがないため、興味の傾向は判断できません。',
      isTentative: true,
      evidence: {
        topDomains: [],
        topCategories: [],
      },
    }
  }

  if (isTentative) {
    return {
      chartSpecs: buildChartSpecs({
        topDomains,
        topCategories,
      }),
      summary:
        '保存件数が少なく判断材料が限られるため、まだ強い傾向は読み取りにくいです。',
      isTentative: true,
      evidence: {
        topDomains,
        topCategories,
      },
    }
  }

  const domainSummary = topDomains
    .map(entry => `${entry.value}(${entry.count})`)
    .join(' / ')
  const categorySummary =
    topCategories.length > 0
      ? `カテゴリでは ${topCategories.map(entry => entry.value).join('、')} が目立ちます。`
      : 'カテゴリ偏りはまだ弱めです。'

  return {
    chartSpecs: buildChartSpecs({
      topDomains,
      topCategories,
    }),
    summary: `保存傾向から見ると ${domainSummary} 周辺への関心が強く、${categorySummary}`,
    isTentative: false,
    evidence: {
      topDomains,
      topCategories,
    },
  }
}
