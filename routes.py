from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from models import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    init_db,
    list_attempts,
    store_attempt,
)
from playbook import (
    build_play,
    generate_play_name,
    score_attempt,
    seed_for_today,
    seed_from_name,
)

api = Blueprint("api", __name__, url_prefix="/api")


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return get_user_by_id(user_id)


def is_admin() -> bool:
    return bool(session.get("is_admin"))


@api.get("/health")
def health():
    return jsonify({"status": "ok"})


@api.get("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "email": user["email"], "is_admin": is_admin()})


@api.post("/auth/register")
def register():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if get_user_by_email(email):
        return jsonify({"error": "Email already exists"}), 400

    password_hash = generate_password_hash(password)
    user_id = create_user(email, password_hash)
    session["user_id"] = user_id
    session["is_admin"] = False
    return jsonify({"status": "registered"})


@api.post("/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    user = get_user_by_email(email)
    if not user or not user.get("password_hash"):
        return jsonify({"error": "Invalid credentials"}), 401
    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401
    session["user_id"] = user["id"]
    session["is_admin"] = False
    return jsonify({"status": "logged_in"})


@api.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"status": "logged_out"})


@api.get("/play/today")
def play_today():
    tz = ZoneInfo("America/New_York")
    today = datetime.now(tz).strftime("%Y-%m-%d")
    override_name = session.get("override_play")
    if override_name:
        seed = seed_from_name(override_name)
        config = generate_play_name(seed)
        config.name = override_name
    else:
        seed = seed_for_today()
        config = generate_play_name(seed)
    play = build_play(config.name, seed, config)
    play.pop("coverage", None)
    play["play_date"] = today
    return jsonify(play)


@api.post("/attempts")
def attempts_create():
    payload = request.get_json(silent=True) or {}
    required = {"play_name", "play_date", "route_selections", "events", "coverage_guess"}
    missing = required - payload.keys()
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(sorted(missing))}"}), 400

    play_name = payload["play_name"]
    play_date = payload["play_date"]
    route_selections = payload["route_selections"]
    events = payload["events"]
    coverage_guess = payload["coverage_guess"]

    seed = seed_from_name(play_name)
    config = generate_play_name(seed)
    config.name = play_name
    coverage_name = config.coverage
    read_correct = coverage_guess.strip().lower() == coverage_name.lower()
    score = score_attempt(events, read_correct)

    user = current_user()
    stored = store_attempt(
        user_id=user["id"] if user else None,
        play_name=play_name,
        play_date=play_date,
        route_selections=route_selections,
        events=events,
        score=score,
        coverage_name=coverage_name,
    )

    response = {"attempt": stored, "coverage": coverage_name, "score": score}
    return jsonify(response), 201


@api.get("/attempts")
def attempts_list():
    user = current_user()
    return jsonify(list_attempts(user["id"] if user else None))


@api.post("/admin/override")
def admin_override():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403
    payload = request.get_json(silent=True) or {}
    play_name = payload.get("play_name")
    if not play_name:
        session.pop("override_play", None)
        return jsonify({"status": "cleared"})
    session["override_play"] = play_name
    return jsonify({"status": "set", "play_name": play_name})
