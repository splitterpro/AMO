import pandas as pd
from fastapi import HTTPException

from llm import AnalysisSpec

REQUIRED_FIELDS = {
    "groupby_sum": ("dimension", "measure"),
    "groupby_mean": ("dimension", "measure"),
    "trend_monthly": ("date_column", "measure"),
    "top_n": ("dimension", "measure"),
    "concentration": ("dimension", "measure"),
    "bin_relationship": ("measure", "secondary_measure"),
}


def _validate(df: pd.DataFrame, spec: AnalysisSpec) -> None:
    required = REQUIRED_FIELDS.get(spec.operation)
    if required is None:
        raise HTTPException(status_code=400, detail=f"Unknown operation '{spec.operation}'.")
    for field in required:
        column = getattr(spec, field)
        if not column:
            raise HTTPException(status_code=400, detail=f"Operation '{spec.operation}' is missing '{field}'.")
        if column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{column}' was not found in this dataset.")


def _groupby_sum(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].sum().reset_index()
    grouped = grouped.sort_values(spec.measure, ascending=spec.sort == "asc").head(spec.limit)
    return grouped.rename(columns={spec.dimension: "category", spec.measure: "value"})


def _groupby_mean(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].mean().reset_index()
    grouped = grouped.sort_values(spec.measure, ascending=spec.sort == "asc").head(spec.limit)
    return grouped.rename(columns={spec.dimension: "category", spec.measure: "value"})


def _trend_monthly(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    dates = pd.to_datetime(df[spec.date_column], errors="coerce")
    monthly = (
        df.assign(_month=dates.dt.to_period("M"))
        .dropna(subset=["_month"])
        .groupby("_month")[spec.measure]
        .sum()
        .reset_index()
    )
    monthly["_month"] = monthly["_month"].astype(str)
    return monthly.rename(columns={"_month": "month", spec.measure: "value"})


def _top_n(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].sum().sort_values(ascending=False).head(spec.limit).reset_index()
    return grouped.rename(columns={spec.dimension: "category", spec.measure: "value"})


def _concentration(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].sum().sort_values(ascending=False)
    top = grouped.head(spec.limit or 10)
    return top.reset_index().rename(columns={spec.dimension: "category", spec.measure: "value"})


def _bin_relationship(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    x, y = spec.measure, spec.secondary_measure
    binned = df.copy()
    try:
        binned["_band"] = pd.qcut(binned[x], q=5, duplicates="drop")
    except ValueError:
        binned["_band"] = pd.cut(binned[x], bins=5)
    summary = binned.groupby("_band", observed=True)[y].mean().reset_index()
    summary["_band"] = summary["_band"].astype(str)
    return summary.rename(columns={"_band": "band", y: "value"})


OPERATIONS = {
    "groupby_sum": _groupby_sum,
    "groupby_mean": _groupby_mean,
    "trend_monthly": _trend_monthly,
    "top_n": _top_n,
    "concentration": _concentration,
    "bin_relationship": _bin_relationship,
}


def run_analysis(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    _validate(df, spec)
    return OPERATIONS[spec.operation](df, spec)
