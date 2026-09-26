"""Guards against the failure mode described in CLAUDE.md: adding a new operation means
manually touching models.py, validation.py, analysis.py, and llm.py, and nothing enforces
these stay in sync. A forgotten entry currently only surfaces as a KeyError (or, worse, a
silently skipped validation check) the first time a specific input hits it at runtime.
These tests fail immediately instead. models.py's own three lookup dicts (category,
visualization, aggregation label) are already covered exhaustively by test_models.py; this
file covers the remaining registration points: validation.py, analysis.py, and llm.py."""

from typing import get_args

from analysis import OPERATIONS
from llm import QUESTIONS_SYSTEM_PROMPT
from models import Operation
from validation import REQUIRED_FIELDS

ALL_OPERATIONS = set(get_args(Operation))


def test_every_operation_has_required_fields():
    assert ALL_OPERATIONS == REQUIRED_FIELDS.keys()


def test_every_operation_is_registered_in_analysis():
    assert ALL_OPERATIONS == OPERATIONS.keys()


def test_every_operation_is_described_in_the_questions_prompt():
    for operation in ALL_OPERATIONS:
        assert operation in QUESTIONS_SYSTEM_PROMPT, f"'{operation}' is missing from QUESTIONS_SYSTEM_PROMPT"
