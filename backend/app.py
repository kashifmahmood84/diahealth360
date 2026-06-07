"""Entry point.  Run from the project root:  python3 backend/app.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend import create_app
from backend.config import HOST, PORT, DEBUG, WAREHOUSE, INDEX_HTML

app = create_app()

if __name__ == "__main__":
    for f in (WAREHOUSE, INDEX_HTML):
        if not os.path.exists(f):
            print("WARNING: missing", f)
    print(f"DiaHealth 360 -> http://{HOST}:{PORT}   (warehouse read-only)")
    app.run(host=HOST, port=PORT, debug=DEBUG, use_reloader=False)
