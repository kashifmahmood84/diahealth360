"""Paths and server settings, resolved relative to the project root."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
WAREHOUSE = os.path.join(DATA_DIR, "diahealth_compact_full.db")
FRONTEND_DIR = os.path.join(ROOT, "frontend")
INDEX_HTML = os.path.join(FRONTEND_DIR, "index.html")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5050"))  # 5050 locally; Render sets PORT
DEBUG = False
