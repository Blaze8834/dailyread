# dailyread

dailyread is a lightweight tactical simulation game where each day delivers a single "play". Players choose a hot route, run the simulation, and submit an attempt that is scored by both the client and the server.

## Features
- Flask API with SQLite storage and server-side scoring validation.
- Vanilla JS canvas simulation with radial route selection.
- Offline queueing for attempts via IndexedDB.
- PWA support (manifest + service worker caching of static assets and last play).

## Project layout
```
.
├── app.py
├── models.py
├── routes.py
├── seed_dev_db.py
├── dailyread.db (created after seeding)
├── frontend
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   └── src
│       ├── canvas.js
│       └── main.js
```

## Requirements
- Python 3.11+

## Setup (macOS/Linux)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed_dev_db.py
python app.py
```

## Setup (Windows PowerShell)
```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed_dev_db.py
python app.py
```

Visit http://localhost:5000.

## API
- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/play/today`
- `GET /api/attempts?play_id=1`
- `POST /api/attempts`

## Database
SQLite is used by default (`dailyread.db`). To switch to Postgres, set `DATABASE_URL` to a valid SQLAlchemy-style URL and adjust `models.py` to use a Postgres driver (e.g. `psycopg`).

## Notes
- The client computes a provisional score during play. The server recomputes the score when storing attempts.
- The service worker caches `/api/play/today` and static assets for offline startup.

## Tests
Minimal tests can be added later. The current scaffold focuses on the game loop, API, and offline behavior.
