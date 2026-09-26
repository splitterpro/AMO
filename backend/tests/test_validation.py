import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models import AnalysisSpec
from validation import validate


def test_unknown_operation_rejected_by_model():
    with pytest.raises(ValidationError):
        AnalysisSpec(operation="not_a_real_operation", measure="Value")


def test_missing_required_field_raises_400(edge_df):
    spec = AnalysisSpec(operation="groupby_sum", measure="Value")  # dimension missing
    with pytest.raises(HTTPException) as exc_info:
        validate(edge_df, spec)
    assert exc_info.value.status_code == 400


def test_unknown_column_raises_400(edge_df):
    spec = AnalysisSpec(operation="groupby_sum", dimension="NotAColumn", measure="Value")
    with pytest.raises(HTTPException) as exc_info:
        validate(edge_df, spec)
    assert exc_info.value.status_code == 400


def test_non_numeric_measure_raises_400(edge_df):
    spec = AnalysisSpec(operation="groupby_sum", dimension="Category", measure="Label")
    with pytest.raises(HTTPException) as exc_info:
        validate(edge_df, spec)
    assert exc_info.value.status_code == 400


def test_unparseable_date_column_raises_400(edge_df):
    spec = AnalysisSpec(operation="trend_monthly", date_column="Order Date", measure="Value")
    with pytest.raises(HTTPException) as exc_info:
        validate(edge_df, spec)
    assert exc_info.value.status_code == 400


def test_valid_spec_passes(sales_df):
    spec = AnalysisSpec(operation="trend_monthly", date_column="Order Date", measure="Sales")
    validate(sales_df, spec)  # should not raise


def test_groupby_count_does_not_require_measure(sales_df):
    spec = AnalysisSpec(operation="groupby_count", dimension="Region")
    validate(sales_df, spec)  # should not raise


@pytest.mark.parametrize("limit", [0, 51])
def test_limit_out_of_bounds_rejected_by_model(limit):
    with pytest.raises(ValidationError):
        AnalysisSpec(operation="groupby_sum", dimension="Region", measure="Sales", limit=limit)
