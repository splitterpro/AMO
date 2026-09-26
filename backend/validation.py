import pandas as pd
from fastapi import HTTPException

from models import AnalysisSpec

REQUIRED_FIELDS: dict[str, tuple[str, ...]] = {
    "groupby_sum": ("dimension", "measure"),
    "groupby_mean": ("dimension", "measure"),
    "groupby_count": ("dimension",),
    "groupby_median": ("dimension", "measure"),
    "groupby_min": ("dimension", "measure"),
    "groupby_max": ("dimension", "measure"),
    "top_n": ("dimension", "measure"),
    "bottom_n": ("dimension", "measure"),
    "trend_daily": ("date_column", "measure"),
    "trend_weekly": ("date_column", "measure"),
    "trend_monthly": ("date_column", "measure"),
    "trend_yearly": ("date_column", "measure"),
    "percentage_change": ("date_column", "measure"),
    "growth_rate": ("date_column", "measure"),
    "distribution": ("measure",),
    "standard_deviation": ("measure",),
    "correlation": ("measure", "secondary_measure"),
    "concentration": ("dimension", "measure"),
    "bin_relationship": ("measure", "secondary_measure"),
    "scatter_relationship": ("measure", "secondary_measure"),
}

# Operation -> spec fields that must resolve to a numeric-dtype column.
NUMERIC_FIELDS: dict[str, tuple[str, ...]] = {
    "groupby_sum": ("measure",),
    "groupby_mean": ("measure",),
    "groupby_median": ("measure",),
    "groupby_min": ("measure",),
    "groupby_max": ("measure",),
    "top_n": ("measure",),
    "bottom_n": ("measure",),
    "trend_daily": ("measure",),
    "trend_weekly": ("measure",),
    "trend_monthly": ("measure",),
    "trend_yearly": ("measure",),
    "percentage_change": ("measure",),
    "growth_rate": ("measure",),
    "distribution": ("measure",),
    "standard_deviation": ("measure",),
    "correlation": ("measure", "secondary_measure"),
    "concentration": ("measure",),
    "bin_relationship": ("measure", "secondary_measure"),
    "scatter_relationship": ("measure", "secondary_measure"),
}

DATE_FIELDS: dict[str, tuple[str, ...]] = {
    "trend_daily": ("date_column",),
    "trend_weekly": ("date_column",),
    "trend_monthly": ("date_column",),
    "trend_yearly": ("date_column",),
    "percentage_change": ("date_column",),
    "growth_rate": ("date_column",),
}

MIN_DATE_PARSE_RATIO = 0.9


def validate(df: pd.DataFrame, spec: AnalysisSpec) -> None:
    """Validates an AnalysisSpec against a concrete DataFrame beyond what pydantic
    already checks on the spec itself (e.g. the 1<=limit<=50 bound)."""
    _validate_required_fields(df, spec)
    _validate_numeric_fields(df, spec)
    _validate_date_fields(df, spec)


def _validate_required_fields(df: pd.DataFrame, spec: AnalysisSpec) -> None:
    required = REQUIRED_FIELDS.get(spec.operation)
    if required is None:
        raise HTTPException(status_code=400, detail=f"Unknown operation '{spec.operation}'.")
    for field in required:
        column = getattr(spec, field)
        if not column:
            raise HTTPException(status_code=400, detail=f"Operation '{spec.operation}' is missing '{field}'.")
        if column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{column}' was not found in this dataset.")


def _validate_numeric_fields(df: pd.DataFrame, spec: AnalysisSpec) -> None:
    for field in NUMERIC_FIELDS.get(spec.operation, ()):
        column = getattr(spec, field)
        if column and not _is_numeric_dtype(df, column):
            raise HTTPException(
                status_code=400,
                detail=f"Column '{column}' must be numeric for operation '{spec.operation}'.",
            )


def _validate_date_fields(df: pd.DataFrame, spec: AnalysisSpec) -> None:
    for field in DATE_FIELDS.get(spec.operation, ()):
        column = getattr(spec, field)
        if column and not _is_date_parseable(df, column):
            raise HTTPException(
                status_code=400,
                detail=f"Column '{column}' does not contain enough parseable dates for operation '{spec.operation}'.",
            )


def _is_numeric_dtype(df: pd.DataFrame, column: str) -> bool:
    return pd.api.types.is_numeric_dtype(df[column])


def _is_date_parseable(df: pd.DataFrame, column: str, sample_size: int = 50) -> bool:
    sample = df[column].dropna().head(sample_size)
    if sample.empty:
        return False
    parsed = pd.to_datetime(sample, errors="coerce")
    return parsed.notna().mean() >= MIN_DATE_PARSE_RATIO
