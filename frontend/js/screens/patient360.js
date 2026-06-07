// Patient 360 — mock layout + healthcare display standards + expandable charts.

async function renderPatient360(el){
  el.innerHTML=`<div class="loading">Loading patient 360\u2026</div>`;
  const pk=CURRENT_PK;

  const [p, summary, a1c, glucose, sbp, dbp, egfr, ldl, weight,
         gaps, conds, meds, keyLabs, encStats, journey] =
  await Promise.all([
    patientDetail(pk),
    patientSummary(pk),
    metricSeries("4548-4",pk), metricSeries("2345-7",pk),
    metricSeries("8480-6",pk), metricSeries("8462-4",pk),
    metricSeries("33914-3",pk), metricSeries("18262-6",pk), metricSeries("29463-7",pk),
    computeCareGaps(pk),
    q(`SELECT c.display nm, MIN(d.full_date) since FROM gold_fact_condition f
       JOIN gold_dim_code c ON c.code_key=f.condition_code_key
       LEFT JOIN gold_dim_date d ON d.date_key=f.onset_date_key
       WHERE f.patient_key=? AND f.is_active=1 GROUP BY c.display ORDER BY since LIMIT 5`,[pk]),
    q(`SELECT c.display nm, MAX(d.full_date) dt, m.status st FROM gold_fact_medication m
       JOIN gold_dim_code c ON c.code_key=m.medication_code_key
       JOIN gold_dim_date d ON d.date_key=m.authored_date_key
       WHERE m.patient_key=? AND m.medication_code_key IS NOT NULL AND LOWER(m.status)='active'
       GROUP BY c.display ORDER BY dt DESC LIMIT 5`,[pk]),
    Promise.all([
      ["eGFR","33914-3","mL/min/1.73m\u00B2",0],["Creatinine","2160-0","mg/dL",2],
      ["LDL","18262-6","mg/dL",0],["Triglycerides","2571-8","mg/dL",0],
    ].map(async ([lbl,code,unit,dec])=>{
      const pts=await metricSeries(code,pk);
      const last=pts[pts.length-1];
      return {lbl,code,unit,dec,pts,v:last&&last.v!=null?fmt(last.v,dec):DASH,dt:last&&last.dt};
    })),
    q(`SELECT f.encounter_class cls, COUNT(DISTINCT f.encounter_id) n
       FROM gold_fact_encounter f WHERE f.patient_key=? GROUP BY f.encounter_class`,[pk]),
    timelineEvents(pk,6),
  ]);

  if(!p){
    el.innerHTML=`<div class="card fatal"><h3 class="serif">Patient not found</h3><p>No current record for patient_key ${esc(pk)}.</p></div>`;
    return;
  }

  const last=(s)=>s[s.length-1];
  const la1c=last(a1c), lsbp=last(sbp), ldbp=last(dbp), legfr=last(egfr), lldl=last(ldl), lwt=last(weight);
  const bpVal=(lsbp&&ldbp&&lsbp.v!=null&&ldbp.v!=null)?`${fmt(lsbp.v,0)}/${fmt(ldbp.v,0)}`:DASH;
  const bpDt=lsbp&&lsbp.dt||ldbp&&ldbp.dt;

  const bpSeries=[
    {name:"Systolic (mmHg)",color:"#2563eb",dec:0,unit:"mmHg",points:sbp},
    {name:"Diastolic (mmHg)",color:"#6366f1",dec:0,unit:"mmHg",points:dbp},
  ].filter(s=>s.points.length>=2);
  const bpLineage=["gold_fact_observation","gold_dim_code LOINC 8480-6 (systolic) + 8462-4 (diastolic)",
    "gold_dim_date effective_date_key","value_numeric in mmHg","ref_range_low/high (null in this cohort)"];
  const bpChartSpec=bpSeries.length>1?{type:"multiline",title:"Blood Pressure Trend",
    tip:"Systolic LOINC 8480-6 and Diastolic LOINC 8462-4. "+PROV_NO_RANGE,series:bpSeries,timed:true,lineage:bpLineage}
    :bpSeries.length===1?{type:"line",title:"Blood Pressure Trend",tip:"LOINC 8480-6/8462-4. "+PROV_NO_RANGE,
      points:bpSeries[0].points,color:bpSeries[0].color,yLabel:"mmHg",timed:true,
      lineage:observationLineage(bpSeries[0].name.includes("Systolic")?"8480-6":"8462-4","BP")}:null;

  const vitals=[
    vitalSparkCard({label:"A1C",value:la1c&&la1c.v!=null?fmt(la1c.v,1):DASH,unit:"%",dt:la1c&&la1c.dt,series:a1c,color:"#0d9488",tip:METRIC_PROV["4548-4"],loinc:"4548-4"}),
    vitalSparkCard({label:"BP",value:bpVal,unit:"mmHg",dt:bpDt,series:sbp,color:"#2563eb",tip:"Systolic 8480-6 / Diastolic 8462-4. "+PROV_NO_RANGE,loinc:"8480-6 / 8462-4",chartSpec:bpChartSpec}),
    vitalSparkCard({label:"eGFR",value:legfr&&legfr.v!=null?fmt(legfr.v,0):DASH,unit:"mL/min/1.73m\u00B2",dt:legfr&&legfr.dt,series:egfr,color:"#16a34a",tip:METRIC_PROV["33914-3"],loinc:"33914-3"}),
    vitalSparkCard({label:"LDL",value:lldl&&lldl.v!=null?fmt(lldl.v,0):DASH,unit:"mg/dL",dt:lldl&&lldl.dt,series:ldl,color:"#9333ea",tip:METRIC_PROV["18262-6"],loinc:"18262-6"}),
    vitalSparkCard({label:"Weight",value:lwt&&lwt.v!=null?fmt(lwt.v,1):DASH,unit:"kg",dt:lwt&&lwt.dt,series:weight,color:"#d97706",tip:"LOINC 29463-7 body weight from gold_fact_observation.",loinc:"29463-7"}),
  ].join("");

  const trendSeries=[
    {name:"HbA1c (%)",color:"#0d9488",dec:1,unit:"%",points:a1c},
    {name:"Avg Glucose (mg/dL)",color:"#2563eb",dec:0,unit:"mg/dL",points:glucose},
    {name:"eGFR (mL/min)",color:"#16a34a",dec:0,unit:"mL/min",points:egfr},
    {name:"Systolic BP (mmHg)",color:"#9333ea",dec:0,unit:"mmHg",points:sbp},
    {name:"Weight (kg)",color:"#d97706",dec:1,unit:"kg",points:weight},
  ];
  const trendTip="Each panel: value_numeric over effective_date from gold_fact_observation for the labeled LOINC code. X = date, Y = value in clinical units. Reference ranges not in warehouse. Expand for range filter, metric toggles, and source data table.";

  const insights=[];
  if(la1c) insights.push(`Latest HbA1c <b>${fmt(la1c.v,1)}%</b> (LOINC 4548-4, ${fmtDate(la1c.dt)}).`);
  else insights.push("No HbA1c (LOINC 4548-4) on record.");
  if(legfr) insights.push(`eGFR <b>${fmt(legfr.v,0)}</b> mL/min/1.73m\u00B2 (LOINC 33914-3, ${fmtDate(legfr.dt)}).`);
  if(lsbp&&ldbp) insights.push(`Blood pressure <b>${bpVal}</b> mmHg (8480-6 / 8462-4).`);
  if(summary) insights.push(`<b>${summary.active_condition_count}</b> active conditions, <b>${summary.encounter_count}</b> encounters.`);

  const urgent=gaps.filter(g=>g.status==="Overdue");
  const medium=gaps.filter(g=>g.status==="Due");
  const low=gaps.filter(g=>g.status==="Up to date");

  function actionCol(title,items,kind){
    const cls=kind==="urgent"?"pa-red":kind==="med"?"pa-amber":"pa-green";
    return `<div class="p360-pa-col ${cls}">
      <div class="p360-pa-h">${esc(title)} <span class="pa-n">${items.length}</span></div>
      ${items.length?`<ul class="p360-pa-list">${items.map(g=>`<li>${esc(g.label.split(" (")[0])}</li>`).join("")}</ul>`
        :`<div class="p360-pa-none">None</div>`}
    </div>`;
  }

  const encMap=Object.fromEntries(encStats.map(r=>[r.cls||"OTHER",r.n]));
  const amb=encMap.AMB||0, hh=encMap.HH||0, inp=(encMap.IMP||0)+(encMap.ACUTE||0);
  const totalEnc=summary&&summary.encounter_count||encStats.reduce((a,r)=>a+r.n,0);
  const other=Math.max(0,totalEnc-amb-hh-inp);

  const utilData=[
    {label:"ER Visits",value:summary&&summary.ed_visit_count!=null?summary.ed_visit_count:0},
    {label:"Hospitalizations",value:summary&&summary.inpatient_count!=null?summary.inpatient_count:0},
    {label:"Ambulatory",value:amb},{label:"Home Health",value:hh},
  ];
  const utilChart=chartBlock(
    `<div class="p360-utilbars">${utilData.map(d=>`<div class="p360-utilbar"><span>${esc(d.label)}</span><span class="ub" style="width:${Math.max(4,d.value/Math.max(totalEnc,1)*100)}%"></span><b>${fmt(d.value)}</b></div>`).join("")}</div>`,
    {type:"bar",title:"Care Utilization",tip:"Counts from gold_agg_patient_summary and encounter_class.",data:utilData,color:"#0d9488",xLabel:"Category",yLabel:"Count",timed:false,
      lineage:["gold_agg_patient_summary (ed_visit_count, inpatient_count)","gold_fact_encounter GROUP BY encounter_class","Filter: patient_key"]}
  );

  const journeyHTML=journey.length?`<div class="p360-jline"></div>`+journey.slice().reverse().map(e=>{
    const ic=e.type==="Encounter"?"\u{1F3E5}":e.type==="Lab"?"\u{1F9EA}":e.type==="Document"?"\u{1F4C4}":"\u{1F4C5}";
    return `<div class="p360-jnode"><div class="p360-jdot"></div><div class="p360-jic">${ic}</div><div class="p360-jdt">${fmtDate(e.dt)}</div><div class="p360-jlbl">${esc(e.label)}</div></div>`;
  }).join(""):`<div class="muted p360-empty">No timeline events</div>`;

  const condCount=summary&&summary.active_condition_count||conds.length;
  const abnN=summary&&summary.abnormal_result_count!=null?summary.abnormal_result_count:0;

  function panelHead(title,tip,linkScreen,linkLabel="View all"){
    return `<div class="p360-ph">
      <h3>${esc(title)}${infoTip(tip)}</h3>
      ${linkScreen?`<a class="wlink" href="#" data-workspace="${esc(linkScreen)}">\u2192 ${esc(linkLabel)}</a>`:""}
    </div>`;
  }

  el.innerHTML=`
    <div class="p360">
      <section class="p360-vitals-wrap">
        <div class="p360-sechead">
          <h3 class="serif">Key Clinical Metrics ${infoTip(CLINICAL_STD_NOTE)}</h3>
          <p class="chartnote">Reference range shown per metric; hover \u29C9 for data lineage trail; click \u26F6 to expand.</p>
        </div>
        <div class="p360-vitals">${vitals}</div>
      </section>

      <section class="p360-panel p360-trends">
        ${panelHead("Clinical Trend Analytics",trendTip,"trends","Trends workspace")}
        ${chartBlock(multiLineSVG(trendSeries),{type:"multiline",title:"Clinical Trend Analytics",tip:trendTip,series:trendSeries,timed:true,
          lineage:["gold_fact_observation (LOINC-coded metrics)","gold_dim_code + gold_dim_date","value_numeric per series","ref_range_low/high (null in this cohort)"]})}
        <p class="chartnote">Small multiples with X/Y axes and reference labels. LOINC observations only; green band appears when warehouse has ref ranges.</p>
      </section>

      <section class="p360-mid">
        <div class="p360-panel">
          ${panelHead("Clinical Summary","Factual bullets from observations and summary counts. Not AI-generated.")}
          <ul class="p360-bullets">${insights.map(i=>`<li>${i}</li>`).join("")}</ul>
        </div>
        <div class="p360-panel">
          ${panelHead("Priority Actions","From care-gap recency vs screening intervals.")}
          <div class="p360-pa">${actionCol("Urgent",urgent,"urgent")}${actionCol("Medium",medium,"med")}${actionCol("Low",low,"low")}</div>
        </div>
      </section>

      <section class="p360-panel p360-journey">
        ${panelHead("Care Journey","Recent merged timeline events.","timeline","Full timeline")}
        <div class="p360-jwrap">
          <div class="p360-jtrack">${journeyHTML}</div>
          <div class="p360-jstats">
            <div class="p360-jstat"><span class="js-n">${fmt(totalEnc)}</span><span class="js-l">Encounters</span></div>
            <div class="p360-jstat"><span class="js-n">${fmt(amb)}</span><span class="js-l">Ambulatory</span></div>
            <div class="p360-jstat"><span class="js-n">${fmt(hh)}</span><span class="js-l">Home Health</span></div>
            <div class="p360-jstat"><span class="js-n">${fmt(inp)}</span><span class="js-l">Hospital</span></div>
            <div class="p360-jstat"><span class="js-n">${fmt(other)}</span><span class="js-l">Other</span></div>
          </div>
        </div>
      </section>

      <section class="p360-bottom">
        <div class="p360-panel">
          ${panelHead("Active Conditions","gold_fact_condition is_active=1.","complications")}
          <div class="p360-sub">${fmt(condCount)} active</div>
          ${conds.map(c=>`<div class="p360-row"><span>${esc(cleanCode(c.nm))}</span>${riskPill(null)}</div>`).join("")||`<div class="p360-empty">No active conditions</div>`}
        </div>
        <div class="p360-panel">
          ${panelHead("Medication Therapy","Active meds from gold_fact_medication.","medications")}
          <div class="p360-sub">${fmt(meds.length)} active</div>
          ${meds.map(m=>`<div class="p360-row"><span>${esc(cleanCode(m.nm))}</span>${statusPill(m.st)}</div>`).join("")||`<div class="p360-empty">No active medications</div>`}
          <div class="p360-note muted">Interactions &amp; renewals not in warehouse.</div>
        </div>
        <div class="p360-panel">
          ${panelHead("Laboratory Results","LOINC-coded labs; expand mini-charts for full trend.","labs")}
          ${keyLabs.map(l=>labResultRow(l.lbl,l.code,l.unit,l.v,l.dt,l.pts,l.dec)).join("")||`<div class="p360-empty">No labs</div>`}
          <div class="p360-note muted">${fmt(abnN)} abnormal flags in warehouse (is_abnormal column)</div>
        </div>
        <div class="p360-panel">
          ${panelHead("Care Utilization","Encounter and utilization counts.","encounters")}
          ${utilChart}
        </div>
      </section>
    </div>
    ${footer()}`;
}

SCREENS.patient360=renderPatient360;
