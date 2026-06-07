// Encounters — gold_fact_encounter. Provider & Organization columns have no schema
// link for encounters, shown as "\u2014".

function losText(min, isInp){
  if(min==null||min<=0) return DASH;
  if(min<1440) return `${Math.round(min/60)} hrs`;
  return `${Math.round(min/1440)} days`;
}

async function renderEncounters(el){
  el.innerHTML=`<div class="loading">Loading encounters\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT d.full_date dt, f.encounter_class cls, f.encounter_type typ,
       f.length_of_stay_minutes los, f.is_emergency em, f.is_inpatient inp
     FROM gold_fact_encounter f JOIN gold_dim_date d ON d.date_key=f.admit_date_key
     WHERE f.patient_key=? GROUP BY f.encounter_id ORDER BY dt DESC`,[pk]);

  const total=rows.length;
  const ed=rows.filter(r=>r.em).length, inp=rows.filter(r=>r.inp).length;
  const years=[...new Set(rows.map(r=>+yearOf(r.dt)))];
  const avgYear=years.length?(total/years.length):0;

  const cards=statCards([
    {label:"Total Encounters",value:fmt(total),sub:"All time",tip:"Distinct encounter_id count in gold_fact_encounter for this patient."},
    {label:"ED Visits",value:fmt(ed),sub:"All time",tip:"Encounters where is_emergency=1 in gold_fact_encounter."},
    {label:"Inpatient",value:fmt(inp),sub:"All time",tip:"Encounters where is_inpatient=1 in gold_fact_encounter."},
    {label:"Avg / Year",value:fmt(avgYear,1),sub:"Per year",tip:"Total encounters \u00F7 number of distinct calendar years that have encounters."},
  ]);

  // volume by year
  const byYear={}; rows.forEach(r=>{ const y=yearOf(r.dt); byYear[y]=(byYear[y]||0)+1; });
  const volData=Object.keys(byYear).sort().map(y=>({label:y,value:byYear[y]}));

  // class breakdown
  const byClass={}; rows.forEach(r=>{ const k=ENC_CLASS[r.cls]||r.cls||"Other"; byClass[k]=(byClass[k]||0)+1; });
  const palette=["#0d9488","#dc2626","#9333ea","#2563eb","#d97706","#16a34a"];
  const segs=Object.keys(byClass).map((k,i)=>({label:k,value:byClass[k],color:palette[i%palette.length]}));

  const classOptions=`<option value="">All Classes</option>`+Object.keys(byClass).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join("");

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><div class="toolbar">
      <select id="enc-class" class="select">${classOptions}</select>
      <input class="search" id="enc-search" placeholder="Search type\u2026">
      <span class="muted" style="margin-left:auto">Provider/organization not linked at encounter level in this dataset.</span>
    </div></div>
    <div class="cols">
      <div class="card">
        <table><thead><tr><th>Date</th><th>Class</th><th>Type</th><th>Provider ${infoTip("gold_fact_encounter has no provider reference, so this is \u2014.")}</th><th>Organization ${infoTip("service_provider_org_key is null for all encounter rows, so this is \u2014.")}</th><th>Length of Stay ${infoTip("Derived from length_of_stay_minutes: shown in hours (<1 day) or days.")}</th></tr></thead>
        <tbody id="enc-body">${rows.map(r=>`<tr class="encrow" data-cls="${esc(ENC_CLASS[r.cls]||r.cls||"")}">
          <td>${fmtDate(r.dt)}</td><td>${pill(ENC_CLASS[r.cls]||r.cls||DASH, r.em?"tr":r.inp?"ta":"")}</td>
          <td>${esc(cleanCode(r.typ||DASH))}</td><td class="muted">${DASH}</td><td class="muted">${DASH}</td>
          <td>${losText(r.los,r.inp)}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">No encounters</td></tr>`}</tbody></table>
      </div>
      <div class="stack">
        <div class="card">${h3("Encounter Volume","COUNT of encounters grouped by calendar year (admit_date_key via gold_dim_date). X axis = year, Y axis = number of encounters.")}<p class="cardsub">Encounters by year</p>${chartBlock(barChartSVG(volData,"#0d9488",{yLabel:"Encounters"}),{type:"bar",title:"Encounter Volume by Year",tip:"COUNT of encounters grouped by calendar year.",data:volData,color:"#0d9488",xLabel:"Year",yLabel:"Encounters"})}</div>
        <div class="card">${h3("Encounter Class Breakdown","Share of encounters by encounter_class (FHIR ActCode mapped to readable labels). Segments sum to the total encounter count.")}${chartBlock(donutSVG(segs,fmt(total),"Total"),{type:"donut",title:"Encounter Class Breakdown",tip:"Share of encounters by encounter_class.",segments:segs,center:fmt(total),centerSub:"Total"})}</div>
      </div>
    </div>
    ${footer()}`;

  const clsSel=el.querySelector("#enc-class"), srch=el.querySelector("#enc-search");
  function flt(){ const cv=clsSel.value, t=srch.value.toLowerCase();
    el.querySelectorAll("#enc-body .encrow").forEach(tr=>{
      const okC=!cv||tr.dataset.cls===cv, okT=!t||tr.textContent.toLowerCase().includes(t);
      tr.style.display=(okC&&okT)?"":"none"; }); }
  clsSel.onchange=flt; srch.oninput=flt;
}

SCREENS.encounters=renderEncounters;
