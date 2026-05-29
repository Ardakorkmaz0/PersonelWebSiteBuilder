# PersonelWebSiteBuilder

A mini drag-and-drop website builder. Users compose a personal site from ready-made
components (Navbar, Text, Button, Link Button, Image, Section, Card), edit each
component's content and style in a side panel, save the design as JSON, and publish it
to a public `/site/:slug` page.

The design is stored as a JSON schema (not raw HTML). Each component has
`id / type / props / styles`. Users can only use whitelisted components and styles —
free HTML/JS is never accepted, which prevents XSS.

## Tech stack

- **Frontend:** React (Vite, JavaScript), Tailwind CSS, Zustand, @dnd-kit, React Router, axios
- **Backend:** Django + Django REST Framework, token auth, SQLite, JSONField schema

## Project structure

```
backend/    Django project (config) + builder app (Site model, API, schema validation)
frontend/   Vite React app (editor, renderer, pages)
start.ps1   One command: sets up (if needed) and starts both servers
start.bat   Double-click entry point for start.ps1 (Windows)
```

## Quick start (one command)

Starts **both** the backend and the frontend at once. On the first run it also
creates the Python virtualenv, installs backend + frontend dependencies, and applies
database migrations — so a fresh clone just works.

**Windows** — from the project root, either double-click `start.bat`, or run:

```powershell
.\start.bat
```

Or run the PowerShell script directly (handy if execution policy blocks `.\start.ps1`):

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

This opens two terminal windows (backend on `http://127.0.0.1:8000`, frontend on
`http://localhost:5173`) and launches your browser. To stop the servers, close those
windows. Re-running the script is safe: if a port is already in use, that server is
skipped instead of started twice.

> **"Network error" görüyorsan** genelde backend kapalıdır — `start.bat`'ı tekrar
> çalıştırmak çalışmayan sunucuyu ayağa kaldırır.

## Manual setup

Prefer to run each server yourself? Use the two sections below.

### Run the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (use: source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # http://127.0.0.1:8000
```

### Run the frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Open http://localhost:5173, register an account, create a site, drag components onto the
canvas, edit them in the right panel, **Save**, then **Publish** and open the public page.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register/` | Create account, returns token |
| POST | `/api/auth/login/` | Obtain token |
| GET | `/api/auth/me/` | Current user |
| GET/POST | `/api/sites/` | List / create the user's sites |
| GET/PUT/DELETE | `/api/sites/{id}/` | Retrieve / save / delete a site |
| GET | `/api/public/sites/{slug}/` | Public read of a **published** site |

## Security

The saved schema is rendered onto a public page, so the backend
(`builder/validators.py`) re-validates every save: only whitelisted component types and
style keys are stored, and URLs with `javascript:` / `vbscript:` / `data:` schemes are
stripped. The frontend mirrors these rules (`src/utils/sanitize.js`) and never uses
`dangerouslySetInnerHTML`, so React escapes all user text.
```