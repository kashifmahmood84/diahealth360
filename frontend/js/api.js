// api.js — the single data-access layer. Every screen reads through these,
// so the same metric returns the same value everywhere. Read-only SELECT/WITH.

async function q(sql, params = [], tries = 2) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch("/api/warehouse/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    if (r.ok) return r.json();
    const msg = await r.text();
    // Render free tier: instance asleep (x-render-routing: no-server) — retry once.
    if (i < tries - 1 && (r.status === 404 || r.status === 503)) {
      await new Promise((ok) => setTimeout(ok, 2500));
      continue;
    }
    throw new Error("query failed: " + msg);
  }
}

async function loadPatients() {
  const r = await fetch("/api/patients");
  if (!r.ok) throw new Error("Could not load patients (" + r.status + ")");
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("Patients API returned unexpected data");
  return data;
}

function patientById(pk) {
  return PATIENTS.find((p) => p.patient_key === pk);
}

// full dim_patient row for the current patient
async function patientDetail(pk = CURRENT_PK) {
  const rows = await q(
    `SELECT * FROM gold_dim_patient WHERE patient_key=? AND is_current=1`, [pk]);
  return rows[0] || null;
}

// latest numeric value of a LOINC code for the current patient
async function latestMetric(code, pk = CURRENT_PK) {
  const rows = await q(
    `SELECT o.value_numeric v, o.value_unit u, d.full_date dt
     FROM gold_fact_observation o
     JOIN gold_dim_code c ON c.code_key = o.observation_code_key
     JOIN gold_dim_date d ON d.date_key = o.effective_date_key
     WHERE o.patient_key = ? AND c.code = ? AND o.value_numeric IS NOT NULL
     ORDER BY d.full_date DESC LIMIT 1`,
    [pk, code]
  );
  return rows[0] || null;
}

// full time series for a LOINC code (includes ref range + flags when present in warehouse)
async function metricSeries(code, pk = CURRENT_PK) {
  return q(
    `SELECT d.full_date dt, o.value_numeric v, o.value_unit u,
            o.ref_range_low rl, o.ref_range_high rh, o.interpretation interp, o.is_abnormal abn
     FROM gold_fact_observation o
     JOIN gold_dim_code c ON c.code_key = o.observation_code_key
     JOIN gold_dim_date d ON d.date_key = o.effective_date_key
     WHERE o.patient_key = ? AND c.code = ? AND o.value_numeric IS NOT NULL
     ORDER BY d.full_date`,
    [pk, code]
  );
}

// the patient's diabetes diagnosis (primary Dx in this cohort), from real conditions
async function primaryDiagnosis(pk = CURRENT_PK) {
  const rows = await q(
    `SELECT c.display nm, MIN(d.full_date) since
     FROM gold_fact_condition f
     JOIN gold_dim_code c ON c.code_key = f.condition_code_key
     LEFT JOIN gold_dim_date d ON d.date_key = f.onset_date_key
     WHERE f.patient_key = ? AND c.display LIKE '%diabetes mellitus type 2%'
     GROUP BY c.display ORDER BY since LIMIT 1`, [pk]);
  if (rows[0]) return rows[0];
  // fallback: earliest active chronic condition
  const fb = await q(
    `SELECT c.display nm, MIN(d.full_date) since
     FROM gold_fact_condition f
     JOIN gold_dim_code c ON c.code_key = f.condition_code_key
     LEFT JOIN gold_dim_date d ON d.date_key = f.onset_date_key
     WHERE f.patient_key = ? AND f.is_active = 1
     GROUP BY c.display ORDER BY since LIMIT 1`, [pk]);
  return fb[0] || null;
}

// the one-row aggregate summary for a patient (counts, latest a1c/egfr)
async function patientSummary(pk = CURRENT_PK) {
  const rows = await q(`SELECT * FROM gold_agg_patient_summary WHERE patient_key=?`, [pk]);
  return rows[0] || null;
}

// Care-gap recency, computed from REAL last-done dates vs standard screening
// intervals (CARE_GAPS in state.js). Single source of truth for Overview + Care Gaps.
async function computeCareGaps(pk = CURRENT_PK) {
  const out = [];
  for (const g of CARE_GAPS) {
    let lastDate = null;
    if (g.kind === "lab") {
      const r = await q(
        `SELECT MAX(d.full_date) dt FROM gold_fact_observation o
         JOIN gold_dim_code c ON c.code_key=o.observation_code_key
         JOIN gold_dim_date d ON d.date_key=o.effective_date_key
         WHERE o.patient_key=? AND c.code IN (${g.match.map(()=>"?").join(",")})`,
        [pk, ...g.match]);
      lastDate = r[0] && r[0].dt;
    } else if (g.kind === "immunization") {
      const like = g.match.map(()=>"cd.display LIKE ?").join(" OR ");
      const r = await q(
        `SELECT MAX(d.full_date) dt FROM gold_fact_immunization i
         JOIN gold_dim_code cd ON cd.code_key=i.vaccine_code_key
         JOIN gold_dim_date d ON d.date_key=i.occurrence_date_key
         WHERE i.patient_key=? AND (${like})`, [pk, ...g.match]);
      lastDate = r[0] && r[0].dt;
    } else if (g.kind === "procedure") {
      const like = g.match.map(()=>"cd.display LIKE ?").join(" OR ");
      const r = await q(
        `SELECT MAX(d.full_date) dt FROM gold_fact_procedure p
         JOIN gold_dim_code cd ON cd.code_key=p.procedure_code_key
         JOIN gold_dim_date d ON d.date_key=p.performed_date_key
         WHERE p.patient_key=? AND (${like})`, [pk, ...g.match]);
      lastDate = r[0] && r[0].dt;
    }
    const m = lastDate ? (Date.now() - new Date(lastDate).getTime()) / (1000*60*60*24*30.44) : null;
    let status;
    if (m == null) status = "Overdue";
    else if (m <= g.months) status = "Up to date";
    else if (m <= g.months * 1.5) status = "Due";
    else status = "Overdue";
    out.push({ ...g, lastDate, status });
  }
  return out;
}
