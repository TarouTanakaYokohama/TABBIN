import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { AiChartSeries, AiChartSpec } from '@/features/ai-chat/types'

const PIE_CHART_COLOR_TOKENS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
]

const getChartColor = (colorToken: string) => `var(--${colorToken})`

const createChartConfig = (series: AiChartSeries[]): ChartConfig =>
  Object.fromEntries(
    series.map(item => [
      item.dataKey,
      {
        color: getChartColor(item.colorToken),
        label: item.label,
      },
    ]),
  )

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const hasValidSeries = (spec: AiChartSpec): boolean =>
  spec.series.length > 0 &&
  spec.series.every(
    item =>
      item &&
      typeof item.colorToken === 'string' &&
      item.colorToken.length > 0 &&
      typeof item.dataKey === 'string' &&
      item.dataKey.length > 0 &&
      typeof item.label === 'string' &&
      item.label.length > 0,
  )

const hasUsableData = (spec: AiChartSpec): boolean =>
  spec.data.some(datum =>
    spec.series.some(series => isFiniteNumber(datum[series.dataKey])),
  )

const isRenderableChartSpec = (spec: AiChartSpec): boolean =>
  typeof spec.title === 'string' &&
  spec.title.length > 0 &&
  Array.isArray(spec.data) &&
  hasValidSeries(spec) &&
  hasUsableData(spec)

const formatChartValue = (
  value: unknown,
  format?: AiChartSpec['valueFormat'],
) => {
  if (!isFiniteNumber(value)) {
    return String(value ?? '')
  }

  if (format === 'percent') {
    return `${Math.round(value)}%`
  }

  return value.toLocaleString()
}

const ChartLegendBlock = ({
  nameKey,
  shouldShowLegend,
}: {
  nameKey?: string
  shouldShowLegend: boolean
}) =>
  shouldShowLegend ? (
    <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
  ) : null

const renderPieChart = ({
  categoryKey,
  primarySeries,
  shouldShowLegend,
  spec,
}: {
  categoryKey: string
  primarySeries: AiChartSeries
  shouldShowLegend: boolean
  spec: AiChartSpec
}) => (
  <PieChart>
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={value => formatChartValue(value, spec.valueFormat)}
        />
      }
      cursor={false}
    />
    <Pie
      data={spec.data}
      dataKey={primarySeries.dataKey}
      nameKey={categoryKey}
      outerRadius={80}
    >
      {spec.data.map((datum, index) => (
        <Cell
          fill={getChartColor(
            PIE_CHART_COLOR_TOKENS[index % PIE_CHART_COLOR_TOKENS.length],
          )}
          key={`${String(datum[categoryKey] ?? index)}-${index}`}
        />
      ))}
    </Pie>
    <ChartLegendBlock
      nameKey={categoryKey}
      shouldShowLegend={shouldShowLegend}
    />
  </PieChart>
)

const renderBarChart = ({
  shouldShowLegend,
  spec,
}: {
  shouldShowLegend: boolean
  spec: AiChartSpec
}) =>
  spec.xKey ? (
    <BarChart accessibilityLayer data={spec.data}>
      <CartesianGrid vertical={false} />
      <XAxis axisLine={false} dataKey={spec.xKey} tickLine={false} />
      <YAxis axisLine={false} tickLine={false} />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={value => formatChartValue(value, spec.valueFormat)}
          />
        }
        cursor={false}
      />
      <ChartLegendBlock shouldShowLegend={shouldShowLegend} />
      {spec.series.map(series => (
        <Bar
          dataKey={series.dataKey}
          fill={getChartColor(series.colorToken)}
          key={series.dataKey}
          radius={6}
          stackId={spec.stacked ? 'stack' : undefined}
        />
      ))}
    </BarChart>
  ) : null

const renderLineChart = ({
  shouldShowLegend,
  spec,
}: {
  shouldShowLegend: boolean
  spec: AiChartSpec
}) =>
  spec.xKey ? (
    <LineChart accessibilityLayer data={spec.data}>
      <CartesianGrid vertical={false} />
      <XAxis axisLine={false} dataKey={spec.xKey} tickLine={false} />
      <YAxis axisLine={false} tickLine={false} />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={value => formatChartValue(value, spec.valueFormat)}
          />
        }
        cursor={false}
      />
      <ChartLegendBlock shouldShowLegend={shouldShowLegend} />
      {spec.series.map(series => (
        <Line
          dataKey={series.dataKey}
          dot={false}
          key={series.dataKey}
          stroke={getChartColor(series.colorToken)}
          strokeWidth={2}
          type='monotone'
        />
      ))}
    </LineChart>
  ) : null

