# DiaHealth 360

Clinical command center for a 25-patient diabetes cohort, on a read-only
Synthea FHIR medallion-gold SQLite warehouse. Flask backend + vanilla JS frontend.

## Run (macOS)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 backend/app.py
```
Open http://localhost:5050  (5000 is often taken by macOS AirPlay Receiver).

## Deploy on Render (free)
1. Push this repo to GitHub (must include `data/diahealth_compact_full.db`, ~14 MB).
2. Sign in at [render.com](https://render.com) → **New** → **Blueprint** → connect the repo  
   (Render reads `render.yaml`), **or** **New Web Service** with:
   - **Runtime:** Python 3
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `gunicorn --bind 0.0.0.0:$PORT backend.app:app`
   - **Plan:** Free
3. Wait for deploy; open the `https://….onrender.com` URL.
4. **Note:** Free tier sleeps after ~15 min idle; first load after sleep takes ~30–50 s.

## Layout
- `backend/`   Flask app factory, read-only DB layer, route blueprints
- `frontend/`  index.html + css/app.css + js modules (state, api, screens, app)
- `data/`      diahealth_compact_full.db (READ-ONLY warehouse)
- `docs/mocks/` reference screen designs
- `.cursorrules` rules Cursor follows on every request
- `CONTEXT.md`   the map of tables → screens

## Building the rest in Cursor
Overview is fully wired as the reference pattern. For each remaining nav item:
1. Drag its mock image from `docs/mocks/` into Cursor chat.
2. Ask: "Build this screen in frontend/js/screens.js using the gold tables,
   real data only, following .cursorrules and CONTEXT.md."
3. Verify it loads and the numbers match the DB, then `git commit`.

## The rule that matters
Layout is driven by the schema. Panels with no data source (CGM, adherence %,
health-score gauges, lifestyle, hypoglycemia counts) are never built. See
`.cursorrules`.
