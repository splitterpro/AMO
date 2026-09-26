from typing import get_args

from models import (
    OPERATION_AGGREGATION_LABEL,
    OPERATION_CATEGORY,
    OPERATION_VISUALIZATION,
    Operation,
)

ALL_OPERATIONS = set(get_args(Operation))


def test_all_operations_have_category():
    assert set(OPERATION_CATEGORY.keys()) == ALL_OPERATIONS


def test_all_operations_have_visualization():
    assert set(OPERATION_VISUALIZATION.keys()) == ALL_OPERATIONS


def test_all_operations_have_aggregation_label():
    assert set(OPERATION_AGGREGATION_LABEL.keys()) == ALL_OPERATIONS


def test_single_row_operations_are_kpi():
    # growth_rate, standard_deviation, and correlation all return exactly one
    # summary row from analysis.py - they are stat cards, not chartable series.
    for op in ("growth_rate", "standard_deviation", "correlation"):
        assert OPERATION_VISUALIZATION[op] == "kpi"
