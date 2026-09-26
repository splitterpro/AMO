from typing import Literal, Optional

from pydantic import BaseModel, Field

Operation = Literal[
    "groupby_sum",
    "groupby_mean",
    "groupby_count",
    "groupby_median",
    "groupby_min",
    "groupby_max",
    "top_n",
    "bottom_n",
    "trend_daily",
    "trend_weekly",
    "trend_monthly",
    "trend_yearly",
    "percentage_change",
    "growth_rate",
    "distribution",
    "standard_deviation",
    "correlation",
    "concentration",
    "bin_relationship",
]

Category = Literal["Trends", "Comparisons", "Top & Bottom", "Relationships", "Statistics"]

# Category is derived from operation in code (not asked of Gemini) so it can never
# drift between two questions using the same operation - see llm.py's generate_questions.
OPERATION_CATEGORY: dict[str, Category] = {
    "trend_daily": "Trends",
    "trend_weekly": "Trends",
    "trend_monthly": "Trends",
    "trend_yearly": "Trends",
    "percentage_change": "Trends",
    "growth_rate": "Trends",
    "groupby_sum": "Comparisons",
    "groupby_mean": "Comparisons",
    "groupby_count": "Comparisons",
    "groupby_median": "Comparisons",
    "groupby_min": "Comparisons",
    "groupby_max": "Comparisons",
    "concentration": "Comparisons",
    "top_n": "Top & Bottom",
    "bottom_n": "Top & Bottom",
    "correlation": "Relationships",
    "bin_relationship": "Relationships",
    "distribution": "Statistics",
    "standard_deviation": "Statistics",
}

VisualizationType = Literal["bar", "line", "horizontal_bar", "donut", "scatter", "histogram", "kpi"]

# Deterministic operation -> chart-type lookup so the frontend never asks Gemini to pick a
# chart type. "kpi" marks operations whose handler always returns a single summary row
# (growth_rate, standard_deviation, correlation) rather than a plottable series - see
# analysis.py for the per-operation output shapes this is derived from. correlation is
# "kpi" rather than "scatter" because it currently returns one aggregate coefficient row,
# not raw paired points to plot; true scatter support is a future analysis.py enhancement.
OPERATION_VISUALIZATION: dict[str, VisualizationType] = {
    "groupby_sum": "bar",
    "groupby_mean": "bar",
    "groupby_median": "bar",
    "groupby_min": "bar",
    "groupby_max": "bar",
    "groupby_count": "bar",
    "top_n": "horizontal_bar",
    "bottom_n": "horizontal_bar",
    "trend_daily": "line",
    "trend_weekly": "line",
    "trend_monthly": "line",
    "trend_yearly": "line",
    "percentage_change": "line",
    "growth_rate": "kpi",
    "distribution": "histogram",
    "standard_deviation": "kpi",
    "correlation": "kpi",
    "concentration": "donut",
    "bin_relationship": "bar",
}

# Human-readable aggregation label for the "Calculation Details" transparency panel.
OPERATION_AGGREGATION_LABEL: dict[str, str] = {
    "groupby_sum": "SUM",
    "groupby_mean": "AVERAGE",
    "groupby_count": "COUNT",
    "groupby_median": "MEDIAN",
    "groupby_min": "MIN",
    "groupby_max": "MAX",
    "top_n": "SUM",
    "bottom_n": "SUM",
    "trend_daily": "SUM",
    "trend_weekly": "SUM",
    "trend_monthly": "SUM",
    "trend_yearly": "SUM",
    "percentage_change": "PERCENT_CHANGE",
    "growth_rate": "GROWTH_RATE",
    "distribution": "DISTRIBUTION",
    "standard_deviation": "STATISTICS",
    "correlation": "CORRELATION",
    "concentration": "SHARE_OF_TOTAL",
    "bin_relationship": "BINNED_AVERAGE",
}


class AnalysisSpec(BaseModel):
    operation: Operation
    dimension: Optional[str] = None
    measure: Optional[str] = None
    secondary_measure: Optional[str] = None
    date_column: Optional[str] = None
    sort: Literal["asc", "desc"] = "desc"
    limit: int = Field(default=5, ge=1, le=50)


class QuestionSpec(BaseModel):
    label: str
    question: str
    description: str
    category: Category
    analysis: AnalysisSpec


class QuestionsResponse(BaseModel):
    questions: list[QuestionSpec]
