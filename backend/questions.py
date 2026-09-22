import pandas as pd
from fastapi import HTTPException


def resolve_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    lower_map = {c.lower(): c for c in df.columns}
    for candidate in candidates:
        match = lower_map.get(candidate.lower())
        if match:
            return match
    return None


def require_columns(df: pd.DataFrame, needed: dict[str, list[str]]) -> dict[str, str]:
    resolved = {}
    missing = []
    for logical_name, candidates in needed.items():
        column = resolve_column(df, candidates)
        if column is None:
            missing.append(candidates[0])
        else:
            resolved[logical_name] = column
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"This question needs column(s) {', '.join(missing)}, which weren't found in your CSV.",
        )
    return resolved


def _losing_products(df: pd.DataFrame):
    cols = require_columns(df, {
        "category": ["Sub-Category", "Sub Category", "Category"],
        "sales": ["Sales"],
        "profit": ["Profit"],
    })
    grouped = df.groupby(cols["category"])[[cols["sales"], cols["profit"]]].sum().reset_index()
    losers = grouped[grouped[cols["profit"]] < 0].sort_values(cols["sales"], ascending=False).head(5)
    if losers.empty:
        answer = "No product lines are currently losing money."
    else:
        names = ", ".join(losers[cols["category"]].tolist())
        answer = f"These product lines sell well but lose money: {names}."
    return {
        "question_id": 1,
        "answer": answer,
        "table": losers.rename(
            columns={cols["category"]: "category", cols["sales"]: "sales", cols["profit"]: "profit"}
        ).to_dict("records"),
    }


def _discount_threshold(df: pd.DataFrame):
    cols = require_columns(df, {"discount": ["Discount"], "profit": ["Profit"]})
    bins = [-0.01, 0, 0.1, 0.2, 0.3, 1.0]
    labels = ["0%", "0-10%", "10-20%", "20-30%", "30%+"]
    binned = df.copy()
    binned["discount_band"] = pd.cut(binned[cols["discount"]], bins=bins, labels=labels)
    summary = binned.groupby("discount_band", observed=True)[cols["profit"]].mean().reset_index()
    losing = summary[summary[cols["profit"]] < 0]
    if losing.empty:
        answer = "Sales stay profitable across all discount levels in this data."
    else:
        threshold = losing.iloc[0]["discount_band"]
        answer = f"Average profit turns negative once discounts reach the {threshold} range."
    return {
        "question_id": 2,
        "answer": answer,
        "table": summary.rename(columns={cols["profit"]: "avg_profit"}).to_dict("records"),
    }


def _weak_regions(df: pd.DataFrame):
    cols = require_columns(df, {"region": ["Region"], "state": ["State"], "profit": ["Profit"]})
    by_region = df.groupby(cols["region"])[cols["profit"]].sum().sort_values().reset_index()
    by_state = df.groupby(cols["state"])[cols["profit"]].sum().sort_values().head(5).reset_index()
    worst_region = by_region.iloc[0]
    answer = (
        f"{worst_region[cols['region']]} is the weakest region (profit {worst_region[cols['profit']]:.0f}); "
        f"the hardest-hit states are {', '.join(by_state[cols['state']].tolist())}."
    )
    return {
        "question_id": 3,
        "answer": answer,
        "table": by_state.rename(columns={cols["state"]: "state", cols["profit"]: "profit"}).to_dict("records"),
    }


def _profit_stars(df: pd.DataFrame):
    cols = require_columns(df, {"category": ["Sub-Category", "Sub Category", "Category"], "profit": ["Profit"]})
    grouped = df.groupby(cols["category"])[cols["profit"]].sum().sort_values(ascending=False).head(5).reset_index()
    answer = f"Top profit-makers: {', '.join(grouped[cols['category']].tolist())}."
    return {
        "question_id": 4,
        "answer": answer,
        "table": grouped.rename(columns={cols["category"]: "category", cols["profit"]: "profit"}).to_dict("records"),
    }


def _key_customers(df: pd.DataFrame):
    cols = require_columns(df, {"customer": ["Customer Name", "Customer"], "sales": ["Sales"], "profit": ["Profit"]})
    grouped = (
        df.groupby(cols["customer"])[[cols["sales"], cols["profit"]]]
        .sum()
        .sort_values(cols["sales"], ascending=False)
    )
    total_sales = grouped[cols["sales"]].sum()
    top10 = grouped.head(10)
    share = (top10[cols["sales"]].sum() / total_sales * 100) if total_sales else 0
    profitable = bool((top10[cols["profit"]] > 0).all())
    answer = (
        f"The top 10 customers account for {share:.0f}% of total sales, and are "
        f"{'all profitable' if profitable else 'not all profitable'}."
    )
    return {
        "question_id": 5,
        "answer": answer,
        "table": top10.reset_index().rename(
            columns={cols["customer"]: "customer", cols["sales"]: "sales", cols["profit"]: "profit"}
        ).to_dict("records"),
    }


def _growth_and_peaks(df: pd.DataFrame):
    cols = require_columns(df, {"date": ["Order Date", "Date"], "sales": ["Sales"], "profit": ["Profit"]})
    dates = pd.to_datetime(df[cols["date"]], errors="coerce")
    monthly = (
        df.assign(_month=dates.dt.to_period("M"))
        .groupby("_month")[[cols["sales"], cols["profit"]]]
        .sum()
        .reset_index()
    )
    monthly["_month"] = monthly["_month"].astype(str)
    busiest = monthly.sort_values(cols["sales"], ascending=False).iloc[0]
    trend = "growing" if monthly[cols["sales"]].iloc[-1] > monthly[cols["sales"]].iloc[0] else "declining"
    answer = f"Sales are {trend} overall; the busiest month is {busiest['_month']} (sales {busiest[cols['sales']]:.0f})."
    return {
        "question_id": 6,
        "answer": answer,
        "table": monthly.rename(columns={cols["sales"]: "sales", cols["profit"]: "profit"}).to_dict("records"),
    }


QUESTION_HANDLERS = {
    1: _losing_products,
    2: _discount_threshold,
    3: _weak_regions,
    4: _profit_stars,
    5: _key_customers,
    6: _growth_and_peaks,
}


def answer_question(df: pd.DataFrame, question_id: int) -> dict:
    handler = QUESTION_HANDLERS.get(question_id)
    if handler is None:
        raise HTTPException(status_code=400, detail=f"Unknown question_id {question_id}.")
    return handler(df)
