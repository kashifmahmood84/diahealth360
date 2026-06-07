// Immunizations — gold_fact_immunization. (No dedicated mock; matches the
// established screen layout.)

async function renderImmunizations(el){
  el.innerHTML=`<div class="loading">Loading immunizations\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT d.full_date dt, cd.display nm, i.status st, i.lot_number lot, i.route_code route
     FROM gold_fact_immunization i JOIN gold_dim_code cd ON cd.code_key=i.vaccine_code_key
     JOIN gold_dim_date d ON d.date_key=i.occurrence_date_key
     WHERE i.patient_key=? ORDER BY d.full_date DESC`,[pk]);

  const total=rows.length;
  const byName={}; rows.forEach(r=>{ const k=cleanCode(r.nm); byName[k]=(byName[k]||0)+1; });
  const byYear={}; rows.forEach(r=>{ const y=yearOf(r.dt); byYear[y]=(byYear[y]||0)+1; });
  const yrs=Object.keys(byYear).sort();
  const last=rows[0];

  const cards=statCards([
    {label:"Total Immunizations",value:fmt(total),sub:"All time",tip:"COUNT of gold_fact_immunization rows for this patient."},
    {label:"Distinct Vaccines",value:fmt(Object.keys(byName).length),sub:"",tip:"Distinct vaccine names (gold_dim_code.display via vaccine_code_key)."},
    {label:"Most Recent",value:last?fmtDate(last.dt):DASH,sub:last?cleanCode(last.nm).slice(0,22):"",tip:"Latest occurrence_date_key across this patient's immunizations (via gold_dim_date)."},
  ]);

  const palette=["#0d9488","#2563eb","#16a34a","#d97706","#9333ea","#dc2626","#0891b2","#db2777"];
  const segs=Object.entries(byName).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>({label:k.slice(0,26),value:v,color:palette[i%palette.length]}));
  const trend=yrs.map(y=>({dt:y+"-06-01",v:byYear[y]}));

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><div class="toolbar">
      <input class="search" id="imm-search" placeholder="Search vaccines\u2026">
    </div></div>
    <div class="cols">
      <div class="card">
        <table><thead><tr><th>Date</th><th>Vaccine</th><th>Status</th><th>Lot #</th><th>Route</th></tr></thead>
        <tbody id="imm-body">${rows.map(r=>`<tr class="immrow">
          <td>${fmtDate(r.dt)}</td><td><b>${esc(cleanCode(r.nm))}</b></td><td>${statusPill(r.st)}</td>
          <td class="muted">${esc(r.lot||DASH)}</td><td class="muted">${esc(r.route||DASH)}</td></tr>`).join("")
          ||`<tr><td colspan="5" class="empty">No immunizations recorded</td></tr>`}</tbody></table>
      </div>
      <div class="stack">
        <div class="card">${h3("By Vaccine","Share of doses grouped by vaccine name (gold_dim_code.display). Segments sum to total doses.")}${segs.length?chartBlock(donutSVG(segs,fmt(total),"Doses"),{type:"donut",title:"Immunizations by Vaccine",tip:"Share of doses grouped by vaccine name.",segments:segs,center:fmt(total),centerSub:"Doses"}):'<div class="empty">No data</div>'}</div>
        <div class="card">${h3("Yearly Trend","COUNT of immunizations per calendar year (occurrence_date_key via gold_dim_date).")}${trend.length?chartBlock(lineChartSVG(trend,"#0d9488",{w:360,h:170,yLabel:"Doses"}),{type:"line",title:"Immunizations by Year",tip:"COUNT of immunizations per calendar year.",points:trend,color:"#0d9488",yLabel:"Doses",timed:false}):'<div class="empty">No data</div>'}</div>
      </div>
    </div>
    ${footer()}`;

  const s=el.querySelector("#imm-search");
  s.oninput=()=>{ const t=s.value.toLowerCase();
    el.querySelectorAll("#imm-body .immrow").forEach(tr=>tr.style.display=(!t||tr.textContent.toLowerCase().includes(t))?"":"none"); };
}

SCREENS.immunizations=renderImmunizations;
