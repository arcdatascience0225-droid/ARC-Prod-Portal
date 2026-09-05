# ARC Technologies & Institutions — AI Learning, Assessment & Placement Platform

A full-stack learning management and campus placement platform for training institutes.

**Live URLs**
- Frontend: `https://<your-project>.vercel.app`
- Backend API: `https://<your-service>.onrender.com`
- API docs: `https://<your-service>.onrender.com/docs`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.11), SQLAlchemy, PostgreSQL |
| Frontend | React + TypeScript, Vite, Tailwind CSS |
| AI | Google Gemini (primary) or Groq (fallback) |
| Auth | JWT (access + refresh tokens) |
| Hosting | Render (backend + database), Vercel (frontend) |

---

## Repository Structure

This is a **monorepo** — both apps live in one Git repository, in their own subfolders:

```
/
├── backend/          ← FastAPI app (Dockerfile lives here)
│   ├── app/
│   ├── requirements.txt
│   ├── create_tables.py    ← auto-creates all tables on first boot
│   └── seed_data.py        ← creates the first test accounts
├── frontend/         ← React/Vite app
│   ├── src/
│   └── package.json
└── README.md         ← this file
```

**⚠️ Because this is a monorepo, both Render and Vercel need to be told which subfolder to build from — see "Root Directory" below. This is the single most common deployment failure.**

---

## Environment Variables

Set these on the **Render backend service** → Settings → Environment.

### Required

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://user:pass@host/dbname` | **Must** start with `postgresql+psycopg2://`, not plain `postgresql://` (SQLAlchemy needs the driver name). Render's dashboard gives you `postgresql://` — edit it before pasting. |
| `JWT_SECRET_KEY` | any long random string | Used to sign login tokens. Keep it secret. |
| `AI_PROVIDER` | `gemini` or `groq` | Which AI backend to use for question generation. |
| `GEMINI_API_KEY` | `AIzaSy...` | Free key from https://aistudio.google.com/apikey |
| `FRONTEND_URL` | `https://your-project.vercel.app` | Must match your **actual** live Vercel URL exactly, or the browser will get CORS errors on every request. Update this every time the Vercel URL changes. |

### Optional (only if you use the feature)

| Variable | Used for |
|---|---|
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq as AI provider instead of Gemini |
| `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER*` | File uploads (certificates, recordings, reports) |
| `JUDGE0_API_KEY` | Non-Python code execution fallback |
| `SENDGRID_API_KEY` / `SMTP_*` | Sending emails |
| `SMS_PROVIDER_API_KEY` | SMS notifications |
| `REDIS_URL` | Token blacklist on logout (app works fine without it — falls back gracefully) |

### Frontend (set on Vercel → Project → Settings → Environment Variables)

| Variable | Example |
|---|---|
| `VITE_API_BASE_URL` | `https://your-service.onrender.com` — must match your **actual** live Render URL |

---

## Deploying From Scratch — Step by Step

### 1. Push the code to GitHub
Standard git push. Nothing special here.

### 2. Create the database (Render)
1. Render dashboard → **New +** → **PostgreSQL**
2. Choose a name and region
3. **Plan: read the warning below before choosing Free**
4. Once created, copy the **External Database URL** from its Info page — you'll need it for both local seeding and the backend service.

> ⚠️ **Render's Free PostgreSQL plan auto-deletes your database 30 days after creation** (14-day grace period to upgrade before permanent deletion). This is fine for testing, but if this is a real production database, **upgrade to a paid plan within those 30 days** — no data migration needed, it's a simple plan change, not a new database.

### 3. Create the backend web service (Render)
1. Render dashboard → **New +** → **Web Service** → connect your GitHub repo
2. **Root Directory: `backend`** ← this is the #1 cause of build failures ("Dockerfile not found" or "vite: command not found" errors happen when this is missing or wrong)
3. Add all the **Environment Variables** listed above
4. Deploy. Watch the logs — first successful deploy should show `Creating all tables... Done. 54 tables ensured` and end with `Your service is live 🎉`

### 4. Create the frontend project (Vercel)
1. Vercel dashboard → **Add New** → **Project** → import the same repo
2. **Root Directory: `frontend`** ← same issue as above, monorepos need this set explicitly
3. Add `VITE_API_BASE_URL` pointing at the Render backend URL from step 3
4. Deploy

### 5. Connect the two
Go back to the Render backend's environment variables and set `FRONTEND_URL` to the actual Vercel URL from step 4. Save (triggers a redeploy).

