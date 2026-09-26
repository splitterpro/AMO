export const KPI_FIELD_LABEL: Record<string, string> = {
  first_period: 'First period',
  last_period: 'Last period',
  first_value: 'First value',
  last_value: 'Last value',
  growth_rate_pct: 'Growth rate',
  mean: 'Mean',
  std: 'Std. deviation',
  min: 'Min',
  max: 'Max',
  median: 'Median',
  measure_a: 'Measure A',
  measure_b: 'Measure B',
  correlation: 'Correlation',
  n: 'Sample size',
}

export const COLUMN_LABEL: Record<string, string> = {
  category: 'Category',
  value: 'Value',
  period: 'Period',
  band: 'Band',
  bin: 'Bin',
  bin_min: 'Bin min',
  bin_max: 'Bin max',
  count: 'Count',
  share_pct: 'Share %',
  pct_change: '% change',
}

const PERCENT_FIELDS = new Set(['growth_rate_pct', 'share_pct', 'pct_change'])

export function isPercentField(key: string): boolean {
  return PERCENT_FIELDS.has(key)
}

export function kpiFieldLabel(key: string): string {
  return KPI_FIELD_LABEL[key] ?? key
}

function toTitleCase(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function columnLabel(key: string): string {
  return COLUMN_LABEL[key] ?? KPI_FIELD_LABEL[key] ?? toTitleCase(key)
}

interface SeriesKeys {
  xKey: string
  yKey: string
}

export function resolveSeriesKeys(row: Record<string, unknown> | undefined): SeriesKeys {
  if (!row) return { xKey: 'category', yKey: 'value' }
  if ('band' in row) return { xKey: 'band', yKey: 'value' }
  if ('bin' in row) return { xKey: 'bin', yKey: 'count' }
  if ('period' in row) return { xKey: 'period', yKey: 'value' }
  if ('x' in row && 'y' in row) return { xKey: 'x', yKey: 'y' }
  return { xKey: 'category', yKey: 'value' }
}
