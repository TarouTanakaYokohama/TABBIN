import { describe, expect, it } from 'vitest'
import type { AiSavedUrlRecord } from '@/features/ai-chat/types'
import {
  generateAnalyticsResult,
  getAnalyticsPresets,
  getDefaultAnalyticsQuery,
} from './analytics'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 2, 14, 0, 0, 0)

const records: AiSavedUrlRecord[] = [
  {
    id: '1',
    url: 'https://docs.example.com/a',
    title: 'Example Docs',
    domain: 'docs.example.com',
    savedAt: NOW - DAY_MS,
    savedInTabGroups: ['docs.example.com'],
    savedInProjects: ['Research'],
    subCategories: ['Docs'],
    projectCategories: ['Reading'],
    parentCategories: ['Work'],
  },
  {
    id: '2',
    url: 'https://docs.example.com/b',
    title: 'Example Guide',
    domain: 'docs.example.com',
    savedAt: NOW - 3 * DAY_MS,
    savedInTabGroups: ['docs.example.com'],
    savedInProjects: [],
    subCategories: ['Guides'],
    projectCategories: [],
    parentCategories: ['Work'],
  },
  {
    id: '3',
    url: 'https://news.example.net/a',
    title: 'News Entry',
    domain: 'news.example.net',
    savedAt: NOW - 2 * DAY_MS,
    savedInTabGroups: [],
    savedInProjects: ['Inbox'],
    subCategories: [],
    projectCategories: ['Catchup'],
    parentCategories: [],
  },
  {
    id: '4',
    url: 'https://app.example.org/a',
    title: 'App Entry',
    domain: 'app.example.org',
    savedAt: NOW - 8 * DAY_MS,
    savedInTabGroups: ['app.example.org'],
    savedInProjects: ['Inbox'],
    subCategories: ['Ops'],
    projectCategories: ['Review'],
    parentCategories: ['Operations'],
  },
]

