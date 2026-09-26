import io
import json
from collections import OrderedDict
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from analysis import run_analysis
from llm import generate_questions, narrate_answer
from metrics import compute_metrics
from models import OPERATION_AGGREGATION_LABEL, OPERATION_VISUALIZATION, QuestionSpec

app = FastAPI()
PREVIEW_ROWS = 5
MAX_CACHED_DATASETS = 20

_datasets: "OrderedDict[str, dict]" = OrderedDict()


def _cache_dataset(df: pd.DataFrame, questions: list[QuestionSpec]) -> str:
    dataset_id = str(uuid4())
    _datasets[dataset_id] = {"df": df, "questions": {i + 1: q for i, q in enumerate(questions)}}
    if len(_datasets) > MAX_CACHED_DATASETS:
        _datasets.popitem(last=False)
    return dataset_id


def _get_dataset(dataset_id: str) -> dict:
    entry = _datasets.get(dataset_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Dataset not found, please re-upload the file.")
    return entry


@app.post("/api/csv/summary")
async def summarize(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    content = await file.read()
    try:
        try:
            df = pd.read_csv(io.BytesIO(content))
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as err:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {err}")

    if df.shape[0] == 0 or df.shape[1] == 0:
        raise HTTPException(status_code=400, detail="The CSV file has no data.")

    column_info = [{"name": name, "dtype": str(dtype)} for name, dtype in df.dtypes.items()]
    preview_rows = json.loads(df.head(PREVIEW_ROWS).to_json(orient="records", date_format="iso"))

    questions = await run_in_threadpool(generate_questions, df, column_info, preview_rows)
    dataset_id = _cache_dataset(df, questions)
    metrics = compute_metrics(df)

    return {
        "dataset_id": dataset_id,
        "rows": df.shape[0],
        "columns": df.shape[1],
        "column_info": column_info,
        "preview": preview_rows,
        "metrics": metrics,
        "questions": [
            {
                "id": i + 1,
                "label": q.label,
                "question": q.question,
                "description": q.description,
                "category": q.category,
            }
            for i, q in enumerate(questions)
        ],
    }


class AskRequest(BaseModel):
    dataset_id: str
    question_id: int


@app.post("/api/csv/ask")
async def ask(body: AskRequest):
    entry = _get_dataset(body.dataset_id)
    spec = entry["questions"].get(body.question_id)
    if spec is None:
        raise HTTPException(status_code=400, detail=f"Unknown question_id {body.question_id}.")

    table = run_analysis(entry["df"], spec.analysis)
    table_records = table.to_dict("records")
    answer = await run_in_threadpool(narrate_answer, spec.question, table_records)

    return {
        "question_id": body.question_id,
        "answer": answer,
        "table": table_records,
        "visualization": {
            "type": OPERATION_VISUALIZATION[spec.analysis.operation],
            "data": table_records,
        },
        "calculation": {
            "operation": spec.analysis.operation,
            "dimension_column": spec.analysis.dimension,
            "measure_column": spec.analysis.measure,
            "secondary_measure_column": spec.analysis.secondary_measure,
            "date_column": spec.analysis.date_column,
            "aggregation": OPERATION_AGGREGATION_LABEL[spec.analysis.operation],
            "rows_analyzed": len(entry["df"]),
            "calculated_by": "pandas",
        },
    }
