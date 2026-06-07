// Timeline — merged longitudinal view from real event facts.

const TL_TYPES=[
  {key:"Encounter",color:"#2563eb"},{key:"Lab",color:"#0d9488"},{key:"Medication",color:"#d97706"},
  {key:"Condition",color:"#db2777"},{key:"Procedure",color:"#7c3aed"},{key:"Immunization",color:"#16a34a"},
  {key:"Document",color:"#0891b2"},{key:"Allergy",color:"#dc2626"},
];
const TL_COLOR=Object.fromEntries(TL_TYPES.map(t=>[t.key,t.color]));

// merged events for a patient, most recent first
async function timelineEvents(pk=CURRENT_PK, limit=300){
  const rows=await q(`
    SELECT dt, etype, label, detail FROM (
      SELECT d.full_date dt, 'Encounter' etype, f.encounter_class label, f.encounter_type detail
        FROM gold_fact_encounter f JOIN gold_dim_date d ON d.date_key=f.admit_date_key WHERE f.patient_key=?
      UNION ALL
      SELECT d.full_date, 'Medication', c.display, m.status
        FROM gold_fact_medication m JOIN gold_dim_code c ON c.code_key=m.medication_code_key
        JOIN gold_dim_date d ON d.date_key=m.authored_date_key
        WHERE m.patient_key=? AND m.medication_code_key IS NOT NULL
      UNION ALL
      SELECT d.full_date, 'Condition', c.display, f.clinical_status
        FROM gold_fact_condition f JOIN gold_dim_code c ON c.code_key=f.condition_code_key
        JOIN gold_dim_date d ON d.date_key=f.onset_date_key WHERE f.patient_key=?
      UNION ALL
      SELECT d.full_date, 'Procedure', c.display, f.status
        FROM gold_fact_procedure f JOIN gold_dim_code c ON c.code_key=f.procedure_code_key
        JOIN gold_dim_date d ON d.date_key=f.performed_date_key WHERE f.patient_key=?
      UNION ALL
      SELECT d.full_date, 'Immunization', c.display, i.status
        FROM gold_fact_immunization i JOIN gold_dim_code c ON c.code_key=i.vaccine_code_key
        JOIN gold_dim_date d ON d.date_key=i.occurrence_date_key WHERE i.patient_key=?
      UNION ALL
      SELECT d.full_date, 'Document', f.category_code, f.content_type
        FROM gold_fact_document f JOIN gold_dim_date d ON d.date_key=f.document_date_key WHERE f.patient_key=?
      UNION ALL
      SELECT d.full_date, 'Allergy', c.display, ac.criticality
        FROM gold_fact_allergy ac JOIN gold_dim_code c ON c.code_key=ac.allergy_code_key
        JOIN gold_dim_date d ON d.date_key=ac.recorded_date_key WHERE ac.patient_key=?
      UNION ALL
      SELECT d.full_date, 'Lab', 'HbA1c ' || o.value_numeric || '%', c.display
        FROM gold_fact_observation o JOIN gold_dim_code c ON c.code_key=o.observation_code_key
        JOIN gold_dim_date d ON d.date_key=o.effective_date_key
        WHERE o.patient_key=? AND c.code='4548-4' AND o.value_numeric IS NOT NULL
    ) WHERE dt IS NOT NULL ORDER BY dt DESC LIMIT ?`,
    [pk,pk,pk,pk,pk,pk,pk,pk,limit]);
  return rows.map(r=>({
    dt:r.dt, type:r.etype,
    label: r.etype==="Encounter" ? (ENC_CLASS[r.label]||r.label||"Encounter") : cleanCode(r.label||r.etype),
    detail: cleanCode(r.detail||""),
  }));
}

