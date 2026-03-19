# LSSU Session Agent

AI-powered voice interview platform for requirements gathering from LSSU (Lake Superior State University) department staff. An AI agent conducts structured voice sessions -- asking 5 predefined questions about roles, workflows, tools, and challenges -- then generates 3 context-aware follow-up questions using a RAG knowledge base. Transcripts are processed through an LLM and output as structured PDF reports.

---

## Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS 3, React Router 7
- **Backend**: Python, FastAPI, Uvicorn
- **Voice**: LiveKit Agents (Silero VAD, OpenAI STT/TTS)
- **LLM**: OpenAI GPT-4o-mini
- **RAG**: LlamaIndex (vector index, OpenAI embeddings)
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **PDF**: fpdf2

---

## Project Structure

```
LSSU/
├── .env                          # Environment variables (not committed)
├── .gitignore
├── AGENTS.md                     # Original requirements document
│
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py               # FastAPI entry point, mounts all routers
│   │   ├── config.py             # Loads env vars, sets up directories
│   │   ├── agent/
│   │   │   ├── interview_agent.py  # LiveKit voice agent with state machine
│   │   │   └── prompts.py         # System prompt, questions, summary template
│   │   ├── api/
│   │   │   ├── auth.py           # POST /api/auth/signup, /login, /logout
│   │   │   ├── token.py          # GET /api/token (LiveKit JWT)
│   │   │   ├── documents.py      # POST /api/documents/upload, GET /list, DELETE
│   │   │   ├── interviews.py     # POST /api/interviews, GET /list, GET /:id
│   │   │   └── reports.py        # POST /api/reports/:id/generate, GET /download
│   │   └── services/
│   │       ├── supabase_service.py  # Database CRUD for interviews and documents
│   │       ├── rag_service.py       # LlamaIndex index, follow-up question generation
│   │       └── report_service.py    # LLM-based transcript analysis, PDF rendering
│   └── data/
│       ├── uploads/              # Uploaded knowledge base documents
│       └── reports/              # Generated PDF reports
│
└── frontend/
    ├── package.json
    ├── vite.config.js            # Dev server on :5173, proxies /api to :8000
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx              # React entry point
        ├── App.jsx               # Routes and auth guard
        ├── api.js                # Axios client, auth helpers, all API calls
        ├── index.css             # Tailwind imports
        ├── pages/
        │   ├── LoginPage.jsx     # Email/password auth (login + signup)
        │   ├── DashboardPage.jsx # Stats, recent sessions, new session button
        │   ├── InterviewsPage.jsx  # All sessions list, report actions
        │   ├── InterviewRoom.jsx   # LiveKit room, visualizer, live transcript
        │   ├── KnowledgeBasePage.jsx # Document upload and management
        │   └── ReportsPage.jsx     # Completed sessions, generate/download PDF
        └── components/
            ├── Layout.jsx        # Collapsible sidebar, nav, user section
            ├── AudioVisualizer.jsx # Animated sound wave bars
            ├── TranscriptPanel.jsx # Real-time chat transcript
            ├── DocumentUploader.jsx # Drag-and-drop file upload
            └── ReportCard.jsx      # Interview card with actions
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase project (for database and auth)
- LiveKit Cloud account (for voice rooms)
- OpenAI API key

### Environment Variables

Create a `.env` file in the project root:

```
# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Supabase Setup

1. Create a new Supabase project.
2. Go to Authentication > Providers > Email and disable "Confirm email" (for development).
3. Create the following tables:

```sql
-- interviews table
create table interviews (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  status text default 'pending',
  name text,
  department text,
  transcript jsonb default '[]'::jsonb,
  summary text,
  report_file text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  stored_name text not null,
  file_size bigint,
  status text default 'indexed',
  created_at timestamptz default now()
);
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Running

### 1. Start the backend API server

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 2. Start the LiveKit interview agent (separate terminal)

```bash
cd backend
source venv/bin/activate
python -m app.agent.interview_agent dev
```

<!-- The agent registers with LiveKit Cloud and waits for room connections. -->
<!-- It uses num_idle_processes=1 to keep a warm process ready. -->

### 3. Start the frontend dev server

```bash
cd frontend
npm run dev
```

The app runs at `http://localhost:5173`. The Vite dev server proxies `/api` requests to the backend at port 8000.

