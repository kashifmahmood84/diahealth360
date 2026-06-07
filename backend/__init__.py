"""Flask application factory: serves the frontend + registers API blueprints."""
import os
from flask import Flask, send_file, send_from_directory
from .config import FRONTEND_DIR, INDEX_HTML
from .routes import ALL_BLUEPRINTS

def create_app():
    app = Flask(__name__)

    @app.route("/")
    def index():
        return send_file(INDEX_HTML)

    @app.route("/<path:path>")
    def static_files(path):
        full = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(full):
            resp = send_from_directory(FRONTEND_DIR, path)
            if path.endswith((".js", ".css", ".html")):
                resp.headers["Cache-Control"] = "no-cache, must-revalidate"
            return resp
        return send_file(INDEX_HTML)  # SPA fallback

    for bp in ALL_BLUEPRINTS:
        app.register_blueprint(bp)
    return app
