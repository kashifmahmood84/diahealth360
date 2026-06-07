// Allergies — gold_fact_allergy (sparse; empty states are normal/expected).

async function renderAllergies(el){
  el.innerHTML=`<div class="loading">Loading allergies\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT cd.display nm, a.type typ, a.category cat, a.criticality crit,
       a.reaction_manifestation react, a.reaction_severity sev, a.clinical_status cs, d.full_date dt
     FROM gold_fact_allergy a JOIN gold_dim_code cd ON cd.code_key=a.allergy_code_key
     LEFT JOIN gold_dim_date d ON d.date_key=a.recorded_date_key
     WHERE a.patient_key=? ORDER BY d.full_date DESC`,[pk]);

  const active=rows.filter(r=>(r.cs||"").toLowerCase()==="active"||!r.cs).length || rows.length;
  const counts={High:0,Moderate:0,Low:0,Unknown:0};
  rows.forEach(r=>{ const c=(r.crit||"").toLowerCase();
    if(c==="high") counts.High++; else if(c==="moderate"||c==="medium") counts.Moderate++;
    else if(c==="low") counts.Low++; else counts.Unknown++; });
  const last=rows[0];

  const cards=statCards([
    {label:"Active Allergies",value:fmt(rows.length),sub:rows.length?"":"None",tip:"COUNT of gold_fact_allergy rows for this patient (joined to gold_dim_code for the allergen)."},
    {label:"Criticality High",value:fmt(counts.High),sub:counts.High?"":"None",tip:"Rows where criticality='high' in gold_fact_allergy."},
    {label:"Last Recorded",value:last&&last.dt?fmtDate(last.dt):DASH,sub:last?"":"None",tip:"Latest recorded_date_key across this patient's allergy rows (via gold_dim_date)."},
  ]);

  const tableOrEmpty = rows.length
    ? `<div class="card">${tableHTML(
        ["Allergen","Type","Category","Criticality","Reaction","Severity","Recorded"],
        rows.map(r=>[`<b>${esc(cleanCode(r.nm))}</b>`,esc(r.typ||DASH),esc(r.cat||DASH),
          esc(r.crit||DASH),esc(r.react||DASH),esc(r.sev||DASH),fmtDate(r.dt)]),{})}</div>`
    : `<div class="card">${emptyCard("No known allergies recorded",
        "There are no allergy records for this patient in the system. If new allergy information becomes available, it will appear here.","\u{1F6E1}")}
        <div style="text-align:center;margin-top:10px"><button class="btn" disabled title="Coming soon">+ Add Allergy</button></div></div>`;

  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const critColors={High:"#dc2626",Moderate:"#d97706",Low:"#eab308",Unknown:"#9aa7b1"};

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="cols">
      ${tableOrEmpty}
      <div class="stack">
        <div class="card">${h3("Allergy Criticality Summary","Counts of gold_fact_allergy rows grouped by criticality (high / moderate / low / unknown) for this patient.")}
          ${Object.entries(counts).map(([k,v])=>`<div class="crow">
            <span class="dot" style="background:${critColors[k]}"></span>
            <span style="flex:1">${k}</span>
            <b>${v}</b> <span class="muted">(${total?Math.round(v/total*100):0}%)</span></div>`).join("")}
          <div class="kv" style="margin-top:8px"><span class="kvk">Total Active Allergies</span><span class="kvv"><b>${rows.length}</b></span></div>
        </div>
        <div class="card">${h3("About Allergy Data","Context note about allergy sparsity in this dataset \u2014 not patient-specific data.")}
          <p class="cardsub">Allergy documentation is often sparse in real-world datasets. In this dataset there are only 19 allergy records across the cohort of 25 patients. Continue to review with caution and update as new information becomes available.</p>
        </div>
      </div>
    </div>
    ${footer()}`;
}

SCREENS.allergies=renderAllergies;