---

## How It Works

1. User signs up or logs in via the login page.
2. From the dashboard, user clicks "New Session" to start a voice interview.
3. The frontend gets a LiveKit token and connects to a room.
4. The AI agent joins the room and asks 5 structured questions:
   - What is your name and role?
   - What department do you work in?
   - Walk me through your typical day.
   - What tools and systems do you use?
   - What are your biggest challenges?
5. After the 5 questions, the agent queries the RAG knowledge base (built from uploaded documents) and generates 3 follow-up questions tailored to the user's answers.
6. Once all questions are answered, the agent saves the transcript.
7. From the Reports or Sessions page, the user can generate a PDF report. The transcript is first processed through the LLM to produce a structured analysis (executive summary, workflow, tools, pain points, recommendations), then rendered as a PDF.

---

## API Routes

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| POST   | /api/auth/signup                  | Register new user              |
| POST   | /api/auth/login                   | Login, returns access token    |
| POST   | /api/auth/logout                  | Logout                         |
| GET    | /api/token?room=X&identity=Y     | Get LiveKit room token         |
| POST   | /api/interviews                   | Create new session             |
| GET    | /api/interviews                   | List all sessions              |
| GET    | /api/interviews/:id               | Get session details            |
| POST   | /api/documents/upload             | Upload document for RAG index  |
| GET    | /api/documents                    | List indexed documents         |
| DELETE | /api/documents/:id                | Remove document                |
| POST   | /api/reports/:id/generate         | Generate PDF report            |
| GET    | /api/reports/:id/download         | Download PDF report            |
| GET    | /api/health                       | Health check                   |

---

## Interview Agent States

The voice agent follows a state machine:

```
GREETING -> Q1_NAME -> Q2_DEPARTMENT -> Q3_DAILY_LIFE -> Q4_TOOLS -> Q5_CHALLENGES
  -> FOLLOWUP_Q1 -> FOLLOWUP_Q2 -> FOLLOWUP_Q3 -> CLOSING -> DONE
```

Each state captures the user's answer before advancing. Follow-up questions are generated dynamically using RAG context from uploaded knowledge base documents.

---

## Deploy to Render

The project includes a `render.yaml` blueprint and a `build.sh` script for deployment.

### Option A: Blueprint (recommended)

1. Push the repo to GitHub.
2. Go to Render dashboard and click "New" > "Blueprint".
3. Connect your GitHub repo.
4. Render reads `render.yaml` and creates two services:
   - **lssu-session-agent** (Web Service) -- backend API + frontend
   - **lssu-voice-agent** (Background Worker) -- LiveKit voice agent
5. Add environment variables for both services:
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Option B: Manual setup

**Web Service (API + frontend):**
- Build command: `bash build.sh`
- Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment: Python 3, Node 18
- Root directory: (repo root)

**Background Worker (voice agent):**
- Build command: `cd backend && pip install -r requirements.txt`
- Start command: `cd backend && python -m app.agent.interview_agent start`
- Environment: Python 3

Add all env vars listed above to both services.

---

## Notes

- The frontend uses a black and white minimal design -- no gradients, no neon colors.
- The sidebar is collapsible (toggle button in the top-left).
- All protected routes redirect to /login if no auth token is present.
- In production, FastAPI serves the frontend build from `backend/static/`. In development, Vite proxies `/api` to port 8000.
- Uploaded documents support PDF, TXT, DOCX, and MD formats.
- The agent uses Silero VAD for voice activity detection, OpenAI Whisper for STT, and OpenAI TTS (alloy voice) for speech output.
- On Render free tier, the background worker may spin down. Use a paid plan for always-on voice agent.
