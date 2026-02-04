import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DB_PATH = os.environ.get("DAILYREAD_DB", os.path.join(os.getcwd(), "dailyread.db"))


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS plays (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                play_id INTEGER NOT NULL,
                route_id TEXT NOT NULL,
                events TEXT NOT NULL,
                score REAL NOT NULL,
                client_id TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(client_id)
            )
            """
        )


def seed_play(play: Dict[str, Any]) -> None:
    with get_connection() as conn:
        payload = json.dumps(play)
        conn.execute(
            "INSERT OR REPLACE INTO plays (id, name, payload, created_at) VALUES (?, ?, ?, ?)",
            (play["id"], play["name"], payload, datetime.now(timezone.utc).isoformat()),
        )


def get_play_today() -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT payload FROM plays ORDER BY id DESC LIMIT 1").fetchone()
        if not row:
            return None
        return json.loads(row["payload"])


def list_attempts(play_id: Optional[int] = None) -> List[Dict[str, Any]]:
    query = "SELECT * FROM attempts"
    params: List[Any] = []
    if play_id is not None:
        query += " WHERE play_id = ?"
        params.append(play_id)
    query += " ORDER BY created_at DESC"

    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        return [
            {
                "id": row["id"],
                "play_id": row["play_id"],
                "route_id": row["route_id"],
                "events": json.loads(row["events"]),
                "score": row["score"],
                "client_id": row["client_id"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]


def compute_score(play: Dict[str, Any], attempt: Dict[str, Any]) -> float:
    events = attempt.get("events", [])
    objectives = play.get("objectives", [])

    collisions = [event for event in events if event.get("type") == "collision"]

    zone_times: Dict[str, float] = {}
    active_entries: Dict[str, float] = {}
    time_to_first_entry: Dict[str, float] = {}

    for event in events:
        if event.get("type") == "entered_zone":
            zone_id = event.get("payload", {}).get("zone_id")
            if zone_id is None:
                continue
            active_entries[zone_id] = event.get("t", 0.0)
            time_to_first_entry.setdefault(zone_id, event.get("t", 0.0))
        elif event.get("type") == "exit_zone":
            zone_id = event.get("payload", {}).get("zone_id")
            if zone_id is None:
                continue
            start = active_entries.pop(zone_id, None)
            if start is not None:
                zone_times[zone_id] = zone_times.get(zone_id, 0.0) + (
                    event.get("t", 0.0) - start
                )

    score = 0.0

    for obj in objectives:
        obj_type = obj.get("type")
        params = obj.get("params", {})
        obj_id = obj.get("id")

        if obj_type == "reach_zone":
            time_limit = params.get("time_limit", 60)
            first_entry = time_to_first_entry.get(obj_id)
            if first_entry is not None and first_entry <= time_limit:
                score += 100.0
            score += zone_times.get(obj_id, 0.0)
        elif obj_type == "avoid_collision":
            score -= 50.0 * len(collisions)
        elif obj_type == "time_bonus":
            complete_time = time_to_first_entry.get(obj_id)
            if complete_time is not None:
                score += max(0.0, 60.0 - complete_time) * 2.0

    return round(score, 2)


def save_attempt(play: Dict[str, Any], attempt: Dict[str, Any]) -> Dict[str, Any]:
    computed_score = compute_score(play, attempt)
    now_iso = datetime.now(timezone.utc).isoformat()
    client_id = attempt.get("client_id")

    with get_connection() as conn:
        if client_id:
            existing = conn.execute(
                "SELECT * FROM attempts WHERE client_id = ?",
                (client_id,),
            ).fetchone()
            if existing:
                return {
                    "id": existing["id"],
                    "play_id": existing["play_id"],
                    "route_id": existing["route_id"],
                    "events": json.loads(existing["events"]),
                    "score": existing["score"],
                    "client_id": existing["client_id"],
                    "created_at": existing["created_at"],
                }

        cursor = conn.execute(
            """
            INSERT INTO attempts (play_id, route_id, events, score, client_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                attempt["play_id"],
                attempt["route_id"],
                json.dumps(attempt.get("events", [])),
                computed_score,
                client_id,
                now_iso,
            ),
        )
        attempt_id = cursor.lastrowid

    return {
        "id": attempt_id,
        "play_id": attempt["play_id"],
        "route_id": attempt["route_id"],
        "events": attempt.get("events", []),
        "score": computed_score,
        "client_id": client_id,
        "created_at": now_iso,
    }
