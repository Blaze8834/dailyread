# dailyread

## Introduction
dailyread is a web-based American football play simulator that lets users choose a hot route for the controlled player, run a short tactical simulation, and review the scored outcome. It combines a Python Flask backend with a JavaScript canvas frontend, uses SQLite for storage, and relies on IndexedDB + a service worker to support offline play and syncing. The goal is to make football route concepts approachable while keeping the simulation deterministic and replayable.

## What the app does (beginner-friendly overview)
- Loads a daily play from the backend (entities, routes, and objectives).
- Lets the user select a route via a radial menu.
- Simulates movement, collisions, and zone entry events.
- Records a timestamped event log and computes a score on both client and server.
- Queues attempts offline and syncs them when connectivity returns.

## High-level architecture
**Backend (Flask + SQLite)**  
- Stores play JSON and attempt event logs in a local SQLite database.  
- Serves API endpoints for play loading and attempt submission.  
- Recomputes the score server-side for integrity.

**Frontend (Vanilla JS + Canvas)**  
- Renders the play on a `<canvas>`.  
- Runs a deterministic simulation loop with `requestAnimationFrame`.  
- Records events (route selection, collisions, zone entry/exit).  
- Handles offline queueing in IndexedDB and syncs when online.

**PWA support**  
- Service worker caches static assets and the last play JSON.  
- Manifest enables installable behavior on supported devices.

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

## Setup (Windows Command Prompt)
```cmd
py -3.11 -m venv .venv
.\.venv\Scripts\activate
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
- If the API is unavailable, the frontend will load a built-in sample play for demo purposes.

## Tests
Minimal tests can be added later. The current scaffold focuses on the game loop, API, and offline behavior.
