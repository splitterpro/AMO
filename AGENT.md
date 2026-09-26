# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DataLens (repo/package name `amo`): upload a CSV, get 6 AI-suggested analysis questions tailored to its columns, click one, get a plain-English answer plus a computed table/chart. Gemini only *chooses what to compute* (from a fixed operation menu) and *narrates* already-computed numbers — it never does math itself. All numbers come from deterministic pandas code in `backend/analysis.py`. This split is the core design invariant of the project; preserve it when adding features (e.g. a new "insight" must still be backed by a real pandas operation, not an LLM-produced number).

A fuller (but slightly stale in places — component names have since changed) walkthrough lives in `docs/PROJECT_OVERVIEW.md`.

## Commands

Frontend (run from repo root):
- `npm run dev` — runs frontend (Vite, `:5173`) and backend (Uvicorn, `:8010`) together via `concurrently`
- `npm run dev:frontend` / `npm run dev:backend` — run either side alone
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — ESLint
- `npm test` — `vitest run`; use `npx vitest run <path>` for a single file, or `npx vitest` to watch
- `npm run preview` — serve the production build

Backend (from `backend/`, using the checked-in venv at `backend/.venv`):
- `.venv\Scripts\pytest` — run all backend tests (config in `pytest.ini`, `testpaths = tests`)
- `.venv\Scripts\pytest tests/test_analysis.py -k groupby_sum` — run a single test/file
- `.venv\Scripts\uvicorn main:app --app-dir backend --reload --port 8010` — run backend alone (this is what `dev:backend` does)

Backend requires `backend/.env` with `GEMINI_API_KEY=...` (not committed). Without it, Gemini calls are skipped gracefully: `generate_questions` returns `[]` and `narrate_answer` returns the fallback string `"Here's what the data shows."` — the app does not crash.

## Architecture

Two-process dev setup, no database, no persistence: uploaded CSVs live only in an in-memory `OrderedDict` in `backend/main.py` (`_datasets`, capped at `MAX_CACHED_DATASETS = 20`, oldest evicted on overflow; cleared on backend restart). Vite proxies `/api/*` to `http://127.0.0.1:8010` in dev (`vite.config.ts`), so the frontend never hardcodes a backend URL.

**Backend (`backend/`)**, FastAPI app in `main.py` with two routes:
- `POST /api/csv/summary` — parses the CSV with pandas (falls back from UTF-8 to `latin-1`), profiles columns, computes metrics (`metrics.py`), calls `llm.generate_questions(...)` for up to 6 suggested questions, caches the DataFrame + questions under a new `dataset_id`.
- `POST /api/csv/ask` — looks up the cached dataset/question by `{dataset_id, question_id}` (404 if expired/unknown), runs `analysis.run_analysis(df, spec)` to compute a real result table, then `llm.narrate_answer(...)` to produce a 1-2 sentence summary of that table only.

The operation menu is the backend's single source of truth and is intentionally kept in sync across three files:
- `models.py` — the `Operation` literal (19 ops: `groupby_*`, `top_n`/`bottom_n`, `trend_*`, `percentage_change`, `growth_rate`, `distribution`, `standard_deviation`, `correlation`, `concentration`, `bin_relationship`), plus deterministic lookup tables `OPERATION_CATEGORY`, `OPERATION_VISUALIZATION`, `OPERATION_AGGREGATION_LABEL` — these are derived from `operation` in code rather than left to Gemini, so two questions with the same operation can never disagree on category/chart type.
- `validation.py` — per-operation required fields, numeric-dtype checks, and date-parseability checks (`validate(df, spec)`), enforced both when Gemini's candidate recipes are filtered in `llm.py` and again when a cached recipe is actually run in `main.py`.
- `analysis.py` — the actual pandas implementation per operation (`OPERATIONS` dict dispatches on `spec.operation`); `run_analysis` always calls `validate` first.

`llm.py` never lets the model choose freely: it generates a candidate pool (`CANDIDATE_POOL_SIZE = 10`), drops any candidate referencing a nonexistent column or failing `validation.validate`, dedupes by `(operation, dimension, measure, secondary_measure, date_column)`, then `_select_diverse` greedily caps at `MAX_PER_CATEGORY = 2` per category before filling remaining slots — so the final 6 questions are diverse but never fall short if one category is thin.

Adding a new operation means touching all of: the `Operation` literal + three lookup dicts in `models.py`, the required/numeric/date rules in `validation.py`, an implementation + `OPERATIONS` entry in `analysis.py`, and the operation's description in `llm.py`'s `QUESTIONS_SYSTEM_PROMPT`.

**Frontend (`src/`)**, React + TypeScript + Redux Toolkit, no React Context/other state libs:
- `store.ts` combines two slices: `features/csvUpload/csvUploadSlice.ts` (upload lifecycle as a tagged union `idle | loading | error | success`, thunk `uploadCsv`) and `features/questions/questionsSlice.ts` (per-`question_id` map of `loading | success | error`, thunk `askQuestion`).
- `types/analysis.ts` mirrors the backend's `Operation`/`Category`/`VisualizationType`/response shapes — keep it in sync when `models.py` changes.
- `components/Analysis/` renders the question grid/cards/search/categories; `components/AnalysisDetails/` renders the expanded answer view (chart, summary stats, calculation-transparency panel, supporting data table); `components/Dataset/` renders the post-upload header/metrics; `components/CsvUpload.tsx` is the dropzone plus state-machine view switch.
- Purely visual, non-shared state (drag-over, which card is expanded) stays as local `useState`, never Redux.
- Styling is plain CSS per component (no Tailwind/CSS-in-JS), pulling from design tokens in `src/styles/tokens.css` (colors, spacing, radii, shadows).

## Tests

- Frontend: Vitest + Testing Library, jsdom environment, setup file `src/test/setup.ts`. Test files sit next to the code they cover (`*.test.ts(x)`).
- Backend: pytest, tests in `backend/tests/`, shared fixtures (`sales_df`, `edge_df`) in `backend/tests/conftest.py`.
