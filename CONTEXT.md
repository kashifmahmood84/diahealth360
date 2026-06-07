# DiaHealth 360 — Project Context

A single-patient-at-a-time clinical command center for a 25-patient diabetes
cohort, built on a Synthea FHIR R5 medallion-gold SQLite warehouse. This file is
the map: read it before building any screen.

## How it runs
- `python3 backend/app.py` → serves the frontend at http://localhost:5000 and a
  JSON API under `/api/...`.
- Frontend is a single-page shell (`frontend/index.html`) with a left nav; each
  nav item swaps the content area and calls the API for live data.

## Project layout
```
backend/        Flask app factory + read-only DB layer + route blueprints
frontend/       index.html + css/app.css + js/ modules (state, api, screens, app)
data/           diahealth_compact_full.db  (READ-ONLY warehouse)
docs/mocks/     the 16 reference screen images (the design spec)
.cursorrules    the rules Cursor must follow
CONTEXT.md      this file
```

## The warehouse (gold star schema, 25 patients)
Dimensions: `gold_dim_patient` (SCD2, use is_current=1), `gold_dim_provider`,
`gold_dim_organization`, `gold_dim_location`, `gold_dim_medication`,
`gold_dim_code`, `gold_dim_date` (date_key = yyyymmdd), `gold_dim_payer` (placeholder).

Facts: `gold_fact_observation`, `gold_fact_condition`, `gold_fact_encounter`,
`gold_fact_medication` (compat, code-keyed — use for display),
`gold_fact_medication_request` / `_admin`, `gold_fact_procedure`,
`gold_fact_immunization`, `gold_fact_allergy`, `gold_fact_diagnostic_report`,
`gold_fact_document`, `gold_fact_imaging_study`, `gold_fact_device`,
`gold_fact_careplan`, `gold_fact_careteam`.

Bridges: `gold_bridge_encounter_diagnosis`, `gold_bridge_careteam_member`.
Aggregates: `gold_agg_patient_summary` (one row/patient), `gold_agg_observation_monthly`.

Keys: surrogate `patient_key` joins facts→patient; `patient_id` is the FHIR UUID.
Codes join `*_code_key` → `gold_dim_code.code_key` (`.code` is LOINC/SNOMED/CVX).
Dates join `*_date_key` → `gold_dim_date.date_key`; `.full_date` is ISO date.

## Metric codes (for the standard 6 tiles)
| Tile | LOINC `gold_dim_code.code` |
|------|------|
| HbA1c (%) | 4548-4 |
| Avg Glucose (mg/dL) | 2345-7 |
| eGFR (mL/min/1.73m²) | 33914-3 |
| LDL Cholesterol (mg/dL) | 18262-6 |
| Systolic BP (mmHg) | 8480-6 |
| Creatinine (mg/dL) | 2160-0 |
Other useful labs: HDL 2085-9, Triglycerides 2571-8, ALT 1742-6, AST 1920-8,
BUN 3094-0, Potassium 2823-3, Diastolic BP 8462-4, Weight 29463-7.

## Screen → gold table mapping
- Overview: patient header + 6 metric tiles + trend chart (observation) + risk
  (condition+eGFR) + labs + medications + conditions + encounters + procedures +
  care team + care gaps.
- Patient 360: snapshot (dim_patient) + sub-tabs over the facts.
- Timeline: merge encounter/observation/medication/procedure/immunization/document
  rows ordered by date.
- Trends & Analytics: observation series + gold_agg_observation_monthly.
- Labs: gold_fact_observation (category='laboratory') grouped by panel.
- Medications: gold_fact_medication / _request / _admin + gold_dim_medication.
- Encounters: gold_fact_encounter (class/type/LOS/flags).
- Procedures: gold_fact_procedure (dialysis dominates — that's real).
- Immunizations: gold_fact_immunization.
- Allergies: gold_fact_allergy (sparse → empty states normal).
- Documents: gold_fact_document (metadata only, no body text).
- Reports: gold_fact_diagnostic_report + linked observations.
- Devices: gold_fact_device (inventory only — NOT CGM telemetry).
- Care Team: gold_fact_careteam + gold_bridge_careteam_member + gold_dim_provider.
- Complications: derived from condition + eGFR/LDL/BP observations (show derivation).
- Care Gaps: derived from immunization + procedure + lab recency.
- Settings: app config (non-data).

## EXCLUDED everywhere (no schema — never build)
CGM/Time-in-Range/AGP/GMI/glucose-variability/heatmap; medication adherence %;
Health-Score / Diabetes-Control gauges; lifestyle (steps/sleep/stress/etc.);
hypoglycemia-event counts.

## API shape (already built)
`POST /api/warehouse/query` `{sql, params}` → rows (SELECT/WITH only, read-only).
`GET /api/patients` → the 25 patients for the selector.
Add per-screen endpoints in `backend/routes/` as you build screens, OR keep using
the generic query endpoint from the frontend. Keep one data-access helper so a
metric reads identically on every screen.
