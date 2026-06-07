// Settings — app configuration (not patient data). Per project decision this is a
// minimal, honest stub: it does not read or write the warehouse.

async function renderSettings(el){
  const rows=[
    ["Data source","diahealth_compact_full.db (read-only)"],
    ["Warehouse model","Medallion \u2014 Gold layer"],
    ["Patients in cohort",String(PATIENTS.length)],
    ["Access mode","Read-only (SELECT / WITH only)"],
  ];
  el.innerHTML=`
    <div class="card pagehead"><h2 class="serif">Settings</h2>
      <p class="cardsub">Workspace configuration. This screen is app configuration only \u2014 it is not backed by patient data in the warehouse.</p>
    </div>
    <div class="cols">
      <div class="card">${h3("About This Workspace","Static app/runtime facts. Patient count is from /api/patients (gold_dim_patient, is_current=1); the rest describe the read-only connection.")}
        ${rows.map(([k,v])=>`<div class="kv"><span class="kvk">${esc(k)}</span><span class="kvv">${esc(v)}</span></div>`).join("")}
      </div>
      <div class="card">${h3("Preferences","Not backed by the warehouse \u2014 user preferences/thresholds are app configuration to be added later.")}
        ${emptyCard("Not yet available","User profile, clinical thresholds, notifications, and integrations are not part of the dataset and will be implemented later.","\u2699")}
      </div>
    </div>
    ${footer()}`;
}

SCREENS.settings=renderSettings;
