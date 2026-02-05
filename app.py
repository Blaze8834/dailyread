import os
from urllib.parse import quote_plus

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
    google_client_id = os.environ.get("GOOGLE_CLIENT_ID")
    google_client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    google = oauth.register(
        name="google",
        client_id=google_client_id,
        client_secret=google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
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
        if not google_client_id or not google_client_secret:
            return redirect(f"/?auth_error={quote_plus('Google OAuth is not configured on the server')}")
        redirect_uri = url_for("auth_google_callback", _external=True)
        return google.authorize_redirect(redirect_uri)

    @app.get("/auth/google/callback")
    def auth_google_callback():
        try:
            token = google.authorize_access_token()
        except Exception as exc:
            message = f"Google login failed: {exc}"
            return redirect(f"/?auth_error={quote_plus(message)}")

        user_info = token.get("userinfo")
        if not user_info:
            user_info = google.get("userinfo").json()
        email = user_info.get("email")
        if not email:
            return redirect(f"/?auth_error={quote_plus('Google account email was not returned')}")
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
