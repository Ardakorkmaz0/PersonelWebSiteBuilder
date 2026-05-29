# PersonelWebSiteBuilder

A personal website builder with two editing paths:

- Build from ready-made components on a free canvas, then tune desktop/mobile
  layouts independently.
- Import an existing HTML project directly in the editor. Uploaded HTML is kept
  as real HTML, with matching CSS/JS/assets inlined when they are uploaded
  together, so view mode can run the page's JavaScript in an isolated sandbox.

Imported HTML sites can be viewed, lightly edited in-place, tested against common
desktop/tablet/phone viewport presets, saved as drafts, and published to a public
URL.

## Tech stack

- **Frontend:** React (Vite, JavaScript), Tailwind CSS, Zustand, @dnd-kit, React Router, axios
- **Backend:** Django + Django REST Framework, token auth, SQLite (JSON schema storage)

## Run the project

**One command (Windows).** From the project root, double-click `start.bat` (or run
it in a terminal). On the first run it creates the Python virtualenv, installs the
backend + frontend dependencies, applies migrations, starts both servers, and opens
the browser.

```powershell
.\start.bat
```

If PowerShell blocks the script, run it explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Then open http://localhost:5173 (backend runs on http://127.0.0.1:8000).

### Run manually

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # http://127.0.0.1:8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```
