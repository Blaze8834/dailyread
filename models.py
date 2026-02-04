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
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                play_name TEXT NOT NULL,
                play_date TEXT NOT NULL,
                route_selections TEXT NOT NULL,
                events TEXT NOT NULL,
                score REAL NOT NULL,
                coverage_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def create_user(email: str, password_hash: Optional[str]) -> int:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, password_hash, now_iso),
        )
        return cursor.lastrowid


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row:
            return None
        return dict(row)


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return dict(row)


def store_attempt(
    user_id: Optional[int],
    play_name: str,
    play_date: str,
    route_selections: Dict[str, str],
    events: List[Dict[str, Any]],
    score: float,
    coverage_name: str,
) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO attempts (user_id, play_name, play_date, route_selections, events, score, coverage_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                play_name,
                play_date,
                json.dumps(route_selections),
                json.dumps(events),
                score,
                coverage_name,
                now_iso,
            ),
        )
        attempt_id = cursor.lastrowid

    return {
        "id": attempt_id,
        "user_id": user_id,
        "play_name": play_name,
        "play_date": play_date,
        "route_selections": route_selections,
        "events": events,
        "score": score,
        "coverage_name": coverage_name,
        "created_at": now_iso,
    }


def list_attempts(user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    query = "SELECT * FROM attempts"
    params: List[Any] = []
    if user_id is not None:
        query += " WHERE user_id = ?"
        params.append(user_id)
    query += " ORDER BY created_at DESC"

    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        return [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "play_name": row["play_name"],
                "play_date": row["play_date"],
                "route_selections": json.loads(row["route_selections"]),
                "events": json.loads(row["events"]),
                "score": row["score"],
                "coverage_name": row["coverage_name"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