### 6. Seed the first accounts
The database starts completely empty — no users exist, so nobody can log in yet. Run this **once**, from your local machine:

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
set DATABASE_URL=postgresql+psycopg2://<paste External Database URL here, with the driver prefix fixed>
python seed_data.py
```

This creates test accounts for every role (all passwords `Password123!`):
- `superadmin@platform.com`
- `admin@platform.com`
- `faculty@platform.com`
- `student@platform.com`
- `hr@platform.com`

**Change these passwords (or delete these test accounts) before real users start using the platform.**

### 7. Run any pending SQL migrations
`create_tables.py` only creates tables that don't exist yet — it does **not** add new columns to existing tables. If a code update adds a new column to an existing table, you need to run an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` manually. Check for a `RUN_THIS_SQL_FIRST.txt` or similar file in the repo root before deploying a large update.

---

## Making the Deploy Pipeline "Just Work" (git push → auto-deploy)

If pushing to GitHub isn't automatically triggering a new deploy on Vercel, the Git integration likely isn't properly connected:

1. Vercel → Project → Settings → **Git** → confirm the repo shows as connected
2. If not, **Disconnect** then **Connect Git Repository** again and re-select the repo — this regenerates the GitHub webhook
3. Verify: GitHub repo → Settings → Webhooks — you should see one pointing at `vercel.com`

Render connects to GitHub automatically when you create the service from a repo, and does not usually need this fix.

---

## Known Gotchas (learned the hard way — read before you hit them)

1. **AI model names go stale — in two different ways.** (a) Google/Groq periodically shut down old model IDs outright (`gemini-2.0-flash` was shut down June 1, 2026). (b) Separately, some models get restricted to *only pre-existing users* and return `404 ... no longer available to new users` for a fresh API key even while the model still exists (this happened with `gemini-2.5-flash`). Either failure mode looks identical from the app's side (AI generation suddenly 500s) — check `backend/app/core/config.py`'s `GEMINI_MODEL` / `GROQ_MODEL` against the *current* model list on a fresh API key before assuming it's a code bug, and read the actual error text in Render's Logs tab — Google's error messages directly name the correct replacement model to switch to.

2. **`postgresql://` vs `postgresql+psycopg2://`.** Every database URL from Render/Supabase/etc. needs the `+psycopg2` driver suffix added manually for SQLAlchemy — the raw URL they give you will fail with "connection to server at localhost" errors that look unrelated to the real cause.

3. **Free-tier compute is genuinely too slow for real concurrent use.** Render's free instance (0.1 vCPU) struggles badly once more than ~10 people use the platform at the same time — expect multi-second delays on simple actions and outright timeouts on heavier ones (code execution, file uploads). Load-test with a realistic number of simulated users before a real exam/rollout, and budget for at least the Starter paid tier ($7/mo, 0.5 vCPU) if reliability matters.

4. **Code execution must never block the server.** Any endpoint that runs student-submitted code (Python subprocess, SQL, etc.) must be offloaded via `run_in_threadpool` — otherwise one student running code freezes the *entire* backend for everyone else, since Render's free tier runs a single worker.

5. **Monorepo Root Directory.** Both Render and Vercel need `backend` / `frontend` set explicitly under their Settings — the platform does not reliably auto-detect this in a repo with both a backend and frontend folder.

6. **CORS errors are usually a disguised backend crash, not an actual CORS misconfiguration.** An unhandled exception in a FastAPI endpoint returns a raw 500 *without* CORS headers, which the browser reports as a CORS error. If you see a CORS error in the console, check the Render **runtime Logs** tab (not Build Logs) for a Python traceback before touching any CORS settings.

7. **Duplicate downloaded files break TypeScript builds.** `tsc -b` type-checks every file in `src/`, including unused ones. A stray `SomeFile (1).tsx` left over from a browser download will fail the whole build even if nothing imports it — always overwrite the original filename, never leave a numbered duplicate in the source tree.

---

## Local Development

```cmd
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
set DATABASE_URL=<your local or dev database>
python create_tables.py
python seed_data.py
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Troubleshooting Checklist

Before asking for help, check these in order:

1. **Render → Logs tab** (not Build Logs) — most runtime errors show a full Python traceback here
2. **Browser DevTools → Console/Network tab** — check the actual HTTP status code, not just "CORS error" or "Failed to fetch"
3. **Environment Variables** — confirm `DATABASE_URL`, `FRONTEND_URL` (backend) and `VITE_API_BASE_URL` (frontend) all point at the *current*, *actual* live URLs
4. **Root Directory** setting on both Render and Vercel
5. Is the database on the free plan and has it silently expired?
