import os

from authlib.integrations.flask_client import OAuth
from flask import Flask, redirect, session, url_for

from models import init_db, get_user_by_email, create_user
from routes import api


def create_app() -> Flask:
    app = Flask(__name__, static_folder="frontend", static_url_path="")
    app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")
    init_db()
    app.register_blueprint(api)

    oauth = OAuth(app)
    google = oauth.register(
        name="google",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        access_token_url="https://oauth2.googleapis.com/token",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        api_base_url="https://www.googleapis.com/oauth2/v2/",
        client_kwargs={"scope": "openid email profile"},
    )

    @app.get("/")
    def index():
        return app.send_static_file("index.html")

    @app.get("/manifest.json")
    def manifest():
        return app.send_static_file("manifest.json")

    @app.get("/service-worker.js")
    def service_worker():
        return app.send_static_file("service-worker.js")

    @app.get("/auth/google")
    def auth_google():
        redirect_uri = url_for("auth_google_callback", _external=True)
        return google.authorize_redirect(redirect_uri)

    @app.get("/auth/google/callback")
    def auth_google_callback():
        token = google.authorize_access_token()
        user_info = google.get("userinfo").json()
        email = user_info.get("email")
        if not email:
            return redirect("/")
        user = get_user_by_email(email)
        if not user:
            user_id = create_user(email, None)
            user = {"id": user_id, "email": email}
        admin_emails = [
            email.strip().lower()
            for email in os.environ.get("ADMIN_EMAILS", "").split(",")
            if email.strip()
        ]
        session["user_id"] = user["id"]
        session["is_admin"] = email.lower() in admin_emails
        return redirect("/")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
