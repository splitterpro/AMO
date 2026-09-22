import io
import json
from collections import OrderedDict
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from questions import answer_question

app = FastAPI()
PREVIEW_ROWS = 5
MAX_CACHED_DATASETS = 20

_datasets: "OrderedDict[str, pd.DataFrame]" = OrderedDict()


def _cache_dataset(df: pd.DataFrame) -> str:
    dataset_id = str(uuid4())
    _datasets[dataset_id] = df
    if len(_datasets) > MAX_CACHED_DATASETS:
        _datasets.popitem(last=False)
    return dataset_id


def _get_dataset(dataset_id: str) -> pd.DataFrame:
    df = _datasets.get(dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found, please re-upload the file.")
    return df


def error(message: str):
    return JSONResponse(status_code=400, content={"detail": message})


@app.post("/api/csv/summary")
async def summarize(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
        return error("Only .csv files are supported.")

    content = await file.read()
    try:
        try:
            df = pd.read_csv(io.BytesIO(content))
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as err:
        return error(f"Could not parse CSV: {err}")

    if df.shape[0] == 0 or df.shape[1] == 0:
        return error("The CSV file has no data.")

    dataset_id = _cache_dataset(df)

    return {
        "dataset_id": dataset_id,
        "rows": df.shape[0],
        "columns": df.shape[1],
        "column_info": [{"name": name, "dtype": str(dtype)} for name, dtype in df.dtypes.items()],
        "preview": json.loads(df.head(PREVIEW_ROWS).to_json(orient="records", date_format="iso")),
    }


class AskRequest(BaseModel):
    dataset_id: str
    question_id: int


@app.post("/api/csv/ask")
async def ask(body: AskRequest):
    df = _get_dataset(body.dataset_id)
    return answer_question(df, body.question_id)
