import json
import logging
import os
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

MODEL = "gemini-flash-lite-latest"

Operation = Literal[
    "groupby_sum",
    "groupby_mean",
    "trend_monthly",
    "top_n",
    "concentration",
    "bin_relationship",
]


class AnalysisSpec(BaseModel):
    operation: Operation
    dimension: Optional[str] = None
    measure: str
    secondary_measure: Optional[str] = None
    date_column: Optional[str] = None
    sort: Literal["asc", "desc"] = "desc"
    limit: int = 5


class QuestionSpec(BaseModel):
    label: str
    question: str
    description: str
    analysis: AnalysisSpec


class QuestionsResponse(BaseModel):
    questions: list[QuestionSpec]


QUESTIONS_SYSTEM_PROMPT = """You are a data analyst. Given a CSV file's column names, \
types, a small sample of rows, and basic per-column statistics, propose exactly 6 \
insightful analysis questions a business user would want answered from this data.

Every column name you use inside "analysis" must be copied exactly, character for \
character, from the given column list - never invent, translate, or rename a column. \
Only propose a question if the columns it needs actually exist in the given list.

Pick "operation" from this fixed set only:
- groupby_sum: sum "measure" grouped by "dimension"
- groupby_mean: average "measure" grouped by "dimension"
- trend_monthly: sum "measure" by month using "date_column"
- top_n: highest "measure" totals grouped by "dimension"
- concentration: how much of total "measure" the top group of "dimension" holds
- bin_relationship: how "measure" (x) relates to "secondary_measure" (y), binned

Only set "date_column" for trend_monthly, and only set "secondary_measure" for \
bin_relationship; leave the rest null. Prefer a variety of operations and columns \
across the 6 questions rather than repeating the same one."""

NARRATION_SYSTEM_PROMPT = """You are a data analyst. You will be given a question and \
an already-computed result table. Write a single, concise 1-2 sentence insight based \
only on the numbers given - never invent or estimate a number that isn't in the table."""

_client: genai.Client | None = None
_client_checked = False


def _get_client() -> genai.Client | None:
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set; Gemini-powered features are disabled.")
        return None
    _client = genai.Client(api_key=api_key)
    return _client


def _columns_are_valid(analysis: AnalysisSpec, valid_columns: set[str]) -> bool:
    for column in (analysis.dimension, analysis.measure, analysis.secondary_measure, analysis.date_column):
        if column is not None and column not in valid_columns:
            return False
    return True


def generate_questions(column_info: list[dict], preview_rows: list[dict]) -> list[QuestionSpec]:
    client = _get_client()
    if client is None:
        return []

    payload = {"columns": column_info, "sample_rows": preview_rows}
    try:
        response = client.interactions.create(
            model=MODEL,
            system_instruction=QUESTIONS_SYSTEM_PROMPT,
            input=json.dumps(payload),
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": QuestionsResponse.model_json_schema(),
            },
        )
        parsed = QuestionsResponse.model_validate_json(response.output_text)
    except Exception:
        logger.exception("Gemini question generation failed")
        return []

    valid_columns = {c["name"] for c in column_info}
    specs = [q for q in parsed.questions if _columns_are_valid(q.analysis, valid_columns)]
    return specs[:6]


def narrate_answer(question: str, table: list[dict]) -> str:
    client = _get_client()
    if client is None:
        return "Here's what the data shows."

    payload = {"question": question, "result": table}
    try:
        response = client.interactions.create(
            model=MODEL,
            system_instruction=NARRATION_SYSTEM_PROMPT,
            input=json.dumps(payload, default=str),
        )
        return response.output_text.strip()
    except Exception:
        logger.exception("Gemini answer narration failed")
        return "Here's what the data shows."
