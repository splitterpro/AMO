import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException
from google import genai
from pydantic import BaseModel
import pandas as pd

from models import OPERATION_CATEGORY, AnalysisSpec, QuestionSpec
from validation import validate as validate_recipe

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

MODEL = "gemini-flash-lite-latest"

CANDIDATE_POOL_SIZE = 10
MAX_QUESTIONS = 6
MAX_PER_CATEGORY = 2


class _GenerationQuestionSpec(BaseModel):
    """Gemini-facing shape: same as the shared QuestionSpec minus 'category', since
    category is derived deterministically from 'operation' in code (see
    models.OPERATION_CATEGORY) rather than left to Gemini's judgment - this keeps two
    questions with the same operation from ever landing in different categories."""

    label: str
    question: str
    description: str
    analysis: AnalysisSpec


class _GenerationQuestionsResponse(BaseModel):
    questions: list[_GenerationQuestionSpec]


QUESTIONS_SYSTEM_PROMPT = f"""You are a data analyst. Given a CSV file's column names, \
types, and a small sample of rows, propose up to {CANDIDATE_POOL_SIZE} insightful \
analysis questions a business user would want answered from this data.

Every column name you use inside "analysis" must be copied exactly, character for \
character, from the given column list - never invent, translate, or rename a column. \
Only propose a question if every column it needs actually exists in the given list, \
and only use a column with a type that actually supports the operation (e.g. never \
average a text column, never treat a non-date column as a date).

Pick "operation" from this fixed set only, and set ONLY the fields each operation \
actually needs - leave every other field null:

Grouped aggregation (needs "dimension"; all but groupby_count also need "measure"):
- groupby_sum: sum "measure" grouped by "dimension"
- groupby_mean: average "measure" grouped by "dimension"
- groupby_count: count of rows grouped by "dimension" (no "measure")
- groupby_median: median "measure" grouped by "dimension"
- groupby_min: minimum "measure" grouped by "dimension"
- groupby_max: maximum "measure" grouped by "dimension"
- concentration: how much of total "measure" the top group of "dimension" holds

Ranking (needs "dimension" and "measure"):
- top_n: highest "measure" totals grouped by "dimension"
- bottom_n: lowest "measure" totals grouped by "dimension"

Trends over time (needs "date_column" and "measure"):
- trend_daily / trend_weekly / trend_monthly / trend_yearly: sum "measure" by day, \
week, month, or year
- percentage_change: period-over-period percent change in "measure" over time
- growth_rate: overall growth in "measure" from the first to the last period

Single-column statistics (needs only "measure", no "dimension"):
- distribution: histogram of "measure" values
- standard_deviation: mean/std/min/max/median of "measure"

Relationship between two numeric columns (needs "measure" and "secondary_measure", \
no "dimension"):
- correlation: correlation coefficient between the two columns
- bin_relationship: how "secondary_measure" changes across bins of "measure"

Propose a genuinely varied mix across these groups instead of clustering on one \
operation or one pair of columns, and never propose the same operation on the same \
column(s) twice."""

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


def _recipe_signature(analysis: AnalysisSpec) -> tuple:
    return (analysis.operation, analysis.dimension, analysis.measure, analysis.secondary_measure, analysis.date_column)


def _is_valid_recipe(df: pd.DataFrame, analysis: AnalysisSpec) -> bool:
    try:
        validate_recipe(df, analysis)
        return True
    except HTTPException:
        return False


def _select_diverse(candidates: list[QuestionSpec], max_questions: int, max_per_category: int) -> list[QuestionSpec]:
    """Greedily fills slots while capping how many questions come from the same
    category, then makes a second pass (ignoring the cap) to fill any slots still
    left - so diversity is preferred but a shortage of one category never shrinks
    the final count below what the candidate pool could actually support."""
    selected: list[QuestionSpec] = []
    category_counts: dict[str, int] = {}
    leftover: list[QuestionSpec] = []

    for question in candidates:
        if len(selected) >= max_questions:
            break
        if category_counts.get(question.category, 0) >= max_per_category:
            leftover.append(question)
            continue
        selected.append(question)
        category_counts[question.category] = category_counts.get(question.category, 0) + 1

    for question in leftover:
        if len(selected) >= max_questions:
            break
        selected.append(question)

    return selected


def generate_questions(df: pd.DataFrame, column_info: list[dict], preview_rows: list[dict]) -> list[QuestionSpec]:
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
                "schema": _GenerationQuestionsResponse.model_json_schema(),
            },
        )
        parsed = _GenerationQuestionsResponse.model_validate_json(response.output_text)
    except Exception:
        logger.exception("Gemini question generation failed")
        return []

    valid_columns = {c["name"] for c in column_info}
    seen_signatures: set[tuple] = set()
    candidates: list[QuestionSpec] = []

    for item in parsed.questions:
        analysis = item.analysis
        if not _columns_are_valid(analysis, valid_columns):
            continue
        signature = _recipe_signature(analysis)
        if signature in seen_signatures:
            continue
        if not _is_valid_recipe(df, analysis):
            continue
        seen_signatures.add(signature)
        candidates.append(
            QuestionSpec(
                label=item.label,
                question=item.question,
                description=item.description,
                category=OPERATION_CATEGORY[analysis.operation],
                analysis=analysis,
            )
        )

    return _select_diverse(candidates, max_questions=MAX_QUESTIONS, max_per_category=MAX_PER_CATEGORY)


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
