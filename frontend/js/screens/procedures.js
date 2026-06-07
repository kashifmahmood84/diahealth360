// Procedures — gold_fact_procedure. Encounter class via encounter_id, reason via
// gold_dim_code (reason_code).

async function renderProcedures(el){
  el.innerHTML=`<div class="loading">Loading procedures\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT d.full_date dt, cd.display nm, p.status st,
       rcd.display reason, e.encounter_class cls
     FROM gold_fact_procedure p
     JOIN gold_dim_code cd ON cd.code_key=p.procedure_code_key
     JOIN gold_dim_date d ON d.date_key=p.performed_date_key
     LEFT JOIN gold_dim_code rcd ON rcd.code=p.reason_code
     LEFT JOIN gold_fact_encounter e ON e.encounter_id=p.encounter_id
     WHERE p.patient_key=? ORDER BY d.full_date DESC`,[pk]);

  const total=rows.length;
  const byName={}; rows.forEach(r=>{ byName[r.nm]=(byName[r.nm]||0)+1; });
  const topName=Object.entries(byName).sort((a,b)=>b[1]-a[1])[0];
  const byYear={}; rows.forEach(r=>{ const y=yearOf(r.dt); byYear[y]=(byYear[y]||0)+1; });
  const yearsSorted=Object.keys(byYear).sort();
  const recentYear=yearsSorted[yearsSorted.length-1];

  const cards=statCards([
    {label:"Total Procedures",value:fmt(total),sub:"All time",tip:"COUNT of gold_fact_procedure rows for this patient."},
    {label:"Most Recent Year",value:fmt(byYear[recentYear]||0),sub:recentYear||"",tip:"Procedure count in the latest calendar year present (performed_date_key via gold_dim_date)."},
    {label:"Most Common",value:`<span class="serif" style="font-size:16px">${esc(topName?cleanCode(topName[0]).slice(0,22):DASH)}</span>`,
      sub:topName?`${fmt(topName[1])} (${Math.round(topName[1]/total*100)}%)`:"",tip:"Highest-frequency procedure by gold_dim_code.display (dialysis dominates this cohort \u2014 that is real)."},
  ]);

  const freq=Object.entries(byName).sort((a,b)=>b[1]-a[1]).slice(0,10)
    .map(([nm,n])=>({label:cleanCode(nm).slice(0,30),value:n,pct:Math.round(n/total*100)}));
  const trend=yearsSorted.map(y=>({dt:y+"-06-01",v:byYear[y]}));

  const typeOptions=`<option value="">All Types</option>`+Object.keys(byName).sort()
    .map(n=>`<option value="${esc(cleanCode(n))}">${esc(cleanCode(n))}</option>`).join("");

  const shown=rows.slice(0,500);
  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><div class="toolbar">
      <select id="proc-type" class="select">${typeOptions}</select>
      <input class="search" id="proc-search" placeholder="Search procedures\u2026">
      <span class="muted" style="margin-left:auto">Showing ${shown.length} of ${fmt(total)} procedures</span>
    </div></div>
    <div class="cols">
      <div class="card">${h3("Procedure Records","Source: gold_fact_procedure \u2192 gold_dim_code (name), gold_dim_date (performed). Encounter = encounter_class of the linked encounter (encounter_id \u2192 gold_fact_encounter). Reason = reason_code resolved via gold_dim_code (often null \u2192 \u2014).")}<div class="scrollbox">
        <table><thead><tr><th>Date</th><th>Procedure</th><th>Status</th><th>Encounter</th><th>Reason</th></tr></thead>
        <tbody id="proc-body">${shown.map(r=>`<tr class="procrow" data-nm="${esc(cleanCode(r.nm))}">
          <td>${fmtDate(r.dt)}</td><td><b>${esc(cleanCode(r.nm))}</b></td><td>${statusPill(r.st)}</td>
          <td>${esc(ENC_CLASS[r.cls]||r.cls||DASH)}</td><td class="muted">${esc(r.reason?cleanCode(r.reason):DASH)}</td></tr>`).join("")
          ||`<tr><td colspan="5" class="empty">No procedures</td></tr>`}</tbody></table>
      </div></div>
      <div class="stack">
        <div class="card">${h3("Procedure Frequency","COUNT of procedures grouped by gold_dim_code.display, top 10. Percentage is of this patient's total procedures.")}<p class="cardsub">Top procedures by count</p>${chartBlock(hbarsSVG(freq),{type:"hbars",title:"Procedure Frequency",tip:"COUNT of procedures grouped by name, top 10.",data:freq,color:"#0d9488",xLabel:"Procedure",yLabel:"Count"})}</div>
        <div class="card">${h3("Yearly Trend","COUNT of procedures per calendar year (performed_date_key via gold_dim_date). X axis = year, Y axis = count.")}<p class="cardsub">Procedures by year</p>${chartBlock(lineChartSVG(trend,"#0d9488",{w:380,h:180,yLabel:"Procedures"}),{type:"line",title:"Procedures by Year",tip:"COUNT of procedures per calendar year.",points:trend,color:"#0d9488",yLabel:"Procedures",timed:false})}</div>
      </div>
    </div>
    ${footer()}`;

  const tSel=el.querySelector("#proc-type"), srch=el.querySelector("#proc-search");
  function flt(){ const tv=tSel.value, t=srch.value.toLowerCase();
    el.querySelectorAll("#proc-body .procrow").forEach(tr=>{
      const okT=!tv||tr.dataset.nm===tv, okS=!t||tr.dataset.nm.toLowerCase().includes(t);
      tr.style.display=(okT&&okS)?"":"none"; }); }
  tSel.onchange=flt; srch.oninput=flt;
}

SCREENS.procedures=renderProcedures;
