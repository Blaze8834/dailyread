from flask import Blueprint, jsonify, request

from models import get_play_today, list_attempts, save_attempt

api = Blueprint("api", __name__, url_prefix="/api")


@api.get("/health")
def health():
    return jsonify({"status": "ok"})


@api.get("/play/today")
def play_today():
    play = get_play_today()
    if not play:
        return jsonify({"error": "No play seeded"}), 404
    return jsonify(play)


@api.get("/attempts")
def attempts_list():
    play_id = request.args.get("play_id", type=int)
    return jsonify(list_attempts(play_id))


@api.post("/attempts")
def attempts_create():
    payload = request.get_json(silent=True) or {}
    required_fields = {"play_id", "route_id", "events"}
    missing = required_fields - payload.keys()
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(sorted(missing))}"}), 400

    play = get_play_today()
    if not play or play.get("id") != payload.get("play_id"):
        return jsonify({"error": "Invalid play_id"}), 400

    attempt = save_attempt(play, payload)
    return jsonify(attempt), 201
