import pandas as pd

from models import AnalysisSpec
from validation import validate

_TREND_PERIOD_FREQ = {
    "trend_daily": "D",
    "trend_weekly": "W",
    "trend_monthly": "M",
    "trend_yearly": "Y",
}


def _groupby_agg(df: pd.DataFrame, spec: AnalysisSpec, agg: str) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].agg(agg).reset_index()
    grouped = grouped.sort_values(spec.measure, ascending=spec.sort == "asc").head(spec.limit)
    return grouped.rename(columns={spec.dimension: "category", spec.measure: "value"})


def _groupby_sum(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _groupby_agg(df, spec, "sum")


def _groupby_mean(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _groupby_agg(df, spec, "mean")


def _groupby_median(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _groupby_agg(df, spec, "median")


def _groupby_min(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _groupby_agg(df, spec, "min")


def _groupby_max(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _groupby_agg(df, spec, "max")


def _groupby_count(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension).size().reset_index(name="value")
    grouped = grouped.sort_values("value", ascending=spec.sort == "asc").head(spec.limit)
    return grouped.rename(columns={spec.dimension: "category"})


def _rank_n(df: pd.DataFrame, spec: AnalysisSpec, ascending: bool) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].sum().sort_values(ascending=ascending).head(spec.limit).reset_index()
    return grouped.rename(columns={spec.dimension: "category", spec.measure: "value"})


def _top_n(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _rank_n(df, spec, ascending=False)


def _bottom_n(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _rank_n(df, spec, ascending=True)


def _trend(df: pd.DataFrame, spec: AnalysisSpec, freq: str) -> pd.DataFrame:
    dates = pd.to_datetime(df[spec.date_column], errors="coerce")
    trend = (
        df.assign(_period=dates.dt.to_period(freq))
        .dropna(subset=["_period"])
        .groupby("_period")[spec.measure]
        .sum()
        .reset_index()
    )
    trend["_period"] = trend["_period"].astype(str)
    return trend.rename(columns={"_period": "period", spec.measure: "value"})


def _trend_daily(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _trend(df, spec, _TREND_PERIOD_FREQ["trend_daily"])


def _trend_weekly(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _trend(df, spec, _TREND_PERIOD_FREQ["trend_weekly"])


def _trend_monthly(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _trend(df, spec, _TREND_PERIOD_FREQ["trend_monthly"])


def _trend_yearly(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    return _trend(df, spec, _TREND_PERIOD_FREQ["trend_yearly"])


def _percentage_change(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    monthly = _trend(df, spec, "M")
    monthly["pct_change"] = (monthly["value"].pct_change() * 100).round(2)
    return monthly


def _growth_rate(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    monthly = _trend(df, spec, "M")
    first_period, last_period = monthly["period"].iloc[0], monthly["period"].iloc[-1]
    first_value, last_value = float(monthly["value"].iloc[0]), float(monthly["value"].iloc[-1])
    growth_rate_pct = None if first_value == 0 else round((last_value - first_value) / first_value * 100, 2)
    return pd.DataFrame(
        [
            {
                "first_period": first_period,
                "last_period": last_period,
                "first_value": first_value,
                "last_value": last_value,
                "growth_rate_pct": growth_rate_pct,
            }
        ]
    )


def _distribution(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    values = pd.to_numeric(df[spec.measure], errors="coerce").dropna()
    binned = pd.cut(values, bins=10)
    counts = binned.value_counts(sort=False).reset_index()
    counts.columns = ["bin", "count"]
    counts["bin_min"] = counts["bin"].apply(lambda b: round(float(b.left), 2))
    counts["bin_max"] = counts["bin"].apply(lambda b: round(float(b.right), 2))
    counts["bin"] = counts["bin"].astype(str)
    return counts[["bin", "bin_min", "bin_max", "count"]]


def _standard_deviation(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    values = pd.to_numeric(df[spec.measure], errors="coerce").dropna()
    return pd.DataFrame(
        [
            {
                "mean": round(float(values.mean()), 2),
                "std": round(float(values.std()), 2),
                "min": round(float(values.min()), 2),
                "max": round(float(values.max()), 2),
                "median": round(float(values.median()), 2),
            }
        ]
    )


def _correlation(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    a = pd.to_numeric(df[spec.measure], errors="coerce")
    b = pd.to_numeric(df[spec.secondary_measure], errors="coerce")
    paired = pd.DataFrame({"a": a, "b": b}).dropna()
    correlation = None if len(paired) < 2 else round(float(paired["a"].corr(paired["b"])), 4)
    return pd.DataFrame(
        [
            {
                "measure_a": spec.measure,
                "measure_b": spec.secondary_measure,
                "correlation": correlation,
                "n": len(paired),
            }
        ]
    )


SCATTER_POINT_CAP = 200


def _scatter_relationship(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    a = pd.to_numeric(df[spec.measure], errors="coerce")
    b = pd.to_numeric(df[spec.secondary_measure], errors="coerce")
    paired = pd.DataFrame({"x": a, "y": b}).dropna()
    if len(paired) > SCATTER_POINT_CAP:
        paired = paired.sample(SCATTER_POINT_CAP, random_state=42)
    return paired.reset_index(drop=True)


def _concentration(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    grouped = df.groupby(spec.dimension)[spec.measure].sum().sort_values(ascending=False)
    total = float(grouped.sum())
    top = grouped.head(spec.limit or 10).reset_index()
    top = top.rename(columns={spec.dimension: "category", spec.measure: "value"})
    top["share_pct"] = (top["value"] / total * 100).round(2) if total else 0.0
    return top


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
    "groupby_count": _groupby_count,
    "groupby_median": _groupby_median,
    "groupby_min": _groupby_min,
    "groupby_max": _groupby_max,
    "top_n": _top_n,
    "bottom_n": _bottom_n,
    "trend_daily": _trend_daily,
    "trend_weekly": _trend_weekly,
    "trend_monthly": _trend_monthly,
    "trend_yearly": _trend_yearly,
    "percentage_change": _percentage_change,
    "growth_rate": _growth_rate,
    "distribution": _distribution,
    "standard_deviation": _standard_deviation,
    "correlation": _correlation,
    "concentration": _concentration,
    "bin_relationship": _bin_relationship,
    "scatter_relationship": _scatter_relationship,
}


def run_analysis(df: pd.DataFrame, spec: AnalysisSpec) -> pd.DataFrame:
    validate(df, spec)
    return OPERATIONS[spec.operation](df, spec)
