import pandas as pd
import pytest


@pytest.fixture
def sales_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Region": ["East", "East", "West", "West", "East", "West", "East", "West"],
            "Order Date": [
                "2023-01-05",
                "2023-01-20",
                "2023-02-10",
                "2023-02-15",
                "2023-03-01",
                "2023-03-12",
                "2023-04-02",
                "2023-04-18",
            ],
            "Sales": [100, 150, 200, 50, 300, 120, 90, 180],
            "Discount": [0.1, 0.2, 0.0, 0.3, 0.1, 0.15, 0.05, 0.25],
        }
    )


@pytest.fixture
def edge_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Category": ["A", "A", "B", "B", None],
            "Value": [10, None, 20, 20, 30],
            "Constant": [5, 5, 5, 5, 5],
            "Order Date": ["2023-01-01", "not-a-date", "2023-01-03", None, "2023-01-05"],
            "Label": ["x", "y", "z", "w", "v"],
        }
    )
