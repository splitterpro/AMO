import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { CalculationDetails, Visualization } from '../../types/analysis'
import { formatCompactNumber, formatNumber } from '../../utils/format'
import { isPercentField, kpiFieldLabel, resolveSeriesKeys } from './fieldLabels'
import './AnalysisChart.css'

const CATEGORICAL_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const OTHER_COLOR = '#c3c2b7'
const DONUT_SLICE_CAP = 7

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 }
const AXIS_LINE = { stroke: 'var(--border)' }

function ChartTooltip({ active, payload, valueLabel }: TooltipContentProps & { valueLabel?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="analysis-chart-tooltip">
      {payload.map((entry, i) => (
        <div key={i} className="analysis-chart-tooltip-row">
          <span className="analysis-chart-tooltip-value">
            {typeof entry.value === 'number' ? formatNumber(entry.value) : String(entry.value)}
          </span>
          <span className="analysis-chart-tooltip-label">{valueLabel ?? entry.name}</span>
        </div>
      ))}
    </div>
  )
}

interface SeriesChartProps {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  valueLabel?: string
}

function BarView({ data, xKey, yKey, valueLabel, horizontal }: SeriesChartProps & { horizontal: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis type="category" dataKey={xKey} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} type="category" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis type="number" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          </>
        )}
        <Tooltip
          content={(props) => <ChartTooltip {...props} valueLabel={valueLabel} />}
          cursor={{ fill: 'var(--primary-very-soft)' }}
        />
        <Bar dataKey={yKey} fill="var(--primary)" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineView({ data, xKey, yKey, valueLabel }: SeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip content={(props) => <ChartTooltip {...props} valueLabel={valueLabel} />} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--primary)' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function DonutView({ data, xKey, yKey }: SeriesChartProps) {
  const prepared = useMemo(() => {
    if (data.length <= DONUT_SLICE_CAP) return data
    const head = data.slice(0, DONUT_SLICE_CAP)
    const tail = data.slice(DONUT_SLICE_CAP)
    const otherValue = tail.reduce((sum, row) => sum + (Number(row[yKey]) || 0), 0)
    return [...head, { [xKey]: 'Other', [yKey]: otherValue }]
  }, [data, xKey, yKey])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={prepared} dataKey={yKey} nameKey={xKey} innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {prepared.map((_, index) => (
            <Cell key={index} fill={index < DONUT_SLICE_CAP ? CATEGORICAL_PALETTE[index] : OTHER_COLOR} />
          ))}
        </Pie>
        <Tooltip content={(props) => <ChartTooltip {...props} />} />
        <Legend formatter={(value) => <span className="analysis-chart-legend-label">{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function KpiView({ data }: { data: Record<string, unknown>[] }) {
  const row = data[0]
  if (!row) return null
  return (
    <div className="analysis-kpi-grid">
      {Object.entries(row).map(([key, value]) => {
        const percent = isPercentField(key)
        const numeric = typeof value === 'number'
        const displayValue =
          value == null ? '—' : numeric ? `${formatCompactNumber(value as number)}${percent ? '%' : ''}` : String(value)
        const signColor = percent && numeric ? ((value as number) >= 0 ? 'var(--success)' : 'var(--danger)') : undefined
        return (
          <div key={key} className="analysis-kpi-tile">
            <span className="analysis-kpi-value" style={signColor ? { color: signColor } : undefined}>
              {displayValue}
            </span>
            <span className="analysis-kpi-label">{kpiFieldLabel(key)}</span>
          </div>
        )
      })}
    </div>
  )
}

interface AnalysisChartProps {
  visualization: Visualization
  calculation?: CalculationDetails
}

function AnalysisChart({ visualization, calculation }: AnalysisChartProps) {
  const { type, data } = visualization
  const { xKey, yKey } = resolveSeriesKeys(data[0])
  const valueLabel = calculation?.measure_column ?? undefined

  if (data.length === 0) return null

  switch (type) {
    case 'bar':
    case 'histogram':
      return <BarView data={data} xKey={xKey} yKey={yKey} valueLabel={valueLabel} horizontal={false} />
    case 'horizontal_bar':
      return <BarView data={data} xKey={xKey} yKey={yKey} valueLabel={valueLabel} horizontal={true} />
    case 'line':
      return <LineView data={data} xKey={xKey} yKey={yKey} valueLabel={valueLabel} />
    case 'donut':
      return <DonutView data={data} xKey={xKey} yKey={yKey} />
    case 'kpi':
      return <KpiView data={data} />
    case 'scatter':
      // Not yet reachable: the backend maps every current scatter-eligible operation (correlation)
      // to "kpi" instead, since it only returns an aggregate coefficient, not paired points.
      return null
    default:
      return null
  }
}

export default AnalysisChart