const renderAreaChart = ({
  shouldShowLegend,
  spec,
}: {
  shouldShowLegend: boolean
  spec: AiChartSpec
}) =>
  spec.xKey ? (
    <AreaChart accessibilityLayer data={spec.data}>
      <CartesianGrid vertical={false} />
      <XAxis axisLine={false} dataKey={spec.xKey} tickLine={false} />
      <YAxis axisLine={false} tickLine={false} />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={value => formatChartValue(value, spec.valueFormat)}
          />
        }
        cursor={false}
      />
      <ChartLegendBlock shouldShowLegend={shouldShowLegend} />
      {spec.series.map(series => (
        <Area
          dataKey={series.dataKey}
          fill={getChartColor(series.colorToken)}
          fillOpacity={0.3}
          key={series.dataKey}
          stackId={spec.stacked ? 'stack' : undefined}
          stroke={getChartColor(series.colorToken)}
          strokeWidth={2}
          type='monotone'
        />
      ))}
    </AreaChart>
  ) : null

const renderRadarChart = ({
  categoryKey,
  shouldShowLegend,
  spec,
}: {
  categoryKey: string
  shouldShowLegend: boolean
  spec: AiChartSpec
}) => (
  <RadarChart accessibilityLayer data={spec.data}>
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={value => formatChartValue(value, spec.valueFormat)}
        />
      }
      cursor={false}
    />
    <ChartLegendBlock shouldShowLegend={shouldShowLegend} />
    <PolarGrid />
    <PolarAngleAxis dataKey={categoryKey} />
    {spec.series.map(series => (
      <Radar
        dataKey={series.dataKey}
        fill={getChartColor(series.colorToken)}
        fillOpacity={0.25}
        key={series.dataKey}
        stroke={getChartColor(series.colorToken)}
      />
    ))}
  </RadarChart>
)

const renderChartContent = ({
  categoryKey,
  primarySeries,
  shouldShowLegend,
  spec,
}: {
  categoryKey: string
  primarySeries: AiChartSeries
  shouldShowLegend: boolean
  spec: AiChartSpec
}) => {
  switch (spec.type) {
    case 'pie':
      return renderPieChart({
        categoryKey,
        primarySeries,
        shouldShowLegend,
        spec,
      })
    case 'bar':
      return renderBarChart({ shouldShowLegend, spec })
    case 'line':
      return renderLineChart({ shouldShowLegend, spec })
    case 'area':
      return renderAreaChart({ shouldShowLegend, spec })
    case 'radar':
      return renderRadarChart({
        categoryKey,
        shouldShowLegend,
        spec,
      })
    default:
      return null
  }
}

const AiChart = ({ spec }: { spec: AiChartSpec }) => {
  const config = createChartConfig(spec.series)
  const primarySeries = spec.series[0]
  const categoryKey = spec.categoryKey || spec.xKey || 'label'
  const shouldShowLegend = spec.showLegend ?? spec.series.length > 1
  const chartContent = renderChartContent({
    categoryKey,
    primarySeries,
    shouldShowLegend,
    spec,
  })

  if (!chartContent) {
    return null
  }

  return (
    <section className='space-y-3 rounded-lg border border-border/70 bg-background/70 p-3'>
      <div className='space-y-1'>
        <h3 className='font-medium text-sm'>{spec.title}</h3>
        {spec.description ? (
          <p className='text-muted-foreground text-xs'>{spec.description}</p>
        ) : null}
      </div>

      <div className='relative h-60 w-full overflow-visible'>
        <ChartContainer
          className='aspect-auto h-full w-full overflow-visible'
          config={config}
        >
          {chartContent}
        </ChartContainer>
      </div>
    </section>
  )
}

const AiChartRenderer = ({ charts }: { charts?: AiChartSpec[] }) => {
  const renderableCharts = (charts ?? []).filter(isRenderableChartSpec)

  if (renderableCharts.length === 0) {
    return null
  }

  return (
    <div className='space-y-3 pt-3'>
      {renderableCharts.map(spec => (
        <AiChart key={`${spec.type}-${spec.title}`} spec={spec} />
      ))}
    </div>
  )
}

export { AiChartRenderer }
