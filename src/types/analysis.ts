export type Operation =
  | 'groupby_sum'
  | 'groupby_mean'
  | 'groupby_count'
  | 'groupby_median'
  | 'groupby_min'
  | 'groupby_max'
  | 'top_n'
  | 'bottom_n'
  | 'trend_daily'
  | 'trend_weekly'
  | 'trend_monthly'
  | 'trend_yearly'
  | 'percentage_change'
  | 'growth_rate'
  | 'distribution'
  | 'standard_deviation'
  | 'correlation'
  | 'concentration'
  | 'bin_relationship'

export type AnalysisCategory = 'Trends' | 'Comparisons' | 'Top & Bottom' | 'Relationships' | 'Statistics'

export type VisualizationType = 'bar' | 'line' | 'horizontal_bar' | 'donut' | 'scatter' | 'histogram' | 'kpi'

export interface AnalysisQuestion {
  id: number
  label: string
  question: string
  description: string
  category: AnalysisCategory
}

export interface Metric {
  label: string
  column: string
  type: 'sum' | 'unique_count'
  value: number
}

export interface Visualization {
  type: VisualizationType
  data: Record<string, unknown>[]
}

export interface CalculationDetails {
  operation: Operation
  dimension_column: string | null
  measure_column: string | null
  secondary_measure_column: string | null
  date_column: string | null
  aggregation: string
  rows_analyzed: number
  calculated_by: string
}

export interface AnalysisResult {
  question_id: number
  answer: string
  table: Record<string, unknown>[] | null
  visualization: Visualization
  calculation: CalculationDetails
}
