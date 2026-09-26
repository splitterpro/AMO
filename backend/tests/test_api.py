import io

import pytest
from fastapi.testclient import TestClient

import main
from models import AnalysisSpec, QuestionSpec

client = TestClient(main.app)

SAMPLE_CSV = (
    "Region,Sales,Profit,Order Date\n"
    "East,100,20,2023-01-05\n"
    "West,150,25,2023-01-12\n"
    "East,200,40,2023-02-01\n"
    "West,50,5,2023-02-20\n"
)


def _upload_file(content: str = SAMPLE_CSV, filename: str = "sample.csv"):
    return {"file": (filename, io.BytesIO(content.encode()), "text/csv")}


@pytest.fixture(autouse=True)
def clear_dataset_cache():
    main._datasets.clear()
    yield
    main._datasets.clear()


@pytest.fixture
def stub_questions(monkeypatch):
    """Deterministic stand-in for Gemini so API tests don't depend on network/API key."""
    questions = [
        QuestionSpec(
            label="Total Sales by Region",
            question="What are total sales by region?",
            description="Sum of sales grouped by region.",
            category="Comparisons",
            analysis=AnalysisSpec(operation="groupby_sum", dimension="Region", measure="Sales"),
        ),
        QuestionSpec(
            label="Sales vs Profit Correlation",
            question="How correlated are sales and profit?",
            description="Correlation coefficient between sales and profit.",
            category="Relationships",
            analysis=AnalysisSpec(operation="correlation", measure="Sales", secondary_measure="Profit"),
        ),
    ]
    monkeypatch.setattr(main, "generate_questions", lambda df, column_info, preview_rows: questions)
    monkeypatch.setattr(main, "narrate_answer", lambda question, table: "Stubbed narration.")
    return questions


def test_summary_returns_expected_shape(stub_questions):
    response = client.post("/api/csv/summary", files=_upload_file())
    assert response.status_code == 200
    body = response.json()
    assert body["rows"] == 4
    assert body["columns"] == 4
    assert len(body["metrics"]) >= 1
    assert len(body["questions"]) == 2
    assert body["questions"][0]["category"] == "Comparisons"
    assert "dataset_id" in body


def test_summary_rejects_non_csv():
    response = client.post("/api/csv/summary", files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")})
    assert response.status_code == 400
    assert "csv" in response.json()["detail"].lower()


def test_summary_rejects_empty_csv():
    response = client.post("/api/csv/summary", files=_upload_file(content="", filename="empty.csv"))
    assert response.status_code == 400


def test_ask_returns_visualization_and_calculation(stub_questions):
    summary = client.post("/api/csv/summary", files=_upload_file()).json()
    dataset_id = summary["dataset_id"]

    response = client.post("/api/csv/ask", json={"dataset_id": dataset_id, "question_id": 1})
    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Stubbed narration."
    assert body["visualization"]["type"] == "bar"
    assert body["calculation"]["operation"] == "groupby_sum"
    assert body["calculation"]["aggregation"] == "SUM"
    assert body["calculation"]["calculated_by"] == "pandas"
    assert body["table"][0]["category"] in ("East", "West")


def test_ask_correlation_question_returns_kpi(stub_questions):
    summary = client.post("/api/csv/summary", files=_upload_file()).json()
    dataset_id = summary["dataset_id"]

    response = client.post("/api/csv/ask", json={"dataset_id": dataset_id, "question_id": 2})
    body = response.json()
    assert body["visualization"]["type"] == "kpi"
    assert body["calculation"]["aggregation"] == "CORRELATION"


def test_ask_unknown_question_id(stub_questions):
    summary = client.post("/api/csv/summary", files=_upload_file()).json()
    dataset_id = summary["dataset_id"]

    response = client.post("/api/csv/ask", json={"dataset_id": dataset_id, "question_id": 999})
    assert response.status_code == 400


def test_ask_unknown_dataset_id():
    response = client.post("/api/csv/ask", json={"dataset_id": "does-not-exist", "question_id": 1})
    assert response.status_code == 404
