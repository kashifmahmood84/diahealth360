"""Flask application factory: serves the frontend + registers API blueprints."""
import os
from flask import Flask, abort, jsonify, send_file, send_from_directory
from .config import FRONTEND_DIR, INDEX_HTML, WAREHOUSE
from .routes import ALL_BLUEPRINTS

def create_app():
    app = Flask(__name__)

    # API routes first so they are never shadowed by the static catch-all.
    for bp in ALL_BLUEPRINTS:
        app.register_blueprint(bp)

    @app.route("/health")
    def health():
        return jsonify({
            "status": "ok",
            "warehouse": os.path.isfile(WAREHOUSE),
            "frontend": os.path.isdir(FRONTEND_DIR),
        })

    @app.route("/")
    def index():
        return send_file(INDEX_HTML, mimetype="text/html")

    @app.route("/<path:path>")
    def static_files(path):
        if path.startswith("api/"):
            abort(404)
        full = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(full):
            resp = send_from_directory(FRONTEND_DIR, path)
            if path.endswith((".js", ".css", ".html")):
                resp.headers["Cache-Control"] = "no-cache, must-revalidate"
            return resp
        # Missing real asset (has a file extension) → 404, not HTML (avoids MIME errors).
        if "." in os.path.basename(path):
            abort(404)
        return send_file(INDEX_HTML, mimetype="text/html")

    return app
