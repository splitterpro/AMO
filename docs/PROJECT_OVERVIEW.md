# DataLens (AMO) — Project Overview

> A friendly, complete guide to what this project is, how it works, and how its pieces fit together.

## 1. What is this project?

**DataLens** (the app's on-screen name; the repo/package is called `amo`) is a small web app that lets someone **drop in a CSV file and immediately start asking questions about it** — without writing any code or formulas.

Here's the experience in one sentence:

> Upload a CSV → the app instantly shows headline metrics and 6 AI-suggested questions grouped by category → click one → get a plain-English answer plus a chart, summary stats, a supporting data table, and a transparency panel showing exactly how it was calculated.

Under the hood, an AI model (Google Gemini) is used in a careful, narrow way: it *suggests* which questions are interesting (by picking from a fixed menu of 19 operations) and *narrates* results in words — but it never does the actual math itself. All numbers are computed by traditional, deterministic code (pandas). This split is the most important design idea in the whole project — see [section 5](#5-how-it-works-internally-the-full-journey-of-a-request).

## 2. Key features

- **Drag-and-drop CSV upload** with instant row/column/file-size summary.
- **Headline metrics** — a handful of pandas-computed totals/unique-counts (e.g. "Total Sales", "Unique Customer") surfaced right after upload, heuristically picked from column names.
- **Auto-generated suggested questions** — up to 6 relevant questions proposed per dataset, tailored to its actual columns, deduped, and diversified across 5 categories (Trends, Comparisons, Top & Bottom, Relationships, Statistics).
- **Filterable question grid** — filter suggested questions by category or free-text search before picking one.
- **Rich answer panel** — clicking a question slides in a detail panel with a chart (bar/line/donut/histogram/KPI, chosen deterministically per operation), summary stats, a narrated 1-2 sentence insight, a supporting data table (exportable), and a "Calculation Details" panel showing the exact operation/columns/aggregation/row count used.
- **Grounded numbers** — every number shown to the user comes from a real pandas computation (`analysis.py` / `metrics.py`), never from the AI guessing.

## 3. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, built with Vite |
| Frontend state | Redux Toolkit |
| Charts | Recharts |
| Styling | Plain CSS + a CSS custom-property design-token system (no Tailwind/CSS-in-JS) |
| Icons | `lucide-react` |
| Backend | Python, FastAPI, served by Uvicorn |
| Data processing | pandas |
| AI provider | Google Gemini (`google-genai` SDK), model `gemini-flash-lite-latest` |
| Data storage | None — datasets live only in the backend's memory while it's running |
| Testing | Vitest + Testing Library (frontend), pytest (backend) |

## 4. Architecture at a glance

```
┌──────────────────────┐        /api/csv/summary        ┌────────────────────────────┐
│   Browser (React)    │ ───────────────────────────────▶│    FastAPI backend         │
│                       │        /api/csv/ask             │    (backend/main.py)       │
│  Redux store:         │ ◀───────────────────────────────│                            │
│   - csvUpload slice   │        JSON responses            │  ┌──────────────────────┐  │
│   - questions slice   │                                  │  │ pandas               │  │
└──────────────────────┘                                  │  │ metrics.py           │  │
        ▲                                                  │  │  (headline metrics)  │  │
        │ dev only: Vite proxies                           │  │ analysis.py          │  │
        │ /api/* → 127.0.0.1:8010                          │  │  (19 operations)     │  │
        │                                                  │  │ validation.py        │  │
        │                                                  │  │  (required/numeric/  │  │
        │                                                  │  │   date-column checks)│  │
        │                                                  │  └──────────────────────┘  │
        │                                                  │  ┌──────────────────────┐  │
        └──────────────────────────────────────────────────│  │ Gemini (llm.py)      │  │
                                                             │  │ suggests questions,  │  │
                                                             │  │ narrates results     │  │
                                                             │  └──────────────────────┘  │
                                                             │  models.py: shared types,  │
                                                             │  deterministic operation → │
                                                             │  category/chart/label maps │
                                                             │  In-memory cache:          │
                                                             │  dataset_id → DataFrame    │
                                                             └────────────────────────────┘
```

- The **browser** never talks to Gemini directly — it only ever calls the FastAPI backend.
- The **backend** is the only thing that talks to pandas and to Gemini.
- There is **no database**. Uploaded data is held in RAM in a simple in-memory cache (an `OrderedDict`, capped at `MAX_CACHED_DATASETS = 20` — the oldest is dropped once a 21st is added). Restarting the backend clears everything.

## 5. How it works internally: the full journey of a request

Think of it as two separate trips: **uploading a file**, and **asking a question**.

### Trip A — Uploading a CSV

1. The user drags a `.csv` file onto `CsvUpload.tsx`, or clicks to browse for one.
2. The component dispatches the `uploadCsv` Redux thunk, which does a client-side extension check, then `POST`s the file to `/api/csv/summary` as multipart form data.
3. In dev, Vite's proxy forwards anything under `/api/*` straight to the FastAPI server on port 8010, so the frontend code never needs to know the backend's real address.
4. On the backend (`backend/main.py`, route `summarize`):
   - The file bytes are read and parsed with `pandas.read_csv` (it retries with `latin-1` encoding if the file isn't UTF-8). Empty or unparseable files are rejected with a `400`.
   - It computes each column's name + dtype, and grabs the first 5 rows as a JSON preview.
   - `compute_metrics(df)` (`metrics.py`) heuristically scans column names for sales/revenue-style patterns (sum metrics) and id/customer-style patterns (unique-count metrics), pandas-only, no AI.
   - It calls `generate_questions(...)` in `llm.py`, which sends the column info + sample rows to Gemini and asks for up to `CANDIDATE_POOL_SIZE = 10` candidate questions, each expressed not as free text but as a strict, structured "recipe" (an `AnalysisSpec`: `operation` + the columns it needs).
   - Every candidate is filtered in code: columns must actually exist in the file, the recipe must pass the same `validation.validate()` used at answer time, and duplicates (same operation + columns) are dropped. `_select_diverse` then greedily caps at `MAX_PER_CATEGORY = 2` per category to build the final list of up to `MAX_QUESTIONS = 6`, falling back to filling remaining slots from leftovers so a thin category never shrinks the count. Category is derived deterministically from `operation` (`models.OPERATION_CATEGORY`) — Gemini never chooses it directly.
   - The DataFrame plus its validated question recipes are stored in the in-memory cache under a new random `dataset_id`.
5. The backend responds with row/column counts, column info, the 5-row preview, the headline metrics, and the suggested questions (each with an `id`, `label`, `question`, `description`, `category`).
6. The frontend stores this in Redux as `{ kind: 'success', ... }`; `CsvUpload.tsx` switches to the "your data is ready" view, rendering `DatasetHeader` (file info), `DatasetMetrics` (the headline metrics, each expandable to show its operation/column/row count), and `ExploreData` (the question grid).

### Trip B — Asking a suggested question

1. In `ExploreData` → `AnalysisGrid`, the user can filter questions by category (`AnalysisCategories`) or search text (`AnalysisSearch`), then clicks a question card (`AnalysisCard`).
2. `AnalysisDetailPanel` slides open and dispatches the `askQuestion` thunk, which `POST`s `{ dataset_id, question_id }` to `/api/csv/ask`.
3. On the backend (route `ask`):
   - It looks up the cached DataFrame and the specific question's recipe by id (404 if the dataset has expired from the cache or was never uploaded; 400 if the question id is unknown).
   - It runs `run_analysis(df, spec.analysis)` (`backend/analysis.py`) — **plain pandas code, no AI involved** — which re-validates the spec and dispatches on `operation` to one of 19 fixed, well-tested computations:

     | Category | Operations | What they compute |
     |---|---|---|
     | Comparisons | `groupby_sum`, `groupby_mean`, `groupby_median`, `groupby_min`, `groupby_max`, `groupby_count`, `concentration` | A measure aggregated by a dimension; `concentration` also reports what % of the total the top groups hold |
     | Top & Bottom | `top_n`, `bottom_n` | Highest/lowest-ranked dimension values by summed measure |
     | Trends | `trend_daily`, `trend_weekly`, `trend_monthly`, `trend_yearly`, `percentage_change`, `growth_rate` | A measure summed over time at different granularities; period-over-period % change; first-to-last-period growth rate |
     | Statistics | `distribution`, `standard_deviation` | A 10-bin histogram of a measure; mean/std/min/max/median |
     | Relationships | `correlation`, `bin_relationship` | Pearson correlation between two measures; how a second measure's average changes across 5 quantile bins of the first |

   - The resulting table is handed to `narrate_answer(...)` in `llm.py`, which asks Gemini for a single 1-2 sentence insight — Gemini is explicitly instructed to only describe the numbers it's given, never invent or estimate new ones.
4. The backend returns `{ question_id, answer, table, visualization, calculation }`, where `visualization.type` (bar/line/horizontal_bar/donut/histogram/scatter/kpi) and `calculation.aggregation` (a human label like `SUM`/`GROWTH_RATE`) are looked up deterministically from `operation` via `models.py`'s `OPERATION_VISUALIZATION` / `OPERATION_AGGREGATION_LABEL` — never decided by Gemini, so two questions using the same operation can never disagree on chart type or label.
5. Redux stores the answer per-question; `AnalysisDetailPanel` renders `AnalysisChart` (Recharts, keyed off `visualization.type`), `AnalysisSummaryStats`, `KeyInsight` (the narrated sentence), `SupportingData` (an exportable table), and `CalculationDetailsPanel` (the operation, columns, aggregation, and row count that produced the answer).

### Why split it this way?

If the AI were asked to compute answers directly, it could hallucinate a number that looks plausible but is wrong. Instead, **the AI only ever chooses *what* to compute (from a fixed, safe menu of 19 operations) and *describes* results that were already computed by ordinary code.** Category, chart type, and aggregation label are all derived from the chosen operation in code, not asked of the model. This keeps every number the user sees fully traceable back to a real, verifiable pandas calculation.

## 6. Directory structure

```
AMO/
├── src/                                   Frontend source (React + TypeScript)
│   ├── components/
│   │   ├── Header.tsx / .css                 Top app header/branding
│   │   ├── CsvUpload.tsx / .css               Upload dropzone + post-upload view switch
│   │   ├── Dataset/
│   │   │   ├── DatasetHeader.tsx / .css           File name/size/row/column summary + remove button
│   │   │   └── DatasetMetrics.tsx / .css          Expandable headline metric cards
│   │   ├── Analysis/
│   │   │   ├── ExploreData.tsx / .css             Owns category filter + search + grid
│   │   │   ├── AnalysisCategories.tsx / .css      Category filter chips
│   │   │   ├── AnalysisSearch.tsx / .css          Free-text question search
│   │   │   ├── AnalysisGrid.tsx / .css            Question card grid + selected-question state
│   │   │   ├── AnalysisCard.tsx / .css            One suggested-question card
│   │   │   ├── AnalysisDetailPanel.tsx / .css     Slide-in answer panel (portal to document.body)
│   │   │   └── categoryStyle.ts                   Category → icon/color/order lookup
│   │   └── AnalysisDetails/
│   │       ├── AnalysisChart.tsx / .css           Recharts chart, keyed off visualization.type
│   │       ├── AnalysisSummaryStats.tsx / .css    Small stat tiles above/beside the chart
│   │       ├── KeyInsight.tsx / .css              Renders the Gemini-narrated sentence
│   │       ├── SupportingData.tsx / .css          Data table + export
│   │       ├── CalculationDetailsPanel.tsx / .css Operation/columns/aggregation/row-count panel
│   │       └── fieldLabels.ts                     Column-name → human label helpers
│   ├── features/
│   │   ├── csvUpload/csvUploadSlice.ts        Redux slice: upload lifecycle (idle/loading/error/success)
│   │   └── questions/questionsSlice.ts        Redux slice: per-question-id answer state
│   ├── types/analysis.ts                  TypeScript types mirroring backend/models.py
│   ├── utils/format.ts, exportData.ts     Number/file-size formatting, table export
│   ├── styles/tokens.css                  Design tokens (colors, spacing, radii, shadows)
│   ├── test/setup.ts                      Vitest/jsdom setup
│   ├── App.tsx                            Renders Header + CsvUpload
│   └── main.tsx                           App entry point, wraps App in the Redux Provider
├── public/                                Static files served as-is (favicon, etc.)
├── backend/                               Backend service (Python)
│   ├── main.py                                FastAPI app + the two API routes, in-memory dataset cache
│   ├── models.py                              Operation literal + shared pydantic models + deterministic
│   │                                           operation → category/visualization/aggregation-label maps
│   ├── validation.py                          Per-operation required/numeric/date-column checks
│   ├── analysis.py                            The 19 pandas computations (OPERATIONS dispatch table)
│   ├── metrics.py                             Heuristic headline-metric scan (pandas only)
│   ├── llm.py                                 Gemini client, prompts, question generation + narration
│   ├── tests/                                 pytest suite (conftest fixtures, analysis/validation/models/api tests)
│   ├── pytest.ini                             pytest config (testpaths = tests)
│   ├── requirements.txt                       Python dependencies
│   ├── .venv/                                 Checked-in virtual environment
│   └── .env                                   Holds GEMINI_API_KEY (not committed to git)
├── index.html                             Vite HTML entry point
├── vite.config.ts                         Dev server + /api proxy configuration
├── package.json                           Scripts and frontend dependencies
└── docs/PROJECT_OVERVIEW.md               This file
```

## 7. API reference

### `POST /api/csv/summary`

Uploads and profiles a CSV file.

- **Request:** multipart form data with a `file` field (must end in `.csv`).
- **Response (200):**
  ```json
  {
    "dataset_id": "b1f9...uuid",
    "rows": 1200,
    "columns": 6,
    "column_info": [{ "name": "Region", "dtype": "object" }, ...],
    "preview": [{ "Region": "West", "Sales": 1200 }, ...],
    "metrics": [
      { "label": "Total Sales", "column": "Sales", "type": "sum", "value": 812345.0 },
      { "label": "Unique Customer Id", "column": "customer_id", "type": "unique_count", "value": 340 }
    ],
    "questions": [
      { "id": 1, "label": "Top regions", "question": "Which regions sell the most?", "description": "...", "category": "Top & Bottom" },
      ...
    ]
  }
  ```
- **Errors (400):** non-CSV file, unparseable CSV, or an empty file.

### `POST /api/csv/ask`

Answers one of the suggested questions for a previously uploaded dataset.

- **Request:**
  ```json
  { "dataset_id": "b1f9...uuid", "question_id": 1 }
  ```
- **Response (200):**
  ```json
  {
    "question_id": 1,
    "answer": "The West region leads with $1.2M in total sales.",
    "table": [{ "category": "West", "value": 1200000 }, ...],
    "visualization": {
      "type": "horizontal_bar",
      "data": [{ "category": "West", "value": 1200000 }, ...]
    },
    "calculation": {
      "operation": "top_n",
      "dimension_column": "Region",
      "measure_column": "Sales",
      "secondary_measure_column": null,
      "date_column": null,
      "aggregation": "SUM",
      "rows_analyzed": 1200,
      "calculated_by": "pandas"
    }
  }
  ```
- **Errors:** `404` if `dataset_id` is unknown (e.g. the backend restarted, or it aged out of the 20-dataset cache) — the user is prompted to re-upload; `400` if `question_id` doesn't exist for that dataset, or if the cached recipe fails re-validation.

## 8. Frontend state management

The app uses **Redux Toolkit** with a single store made of two slices — no React Context, no other state library:

- **`csvUpload` slice** — a state machine with four states: `idle → loading → success | error`. Holds the upload result (row/column counts, metrics, questions, etc.) once successful.
- **`questions` slice** — a map from `question_id` to its own small state machine (`loading | success | error`), holding the answer, table, visualization, and calculation details once a question is answered.

Purely visual, throwaway state (like "is the dropzone currently being dragged over", "which category/search filter is active", or "which question is expanded") stays as local `useState` inside the component — it's never put in Redux, since nothing else in the app needs to know about it.

## 9. Styling / design system

- Every component has its own plain CSS file (e.g. `CsvUpload.css`), imported directly — not CSS Modules, just consistently-prefixed class names.
- A single file, `src/styles/tokens.css`, defines the design system as CSS custom properties: the brand color, background/surface/text/border colors, status colors (success/warning/danger/info, each with a `-soft` variant used for category badges), spacing scale, corner-radius scale, and shadows. Both CSS files and inline styles (e.g. `categoryStyle.ts`'s icon colors) pull from these tokens, so changing a token updates the whole app consistently.
- Charts are rendered with **Recharts**; the font is **Inter**, loaded from Google Fonts in `index.html`.

## 10. Running it locally

1. **Install frontend dependencies:**
   ```
   npm install
   ```
2. **Set up the backend:** a virtual environment is already checked in at `backend/.venv`; if you need to recreate it, install its dependencies with:
   ```
   pip install -r backend/requirements.txt
   ```
3. **Add your Gemini API key:** create `backend/.env` with:
   ```
   GEMINI_API_KEY=your-key-here
   ```
   (There's currently no `.env.example` checked in — this is the only variable needed.)
4. **Run everything at once:**
   ```
   npm run dev
   ```
   This starts the frontend (Vite, `http://localhost:5173`) and backend (Uvicorn, port 8010) together. You can also run them separately with `npm run dev:frontend` / `npm run dev:backend`.

Other scripts: `npm run build` (type-checks and builds a production bundle), `npm run lint` (ESLint), `npm test` (Vitest), `npm run preview` (serve the production build locally).

For the backend test suite, from `backend/`: `.venv\Scripts\pytest` (or `.venv\Scripts\pytest tests/test_analysis.py -k groupby_sum` for a single test).

## 11. Good to know / current limitations

- **Nothing is persisted.** All uploaded data lives only in the backend's memory and disappears when it restarts, or once more than 20 datasets have been uploaded (oldest is evicted first).
- **No database** is used anywhere in the project.
- **No `.env.example`** is committed — a new developer has to know to create `backend/.env` themselves with `GEMINI_API_KEY`.
- **Graceful degradation:** if `GEMINI_API_KEY` is missing or a Gemini call fails, the app doesn't crash — `generate_questions` returns no suggested questions, and `narrate_answer` falls back to the generic sentence "Here's what the data shows."
- **`correlation` is a `kpi` visualization, not a scatter plot** — it currently returns a single aggregate coefficient row rather than raw paired points, so there's nothing to plot as a scatter yet; that would require an `analysis.py` change.
- **Adding a new operation touches four files:** the `Operation` literal + three lookup dicts in `models.py`, the required/numeric/date rules in `validation.py`, an implementation + `OPERATIONS` entry in `analysis.py`, and the operation's description in `llm.py`'s `QUESTIONS_SYSTEM_PROMPT` — plus mirroring the type in `src/types/analysis.ts` on the frontend.
- **Tests exist on both sides:** pytest for the backend (`backend/tests/`, fixtures in `conftest.py`), Vitest + Testing Library for the frontend (test files live next to the code they cover).
