from pathlib import Path

from flask import Flask, send_from_directory

from models import init_db
from routes import api


def create_app() -> Flask:
    app = Flask(__name__, static_folder="frontend", static_url_path="")
    init_db()
    app.register_blueprint(api)

    @app.get("/")
    def index():
        return send_from_directory(Path(app.static_folder), "index.html")

    @app.get("/manifest.json")
    def manifest():
        return send_from_directory(Path(app.static_folder), "manifest.json")

    @app.get("/service-worker.js")
    def service_worker():
        return send_from_directory(Path(app.static_folder), "service-worker.js")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
