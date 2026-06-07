// Labs — grouped by panel. Reference Range & Status columns show "\u2014" because the
// warehouse has no reference ranges / abnormal flags (project decision).

async function renderLabs(el){
  el.innerHTML=`<div class="loading">Loading labs\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT cd.code code, cd.display nm, o.value_numeric v, o.value_unit u, d.full_date dt
     FROM gold_fact_observation o JOIN gold_dim_code cd ON cd.code_key=o.observation_code_key
     JOIN gold_dim_date d ON d.date_key=o.effective_date_key
     WHERE o.patient_key=? AND o.observation_category='laboratory' AND o.value_numeric IS NOT NULL
     ORDER BY d.full_date`,[pk]);

  // group by code
  const byCode={};
  rows.forEach(r=>{ (byCode[r.code]=byCode[r.code]||{code:r.code,nm:r.nm,u:r.u,series:[]}).series.push({dt:r.dt,v:r.v}); });
  const codes=Object.values(byCode);
  codes.forEach(c=>{ c.latest=c.series[c.series.length-1]; c.prev=c.series[c.series.length-2];
    c.panel=(LAB_PANELS[c.code]||[c.code.startsWith("5")?"Urinalysis":"Other Labs"])[0];
    c.short=(LAB_PANELS[c.code]||[null,cleanCode(c.nm)])[1]; });

  const lastDrawn=rows.length?rows[rows.length-1].dt:null;
  const panelsPresent=[...new Set(codes.map(c=>c.panel))];

  const cards=statCards([
    {label:"Total Results",value:fmt(rows.length),sub:"All time",tip:"COUNT of gold_fact_observation rows where observation_category='laboratory' and value_numeric is not null, for this patient."},
    {label:"Abnormal Count",value:DASH,sub:"Not recorded",tip:"Not available: is_abnormal=0 and interpretation is null for every row in the warehouse, so abnormal counts cannot be derived honestly."},
    {label:"Last Drawn",value:lastDrawn?fmtDate(lastDrawn):DASH,sub:"",tip:"Most recent effective_date across this patient's laboratory observations (via gold_dim_date)."},
    {label:"Panels",value:fmt(panelsPresent.length),sub:"Available",tip:"Number of distinct lab panels present after grouping each test's LOINC code into a panel (Metabolic, Lipid, Liver, Hematology, Diabetes & Renal, Urinalysis)."},
  ]);

  const trendArrow=c=>{ if(!c.prev) return `<span class="muted">${DASH}</span>`;
    const d=c.latest.v-c.prev.v; if(Math.abs(d)<1e-9) return `<span class="muted">\u2192</span>`;
    return d>0?`<span style="color:#dc2626">\u2191</span>`:`<span style="color:#16a34a">\u2193</span>`; };

  let tableBody="";
  LAB_PANEL_ORDER.forEach(panel=>{
    const grp=codes.filter(c=>c.panel===panel).sort((a,b)=>a.short.localeCompare(b.short));
    if(!grp.length) return;
    tableBody+=`<tr class="grouprow"><td colspan="6">${esc(panel)} <span class="muted">${grp.length} results</span></td></tr>`;
    grp.forEach(c=>{ tableBody+=`<tr class="labrow" data-code="${c.code}">
      <td><b>${esc(c.short)}</b></td>
      <td style="text-align:right"><b>${fmt(c.latest.v,c.latest.v>=100?0:2)}</b></td>
      <td>${esc(c.u||DASH)}</td>
      <td class="muted">${DASH}</td>
      <td class="muted">${DASH}</td>
      <td>${fmtDate(c.latest.dt)} <span class="trend">${trendArrow(c)}</span></td>
    </tr>`; });
  });

  const selOptions=codes.map(c=>`<option value="${c.code}">${esc(c.short)}</option>`).join("");

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead">
      <div class="toolbar">
        <input class="search" id="lab-search" placeholder="Search tests\u2026">
        <span class="muted" style="margin-left:auto">Reference ranges & abnormal flags are not available in this dataset.</span>
      </div>
    </div>
    <div class="cols">
      <div class="card">
        <table class="labtable"><thead><tr>
          <th>Test</th><th style="text-align:right">Value</th><th>Unit</th><th>Reference Range ${infoTip("ref_range_low / ref_range_high are null for all rows in the warehouse \u2014 no reference ranges to show.")}</th><th>Status ${infoTip("is_abnormal=0 / interpretation null for all rows \u2014 abnormal status is not available, shown as \u2014 instead of fabricated.")}</th><th>Date / Trend ${infoTip("Arrow compares the latest value to the previous one for the same test (\u2191 higher, \u2193 lower, \u2192 unchanged).")}</th>
        </tr></thead><tbody id="lab-body">${tableBody||`<tr><td colspan="6" class="empty">No lab results</td></tr>`}</tbody></table>
      </div>
      <div class="card">
        ${h3("Selected Lab Trend","Full value_numeric history for the chosen test from gold_fact_observation, joined to gold_dim_date. X axis = collection date, Y axis = value in the test's units. Hover a point for the exact value/date.")}
        <select id="lab-sel" class="select">${selOptions}</select>
        <div id="lab-trend"></div>
        <div id="lab-readings"></div>
      </div>
    </div>
    ${footer()}`;

  const sel=el.querySelector("#lab-sel"), trendEl=el.querySelector("#lab-trend"), readEl=el.querySelector("#lab-readings");
  function drawTrend(){
    const c=byCode[sel.value]; if(!c){ trendEl.innerHTML=`<div class="empty">No data</div>`; readEl.innerHTML=""; return; }
    trendEl.innerHTML=chartBlock(lineChartSVG(c.series,"#0d9488",{w:380,h:180,refRange:latestRefRange(c.series)}),
      {type:"line",title:c.short+" \u2014 Trend",tip:"Full value_numeric history for this test from gold_fact_observation, by effective_date.",points:c.series,color:"#0d9488",
        yLabel:(c.short||"Value")+(c.u?" ("+c.u+")":""),loinc:c.code,unit:c.u,lineage:observationLineage(c.code,c.short)});
    const recent=c.series.slice(-8).reverse();
    readEl.innerHTML=`<table><thead><tr><th>Date</th><th style="text-align:right">Value</th></tr></thead><tbody>
      ${recent.map(r=>`<tr><td>${fmtDate(r.dt)}</td><td style="text-align:right"><b>${fmt(r.v,r.v>=100?0:2)}</b> <span class="muted">${esc(c.u||"")}</span></td></tr>`).join("")}
    </tbody></table>`;
  }
  if(codes.find(c=>c.code==="4548-4")) sel.value="4548-4";
  sel.onchange=drawTrend; drawTrend();

  const searchEl=el.querySelector("#lab-search");
  searchEl.oninput=()=>{ const t=searchEl.value.toLowerCase();
    el.querySelectorAll("#lab-body .labrow").forEach(r=>{
      const c=byCode[r.dataset.code]; r.style.display=(!t||c.short.toLowerCase().includes(t))?"":"none"; });
    el.querySelectorAll("#lab-body .grouprow").forEach(g=>g.style.display=t?"none":"");
  };
}

SCREENS.labs=renderLabs;
