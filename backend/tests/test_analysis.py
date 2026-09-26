import math

import pandas as pd
import pytest

from analysis import run_analysis
from models import AnalysisSpec


def _spec(**kwargs) -> AnalysisSpec:
    return AnalysisSpec(**kwargs)


def test_groupby_sum(sales_df):
    result = run_analysis(sales_df, _spec(operation="groupby_sum", dimension="Region", measure="Sales"))
    values = dict(zip(result["category"], result["value"]))
    assert values == {"East": 640, "West": 550}
    assert list(result["category"]) == ["East", "West"]


def test_groupby_mean(sales_df):
    result = run_analysis(sales_df, _spec(operation="groupby_mean", dimension="Region", measure="Sales"))
    values = dict(zip(result["category"], result["value"]))
    assert values["East"] == pytest.approx(160.0)
    assert values["West"] == pytest.approx(137.5)


def test_groupby_count(sales_df):
    result = run_analysis(sales_df, _spec(operation="groupby_count", dimension="Region"))
    values = dict(zip(result["category"], result["value"]))
    assert values == {"East": 4, "West": 4}


def test_groupby_median(sales_df):
    result = run_analysis(sales_df, _spec(operation="groupby_median", dimension="Region", measure="Sales"))
    values = dict(zip(result["category"], result["value"]))
    assert values["East"] == pytest.approx(125.0)
    assert values["West"] == pytest.approx(150.0)


def test_groupby_min(sales_df):
    result = run_analysis(sales_df, _spec(operation="groupby_min", dimension="Region", measure="Sales"))
    values = dict(zip(result["category"], result["value"]))
    assert values == {"East": 90, "West": 50}


def test_groupby_max(sales_df):
    result = run_analysis(sales_df, _spec(operation="groupby_max", dimension="Region", measure="Sales"))
    values = dict(zip(result["category"], result["value"]))
    assert values == {"East": 300, "West": 200}


def test_top_n(sales_df):
    result = run_analysis(sales_df, _spec(operation="top_n", dimension="Region", measure="Sales", limit=1))
    assert list(result["category"]) == ["East"]
    assert result["value"].iloc[0] == 640


def test_bottom_n(sales_df):
    result = run_analysis(sales_df, _spec(operation="bottom_n", dimension="Region", measure="Sales", limit=1))
    assert list(result["category"]) == ["West"]
    assert result["value"].iloc[0] == 550


def test_trend_daily(sales_df):
    result = run_analysis(sales_df, _spec(operation="trend_daily", date_column="Order Date", measure="Sales"))
    assert len(result) == 8
    assert result["value"].sum() == 1190


def test_trend_weekly(sales_df):
    result = run_analysis(sales_df, _spec(operation="trend_weekly", date_column="Order Date", measure="Sales"))
    assert result["value"].sum() == 1190


def test_trend_monthly(sales_df):
    result = run_analysis(sales_df, _spec(operation="trend_monthly", date_column="Order Date", measure="Sales"))
    values = dict(zip(result["period"], result["value"]))
    assert values == {"2023-01": 250, "2023-02": 250, "2023-03": 420, "2023-04": 270}


def test_trend_yearly(sales_df):
    result = run_analysis(sales_df, _spec(operation="trend_yearly", date_column="Order Date", measure="Sales"))
    assert len(result) == 1
    assert result["value"].iloc[0] == 1190


def test_percentage_change(sales_df):
    result = run_analysis(sales_df, _spec(operation="percentage_change", date_column="Order Date", measure="Sales"))
    assert math.isnan(result["pct_change"].iloc[0])
    assert result["pct_change"].iloc[1] == pytest.approx(0.0)
    assert result["pct_change"].iloc[2] == pytest.approx(68.0)
    assert result["pct_change"].iloc[3] == pytest.approx(-35.71)


def test_growth_rate(sales_df):
    result = run_analysis(sales_df, _spec(operation="growth_rate", date_column="Order Date", measure="Sales"))
    row = result.iloc[0]
    assert row["first_value"] == 250
    assert row["last_value"] == 270
    assert row["growth_rate_pct"] == pytest.approx(8.0)


def test_growth_rate_handles_zero_first_value(sales_df):
    zeroed = sales_df.copy()
    zeroed.loc[zeroed["Order Date"].isin(["2023-01-05", "2023-01-20"]), "Sales"] = 0
    result = run_analysis(zeroed, _spec(operation="growth_rate", date_column="Order Date", measure="Sales"))
    assert result.iloc[0]["growth_rate_pct"] is None


def test_distribution(sales_df):
    result = run_analysis(sales_df, _spec(operation="distribution", measure="Sales"))
    assert list(result.columns) == ["bin", "bin_min", "bin_max", "count"]
    assert result["count"].sum() == 8


def test_standard_deviation(sales_df):
    result = run_analysis(sales_df, _spec(operation="standard_deviation", measure="Sales"))
    row = result.iloc[0]
    assert row["mean"] == pytest.approx(148.75)
    assert row["min"] == 50
    assert row["max"] == 300
    assert row["median"] == pytest.approx(135.0)


def test_correlation(sales_df):
    result = run_analysis(
        sales_df, _spec(operation="correlation", measure="Sales", secondary_measure="Discount")
    )
    row = result.iloc[0]
    assert row["n"] == 8
    assert -1.0 <= row["correlation"] <= 1.0


def test_concentration_share_is_of_full_total_not_truncated_rows(sales_df):
    # Regression test: limit=1 truncates to only "East", but share_pct must still be
    # computed against the sum of ALL regions, not just the shown row.
    result = run_analysis(sales_df, _spec(operation="concentration", dimension="Region", measure="Sales", limit=1))
    assert len(result) == 1
    row = result.iloc[0]
    assert row["category"] == "East"
    assert row["value"] == 640
    assert row["share_pct"] == pytest.approx(640 / 1190 * 100, abs=0.01)
    assert row["share_pct"] != pytest.approx(100.0)


def test_bin_relationship(sales_df):
    result = run_analysis(
        sales_df, _spec(operation="bin_relationship", measure="Sales", secondary_measure="Discount")
    )
    assert list(result.columns) == ["band", "value"]
    assert 1 <= len(result) <= 5


def test_scatter_relationship(sales_df):
    result = run_analysis(
        sales_df, _spec(operation="scatter_relationship", measure="Sales", secondary_measure="Discount")
    )
    assert list(result.columns) == ["x", "y"]
    assert len(result) == 8
    assert set(result["x"]) == set(sales_df["Sales"])
    assert set(result["y"]) == set(sales_df["Discount"])


def test_scatter_relationship_caps_point_count():
    large_df = pd.DataFrame({"A": range(500), "B": range(500)})
    result = run_analysis(large_df, _spec(operation="scatter_relationship", measure="A", secondary_measure="B"))
    assert len(result) == 200