async function renderTimeline(el){
  el.innerHTML=`<div class="loading">Loading timeline\u2026</div>`;
  const pk=CURRENT_PK;
  const tiles=await Promise.all(METRICS.map(async ([k,label,unit,code,dec])=>{
    const m=await latestMetric(code);
    return {label,code,tip:METRIC_PROV[code],v:m&&m.v!=null?fmt(m.v,dec):DASH,dt:m&&m.dt};
  }));
  const events=await timelineEvents(pk,400);

  // derived milestones
  const a1c=await metricSeries("4548-4");
  const dxRow=await primaryDiagnosis();
  const milestones=[];
  if(dxRow) milestones.push(["Diabetes Diagnosed",fmtDate(dxRow.since)]);
  if(a1c.length){
    const best=a1c.reduce((a,b)=>b.v<a.v?b:a), worst=a1c.reduce((a,b)=>b.v>a.v?b:a), last=a1c[a1c.length-1];
    milestones.push(["Best HbA1c",`${fmt(best.v,1)}% on ${fmtDate(best.dt)}`]);
    milestones.push(["Highest HbA1c",`${fmt(worst.v,1)}% on ${fmtDate(worst.dt)}`]);
    milestones.push(["Current HbA1c",`${fmt(last.v,1)}% on ${fmtDate(last.dt)}`]);
  }

  const typeFilters=`<div class="tlfilters">${TL_TYPES.map(t=>
    `<label class="chk"><input type="checkbox" data-type="${t.key}" checked><i style="background:${t.color}"></i>${t.key}</label>`).join("")}</div>`;

  el.innerHTML=`
    ${await compactHeader(statCards(tiles.slice(0,3).map(t=>({label:t.label,value:t.v,sub:t.dt?fmtDate(t.dt):"No data",tip:t.tip}))))}
    <div class="card pagehead">
      <h2 class="serif">Care Journey Timeline ${infoTip("Merged from gold_fact_encounter, _medication, _condition, _procedure, _immunization, _document, _allergy and HbA1c rows of gold_fact_observation, each joined to gold_dim_date, ordered by date descending. Use the type toggles to filter.")}</h2>
      <p class="cardsub">Complete longitudinal view &mdash; ${events.length} most recent events</p>
      <div class="toolbar">
        <input class="search" id="tl-search" placeholder="Search timeline\u2026">
        ${typeFilters}
        <button class="btn" disabled title="Coming soon">\u2913 Export</button>
      </div>
    </div>
    <div class="cols">
      <div class="card"><div id="tl-list" class="tlist"></div></div>
      <div class="stack">
        <div class="card">${h3("AI Generated Summary","Not derivable \u2014 narrative summaries are not stored in the warehouse.")}
          ${emptyCard("Not available","Narrative summaries are not part of the dataset.","\u{1F4DD}")}
        </div>
        <div class="card">${h3("Key Milestones","Computed from this patient's data: diagnosis date from gold_fact_condition; best/highest/current HbA1c from gold_fact_observation (LOINC 4548-4).")}
          ${milestones.map(([k,v])=>`<div class="kv"><span class="kvk">${esc(k)}</span><span class="kvv">${esc(v)}</span></div>`).join("")||'<div class="empty">None</div>'}
        </div>
        <div class="card"><h3>Legend</h3>
          <div class="tlfilters">${TL_TYPES.map(t=>`<span class="chk"><i style="background:${t.color}"></i>${t.key}</span>`).join("")}</div>
        </div>
      </div>
    </div>
    ${footer()}`;

  const listEl=el.querySelector("#tl-list");
  const searchEl=el.querySelector("#tl-search");
  const checks=[...el.querySelectorAll("input[data-type]")];
  function draw(){
    const term=searchEl.value.toLowerCase();
    const on=new Set(checks.filter(c=>c.checked).map(c=>c.dataset.type));
    const filtered=events.filter(e=>on.has(e.type)&&(!term||(e.label+" "+e.detail).toLowerCase().includes(term)));
    if(!filtered.length){ listEl.innerHTML=`<div class="empty">No events match.</div>`; return; }
    let html="", curYear="";
    filtered.forEach(e=>{
      const yr=yearOf(e.dt);
      if(yr!==curYear){ curYear=yr; html+=`<div class="tlyear">${yr}</div>`; }
      html+=`<div class="tlrow">
        <span class="tldot" style="background:${TL_COLOR[e.type]}"></span>
        <span class="tlbadge" style="color:${TL_COLOR[e.type]};border-color:${TL_COLOR[e.type]}">${e.type}</span>
        <span class="tldate">${fmtDate(e.dt)}</span>
        <span class="tlmain"><b>${esc(e.label)}</b>${e.detail?`<span class="muted"> &middot; ${esc(e.detail)}</span>`:""}</span>
      </div>`;
    });
    listEl.innerHTML=html;
  }
  searchEl.oninput=draw; checks.forEach(c=>c.onchange=draw); draw();
}

SCREENS.timeline=renderTimeline;
