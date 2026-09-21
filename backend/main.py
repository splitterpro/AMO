import io
import json

import pandas as pd
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI()
PREVIEW_ROWS = 5


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

    return {
        "rows": df.shape[0],
        "columns": df.shape[1],
        "column_info": [{"name": name, "dtype": str(dtype)} for name, dtype in df.dtypes.items()],
        "preview": json.loads(df.head(PREVIEW_ROWS).to_json(orient="records", date_format="iso")),
    }