describe('analytics', () => {
  it('ドメインモードのトップドメイン棒グラフを生成する', () => {
    const result = generateAnalyticsResult(
      records,
      {
        ...getDefaultAnalyticsQuery(),
        chartType: 'bar',
        groupBy: 'domain',
        mode: 'domain',
        timeRange: '30d',
      },
      {
        now: NOW,
      },
    )

    expect(result.filteredRecordCount).toBe(3)
    expect(result.chartSpecs).toHaveLength(1)
    expect(result.chartSpecs[0]).toMatchObject({
      title: 'ドメイン別の保存数',
      type: 'bar',
      xKey: 'label',
      series: [{ colorToken: 'chart-1', dataKey: 'count', label: '保存数' }],
    })
    expect(result.chartSpecs[0]?.data).toEqual([
      { count: 2, label: 'docs.example.com' },
      { count: 1, label: 'app.example.org' },
    ])
  })

  it('時系列でモード比較の複数系列チャートを生成する', () => {
    const result = generateAnalyticsResult(
      records,
      {
        ...getDefaultAnalyticsQuery(),
        chartType: 'line',
        compareBy: 'mode',
        groupBy: 'timeRecent',
        mode: 'both',
        timeBucket: 'day',
        timeRange: '30d',
      },
      {
        now: NOW,
      },
    )

    expect(result.chartSpecs[0]).toMatchObject({
      title: '日別の保存推移',
      type: 'line',
      xKey: 'label',
      series: [
        { colorToken: 'chart-1', dataKey: 'domain', label: 'ドメインモード' },
        { colorToken: 'chart-2', dataKey: 'custom', label: 'カスタムモード' },
      ],
    })
    expect(result.chartSpecs[0]?.data).toContainEqual({
      custom: 1,
      domain: 1,
      label: '2026-03-13',
    })
    expect(result.chartSpecs[0]?.data).toContainEqual({
      custom: 1,
      domain: 0,
      label: '2026-03-12',
    })
  })

  it('時系列（直近）は上位件数ぶんの最新バケットだけを表示する', () => {
    const result = generateAnalyticsResult(
      records,
      {
        ...getDefaultAnalyticsQuery(),
        groupBy: 'timeRecent',
        limit: 2,
        mode: 'both',
        timeBucket: 'day',
        timeRange: '30d',
      },
      {
        now: NOW,
      },
    )

    expect(result.chartSpecs[0]?.data).toEqual([
      { count: 1, label: '2026-03-12' },
      { count: 1, label: '2026-03-13' },
    ])
  })

  it('時系列（件数）は件数上位バケットを選んでから時系列順で表示する', () => {
    const result = generateAnalyticsResult(
      [
        ...records,
        {
          id: '5',
          url: 'https://docs.example.com/c',
          title: 'Example Docs 2',
          domain: 'docs.example.com',
          savedAt: NOW - DAY_MS,
          savedInTabGroups: ['docs.example.com'],
          savedInProjects: [],
          subCategories: ['Docs'],
          projectCategories: ['Reading'],
          parentCategories: ['Work'],
        },
        {
          id: '6',
          url: 'https://app.example.org/b',
          title: 'App Entry 2',
          domain: 'app.example.org',
          savedAt: NOW - 8 * DAY_MS,
          savedInTabGroups: ['app.example.org'],
          savedInProjects: [],
          subCategories: ['Ops'],
          projectCategories: ['Review'],
          parentCategories: ['Operations'],
        },
      ],
      {
        ...getDefaultAnalyticsQuery(),
        groupBy: 'timeTop',
        limit: 2,
        mode: 'both',
        timeBucket: 'day',
        timeRange: '30d',
      },
      {
        now: NOW,
      },
    )

    expect(result.chartSpecs[0]?.data).toEqual([
      { count: 2, label: '2026-03-06' },
      { count: 2, label: '2026-03-13' },
    ])
  })

  it('旧 time クエリは時系列（直近）として扱う', () => {
    const result = generateAnalyticsResult(
      records,
      {
        ...getDefaultAnalyticsQuery(),
        groupBy: 'time' as never,
        limit: 1,
        mode: 'both',
        timeBucket: 'day',
        timeRange: '30d',
      },
      {
        now: NOW,
      },
    )

    expect(result.chartSpecs[0]?.data).toEqual([
      { count: 1, label: '2026-03-13' },
    ])
  })

  it('include/exclude と percent 正規化を適用できる', () => {
    const result = generateAnalyticsResult(
      records,
      {
        ...getDefaultAnalyticsQuery(),
        chartType: 'pie',
        filters: {
          ...getDefaultAnalyticsQuery().filters,
          excludedDomains: ['app.example.org'],
          includedParentCategories: ['Work'],
        },
        groupBy: 'parentCategory',
        mode: 'domain',
        normalize: true,
        timeRange: '30d',
      },
      {
        now: NOW,
      },
    )

    expect(result.filteredRecordCount).toBe(2)
    expect(result.chartSpecs[0]).toMatchObject({
      categoryKey: 'label',
      type: 'pie',
      valueFormat: 'percent',
    })
    expect(result.chartSpecs[0]?.data).toEqual([{ count: 100, label: 'Work' }])
  })

  it('初期クエリは全期間を選ぶ', () => {
    expect(getDefaultAnalyticsQuery().timeRange).toBe('all')
  })

  it('カスタム期間で絞り込める', () => {
    const result = generateAnalyticsResult(
      records,
      {
        ...getDefaultAnalyticsQuery(),
        customDateRange: {
          from: '2026-03-11',
          to: '2026-03-13',
        },
        groupBy: 'domain',
        mode: 'both',
        timeRange: 'custom',
      },
      {
        now: NOW,
      },
    )

    expect(result.filteredRecordCount).toBe(3)
    expect(result.chartSpecs[0]?.data).toEqual([
      { count: 2, label: 'docs.example.com' },
      { count: 1, label: 'news.example.net' },
    ])
  })

  it('カスタム期間はローカル日付ベースで判定する', () => {
    const localDateRecord: AiSavedUrlRecord = {
      id: 'local-date-1',
      url: 'https://calendar.example.com/a',
      title: 'Local Date Entry',
      domain: 'calendar.example.com',
      savedAt: new Date(2026, 2, 13, 0, 30, 0).getTime(),
      savedInTabGroups: ['calendar.example.com'],
      savedInProjects: [],
      subCategories: [],
      projectCategories: [],
      parentCategories: [],
    }

    const result = generateAnalyticsResult(
      [localDateRecord],
      {
        ...getDefaultAnalyticsQuery(),
        customDateRange: {
          from: '2026-03-13',
          to: '2026-03-13',
        },
        groupBy: 'domain',
        mode: 'domain',
        timeRange: 'custom',
      },
      {
        now: NOW,
      },
    )

    expect(result.filteredRecordCount).toBe(1)
    expect(result.chartSpecs[0]?.data).toEqual([
      { count: 1, label: 'calendar.example.com' },
    ])
  })

  it('初期プリセットを返す', () => {
    const presets = getAnalyticsPresets()

    expect(presets.length).toBeGreaterThanOrEqual(6)
    expect(presets.map(preset => preset.id)).toContain('top-domains-30d')
    expect(presets.map(preset => preset.id)).toContain('mode-comparison-30d')
  })
})
