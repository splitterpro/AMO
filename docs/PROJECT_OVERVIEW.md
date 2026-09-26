# DataLens (AMO) — Project Overview

> A friendly, complete guide to what this project is, how it works, and how its pieces fit together.

## 1. What is this project?

**DataLens** (the app's on-screen name; the repo/package is called `amo`) is a small web app that lets someone **drop in a CSV file and immediately start asking questions about it** — without writing any code or formulas.

Here's the experience in one sentence:

> Upload a CSV → the app instantly suggests 6 smart questions about your data → click one → get a plain-English answer plus a small result table, in seconds.

Under the hood, an AI model (Google Gemini) is used in a careful, narrow way: it *suggests* which questions are interesting and *describes* results in words — but it never does the actual math itself. All numbers are computed by traditional, deterministic code (pandas). This split is the most important design idea in the whole project — see [section 5](#5-how-it-works-internally-the-full-journey-of-a-request).

## 2. Key features

- **Drag-and-drop CSV upload** with instant row/column/file-size summary.
- **Auto-generated suggested questions** — 6 relevant questions proposed per dataset, tailored to its actual columns.
- **One-click answers** — click a suggested question and get a short narrated insight plus a supporting data table.
- **Grounded numbers** — every number shown to the user comes from a real pandas computation, never from the AI guessing.

## 3. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, built with Vite |
| Frontend state | Redux Toolkit |
| Styling | Plain CSS + a CSS custom-property design-token system (no Tailwind/CSS-in-JS) |
| Icons | `lucide-react` |
| Backend | Python, FastAPI, served by Uvicorn |
| Data processing | pandas |
| AI provider | Google Gemini (`google-genai` SDK), model `gemini-flash-lite-latest` |
| Data storage | None — datasets live only in the backend's memory while it's running |

## 4. Architecture at a glance

```
┌──────────────────────┐        /api/csv/summary        ┌───────────────────────┐
│   Browser (React)    │ ───────────────────────────────▶│   FastAPI backend     │
│                       │        /api/csv/ask             │   (backend/main.py)   │
│  Redux store:         │ ◀───────────────────────────────│                       │
│   - csvUpload slice   │        JSON responses            │  ┌─────────────────┐  │
│   - questions slice   │                                  │  │ pandas           │  │
└──────────────────────┘                                  │  │ (analysis.py)    │  │
        ▲                                                  │  │ parses CSVs,     │  │
        │ dev only: Vite proxies                           │  │ runs computations│  │
        │ /api/* → 127.0.0.1:8010                          │  └─────────────────┘  │
        │                                                  │  ┌─────────────────┐  │
        └──────────────────────────────────────────────────│  │ Gemini (llm.py) │  │
                                                             │  │ suggests        │  │
                                                             │  │ questions,      │  │
                                                             │  │ narrates results│  │
                                                             │  └─────────────────┘  │
                                                             │  In-memory cache:     │
                                                             │  dataset_id → DataFrame│
                                                             └───────────────────────┘
```

- The **browser** never talks to Gemini directly — it only ever calls the FastAPI backend.
- The **backend** is the only thing that talks to pandas and to Gemini.
- There is **no database**. Uploaded data is held in RAM in a simple in-memory cache (an `OrderedDict`, capped at 20 datasets — the oldest is dropped once a 21st is added). Restarting the backend clears everything.

## 5. How it works internally: the full journey of a request

Think of it as two separate trips: **uploading a file**, and **asking a question**.

### Trip A — Uploading a CSV

1. The user drags a `.csv` file onto `CsvUpload.tsx`, or clicks to browse for one.
2. The component dispatches the `uploadCsv` Redux thunk, which does a client-side extension check, then `POST`s the file to `/api/csv/summary` as multipart form data.
3. In dev, Vite's proxy forwards anything under `/api/*` straight to the FastAPI server on port 8010, so the frontend code never needs to know the backend's real address.
4. On the backend (`backend/main.py`, route `summarize`):
   - The file bytes are read and parsed with `pandas.read_csv` (it retries with `latin-1` encoding if the file isn't UTF-8).
   - Empty files are rejected with a clear error.
   - It computes each column's name + data type, and grabs the first 5 rows as a JSON preview.
   - It calls `generate_questions(...)` in `llm.py`, which sends the column info + sample rows to Gemini and asks for **exactly 6 analysis questions**, each expressed not as free text but as a strict, structured "recipe" (see next point).
   - Every proposed question is validated in code — any question referencing a column name that doesn't actually exist in the file is silently dropped. This stops the AI from ever inventing a column.
   - The DataFrame plus its 6 validated question recipes are stored in the in-memory cache under a new random `dataset_id`.
5. The backend responds with the row/column counts, column info, the 5-row preview, and the 6 suggested questions.
6. The frontend stores this in Redux as `{ kind: 'success', ... }`, and `CsvUpload.tsx` switches to a "your data is ready" view, handing the questions off to `SuggestedQuestions.tsx`.

### Trip B — Asking a suggested question

1. The user clicks one of the 6 question cards.
2. `SuggestedQuestions.tsx` dispatches the `askQuestion` thunk, which `POST`s `{ dataset_id, question_id }` to `/api/csv/ask`.
3. On the backend (route `ask`):
   - It looks up the cached DataFrame and the specific question's "recipe" by id (404 if the dataset has expired from the cache or was never uploaded).
   - It runs `run_analysis(df, spec.analysis)` (`backend/analysis.py`) — **plain pandas code**, no AI involved — to actually compute the answer. The recipe's `operation` field picks one of six fixed, well-tested computations:
     | Operation | What it computes |
     |---|---|
     | `groupby_sum` | Sum of a measure, grouped by a category |
     | `groupby_mean` | Average of a measure, grouped by a category |
     | `trend_monthly` | Monthly totals of a measure over a date column |
     | `top_n` | The top N categories by total |
     | `concentration` | How much of the total the top categories hold |
     | `bin_relationship` | How two numeric measures relate, bucketed into 5 bands |
   - The resulting small table is handed to `narrate_answer(...)` in `llm.py`, which asks Gemini for a single 1-2 sentence insight — but Gemini is explicitly instructed to only describe the numbers it's given, never invent or estimate new ones.
4. The backend returns `{ question_id, answer, table }`.
5. Redux stores the answer per-question; the expanded question card shows the narrated sentence plus an HTML table built from the returned rows.

### Why split it this way?

If the AI were asked to compute answers directly, it could hallucinate a number that looks plausible but is wrong. Instead, **the AI only ever chooses *what* to compute (from a fixed, safe menu) and *describes* results that were already computed by ordinary code.** This keeps every number the user sees fully traceable back to a real, verifiable pandas calculation.

## 6. Directory structure

```
AMO/
├── src/                          Frontend source (React + TypeScript)
│   ├── components/
│   │   ├── Header.tsx / .css         Top app header/branding
│   │   ├── CsvUpload.tsx / .css      Upload dropzone + summary view
│   │   └── SuggestedQuestions.tsx    Question cards, expand-to-answer UI
│   ├── features/
│   │   ├── csvUpload/csvUploadSlice.ts   Redux slice: upload lifecycle (idle/loading/error/success)
│   │   └── questions/questionsSlice.ts   Redux slice: per-question answer state
│   ├── constants/questions.ts        Shared TypeScript types for questions
│   ├── utils/format.ts               Number / file-size formatting helpers
│   ├── styles/tokens.css             Design tokens (colors, spacing, radii, shadows)
│   ├── assets/                       Static images
│   ├── App.tsx                       Renders Header + CsvUpload
│   └── main.tsx                      App entry point, wraps App in the Redux Provider
├── public/                       Static files served as-is (favicon, etc.)
├── backend/                      Backend service (Python)
│   ├── main.py                       FastAPI app + the two API routes
│   ├── llm.py                        Gemini client, prompts, question/narration logic
│   ├── analysis.py                   The 6 pandas computations
│   ├── requirements.txt              Python dependencies
│   └── .env                          Holds GEMINI_API_KEY (not committed to git)
├── index.html                    Vite HTML entry point
├── vite.config.ts                Dev server + /api proxy configuration
├── package.json                  Scripts and frontend dependencies
└── docs/PROJECT_OVERVIEW.md      This file
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
    "questions": [
      { "id": 1, "label": "Top regions", "question": "Which regions sell the most?", "description": "..." },
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
    "table": [{ "category": "West", "value": 1200000 }, ...]
  }
  ```
- **Errors:** `404` if `dataset_id` is unknown (e.g. the backend restarted, or it aged out of the 20-dataset cache) — the user is prompted to re-upload; `400` if `question_id` doesn't exist for that dataset.

## 8. Frontend state management

The app uses **Redux Toolkit** with a single store made of two slices — no React Context, no other state library:

- **`csvUpload` slice** — a state machine with four states: `idle → loading → success | error`. Holds the upload result (row/column counts, questions, etc.) once successful.
- **`questions` slice** — a map from `question_id` to its own small state machine (`idle → loading → success | error`), so each question card tracks its answer independently.

Purely visual, throwaway state (like "is the dropzone currently being dragged over" or "which card is expanded") stays as local `useState` inside the component — it's never put in Redux, since nothing else in the app needs to know about it.

## 9. Styling / design system

- Every component has its own plain CSS file (e.g. `CsvUpload.css`), imported directly — not CSS Modules, just consistently-prefixed class names.
- A single file, `src/styles/tokens.css`, defines the design system as CSS custom properties: the brand color, background/surface/text/border colors, status colors (success/warning/danger/info), spacing scale, corner-radius scale, and shadows. Both CSS files and inline styles pull from these tokens, so changing a token updates the whole app consistently.
- The font is **Inter**, loaded from Google Fonts in `index.html`.

## 10. Running it locally

1. **Install frontend dependencies:**
   ```
   npm install
   ```
2. **Set up the backend:** create a Python virtual environment inside `backend/` and install its dependencies:
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

Other scripts: `npm run build` (type-checks and builds a production bundle), `npm run lint` (ESLint), `npm run preview` (serve the production build locally).

## 11. Good to know / current limitations

- **Nothing is persisted.** All uploaded data lives only in the backend's memory and disappears when it restarts, or once more than 20 datasets have been uploaded (oldest is evicted first).
- **No database** is used anywhere in the project.
- **No `.env.example`** is committed — a new developer has to know to create `backend/.env` themselves with `GEMINI_API_KEY`.
- **Graceful degradation:** if `GEMINI_API_KEY` is missing or a Gemini call fails, the app doesn't crash — `generate_questions` returns no suggested questions, and `narrate_answer` falls back to the generic sentence "Here's what the data shows."
- **No automated tests** currently exist in the repository.
