import re

import pandas as pd

_SUM_PATTERN = re.compile(r"(sales|profit|revenue|amount|total|price|quantity)", re.IGNORECASE)
_UNIQUE_COUNT_PATTERN = re.compile(r"(customer|order|user|client|id)", re.IGNORECASE)


def compute_metrics(df: pd.DataFrame, max_metrics: int = 6) -> list[dict]:
    """Pandas-only heuristic scan for headline dataset metrics. No Gemini involvement."""
    metrics: list[dict] = []
    numeric_cols = set(df.select_dtypes(include="number").columns)

    for column in df.columns:
        if len(metrics) >= max_metrics:
            break
        if column in numeric_cols and _SUM_PATTERN.search(column):
            metrics.append(
                {
                    "label": f"Total {column.title()}",
                    "column": column,
                    "type": "sum",
                    "value": round(float(df[column].sum()), 2),
                }
            )
        elif _UNIQUE_COUNT_PATTERN.search(column):
            metrics.append(
                {
                    "label": f"Unique {column.title()}",
                    "column": column,
                    "type": "unique_count",
                    "value": int(df[column].nunique()),
                }
            )

    return metrics
