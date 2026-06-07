// Complications — risk UI (Low / Medium / High) is shown on every domain;
// computeComplicationRisk() is a stub until the clinical model is wired.
// Supporting observations and conditions are real warehouse data.

async function renderComplications(el){
  el.innerHTML=`<div class="loading">Loading complications\u2026</div>`;
  const pk=CURRENT_PK;

  const codes={egfr:"33914-3",creat:"2160-0",bun:"3094-0",uacr:"14959-1",a1c:"4548-4",
    ldl:"18262-6",hdl:"2085-9",trig:"2571-8",sbp:"8480-6",dbp:"8462-4"};
  const latest={};
  await Promise.all(Object.entries(codes).map(async ([k,c])=>{ latest[k]=await latestMetric(c); }));
  const [conds, creatSeries, eyeExam, footExam] = await Promise.all([
    q(`SELECT c.display nm, MIN(d.full_date) onset FROM gold_fact_condition f
       JOIN gold_dim_code c ON c.code_key=f.condition_code_key
       LEFT JOIN gold_dim_date d ON d.date_key=f.onset_date_key
       WHERE f.patient_key=? AND f.is_active=1 GROUP BY c.display ORDER BY onset`,[pk]),
    metricSeries("2160-0"),
    q(`SELECT MAX(d.full_date) dt FROM gold_fact_procedure p JOIN gold_dim_code cd ON cd.code_key=p.procedure_code_key
       JOIN gold_dim_date d ON d.date_key=p.performed_date_key
       WHERE p.patient_key=? AND (cd.display LIKE '%retina%' OR cd.display LIKE '%ophthalmic%' OR cd.display LIKE '%eye%')`,[pk]),
    q(`SELECT MAX(d.full_date) dt FROM gold_fact_procedure p JOIN gold_dim_code cd ON cd.code_key=p.procedure_code_key
       JOIN gold_dim_date d ON d.date_key=p.performed_date_key WHERE p.patient_key=? AND cd.display LIKE '%foot%'`,[pk]),
  ]);

  const cl=conds.map(c=>({nm:c.nm,lo:c.nm.toLowerCase(),onset:c.onset}));
  const find=(...kw)=>cl.filter(c=>kw.some(k=>c.lo.includes(k)));
  const mv=(m,dec,unit)=>m&&m.v!=null?`${fmt(m.v,dec)} ${unit}`:DASH;
  const mdate=m=>m&&m.dt?`(${fmtDate(m.dt)})`:"";

  const comps=[
    {key:"kidney",icon:"\u{1F9A0}",name:"Kidney (Diabetic Kidney Disease)",
      rule:"Rule-based risk from eGFR / creatinine / UACR + documented kidney conditions (model pending)",
      related:find("kidney","renal","nephropathy","ckd"),
      evidence:[["CKD Stage (KDIGO)",DASH,"(pending risk model)"],
                ["eGFR",mv(latest.egfr,0,"mL/min/1.73m\u00B2"),mdate(latest.egfr)],
                ["Creatinine",mv(latest.creat,2,"mg/dL"),mdate(latest.creat)],
                ["BUN",mv(latest.bun,0,"mg/dL"),mdate(latest.bun)],
                ["Urine Alb/Creat",mv(latest.uacr,0,"mg/g"),mdate(latest.uacr)]],
      chart:creatSeries},
    {key:"retina",icon:"\u{1F441}",name:"Retinopathy (Diabetic Retinopathy)",
      rule:"Derived from documented retinopathy conditions + eye-exam recency",
      related:find("retinopathy","retinal"),
      evidence:[["Last Eye Exam",eyeExam[0]&&eyeExam[0].dt?fmtDate(eyeExam[0].dt):"None on record",""]]},
    {key:"neuro",icon:"\u26A1",name:"Neuropathy (Diabetic Peripheral Neuropathy)",
      rule:"Derived from documented neuropathy conditions",
      related:find("neuropathy"),evidence:[]},
    {key:"cv",icon:"\u2764",name:"Cardiovascular (ASCVD)",
      rule:"Derived from documented CV conditions + lipids + blood pressure",
      related:find("hypertens","hyperlipidemia","cardiovascular","coronary","ischemic","heart","lipidemia"),
      evidence:[["Blood Pressure",latest.sbp&&latest.dbp?`${fmt(latest.sbp.v,0)}/${fmt(latest.dbp.v,0)} mmHg`:DASH,mdate(latest.sbp)],
                ["LDL-C",mv(latest.ldl,0,"mg/dL"),mdate(latest.ldl)],
                ["HDL-C",mv(latest.hdl,0,"mg/dL"),mdate(latest.hdl)],
                ["Triglycerides",mv(latest.trig,0,"mg/dL"),mdate(latest.trig)]]},
    {key:"foot",icon:"\u{1F9B6}",name:"Foot (Diabetic Foot)",
      rule:"Derived from documented foot conditions + foot-exam recency",
      related:find("foot ulcer","diabetic foot","ulcer of","foot"),
      evidence:[["Last Foot Exam",footExam[0]&&footExam[0].dt?fmtDate(footExam[0].dt):"None on record",""]]},
  ];

  const riskCtx={latest,condList:cl};
  const strip=RISK_DOMAINS.map(d=>{
    const level=computeComplicationRisk(d.key,riskCtx);
    return `<div class="cstrip">
      <div class="cico">${d.icon}</div>
      <div class="csname">${esc(d.short)}</div>
      ${riskPill(level)}
    </div>`;}).join("")+
    `<div class="cstrip"><div class="cico">\u{1F6E1}</div><div class="csname">Conditions on file</div>${pill(String(cl.length),"")}</div>`;

  const cards=comps.map(c=>{
    const level=computeComplicationRisk(c.key,riskCtx);
    const doc=c.related.length>0;
    return `<div class="card compcard">
      <div class="comphead"><span class="cico">${c.icon}</span>
        <span class="compname">${esc(c.name)} ${riskPill(level)}${doc?`<span class="muted docflag">condition documented</span>`:""}</span>
      </div>
      <p class="cardsub">${esc(c.rule)}</p>
      <div class="compbody">
        <div class="compev">
          ${c.evidence.map(([k,v,d])=>`<div class="kv"><span class="kvk">${esc(k)}</span><span class="kvv">${esc(v)} <span class="muted">${esc(d||"")}</span></span></div>`).join("")||'<div class="muted">No quantitative evidence in dataset.</div>'}
        </div>
        ${c.chart?`<div class="compchart"><div class="cardsub">Creatinine trend (mg/dL)</div>${chartBlock(lineChartSVG(c.chart,"#0d9488",{w:300,h:120,refRange:latestRefRange(c.chart)}),{type:"line",title:"Creatinine Trend",tip:"value_numeric over effective_date from gold_fact_observation (LOINC 2160-0).",points:c.chart,color:"#0d9488",yLabel:"Creatinine (mg/dL)",loinc:"2160-0",lineage:observationLineage("2160-0","Creatinine")})}</div>`:""}
        <div class="comprel">
          <div class="cardsub">Related conditions</div>
          ${c.related.length?c.related.map(r=>`<div class="muted">\u2022 ${esc(cleanCode(r.nm))}</div>`).join(""):'<div class="muted">None documented</div>'}
        </div>
      </div>
    </div>`;}).join("");

  // related labs (most recent)
  const labList=[["eGFR (CKD-EPI)",latest.egfr,0,"mL/min/1.73m\u00B2"],["Creatinine",latest.creat,2,"mg/dL"],
    ["UACR",latest.uacr,0,"mg/g"],["Hemoglobin A1c",latest.a1c,1,"%"],["LDL Cholesterol",latest.ldl,0,"mg/dL"],
    ["HDL Cholesterol",latest.hdl,0,"mg/dL"],["Triglycerides",latest.trig,0,"mg/dL"]];

  el.innerHTML=`
    ${await compactHeader("")}
    <div class="compstrip">${strip}</div>
    <div class="card pagehead"><h2 class="serif">Complication Risk ${infoTip(RISK_PENDING_TIP)}</h2>
      <p class="cardsub">Low / Medium / High risk levels will be computed by a rule-based clinical model. Levels show \u2014 until that model is enabled. Supporting values are the most recent observations in the record.</p>
    </div>
    <div class="cols">
      <div class="stack">${cards}</div>
      <div class="stack">
        <div class="card">${h3("Related Conditions","All active rows from gold_fact_condition (is_active=1) with earliest onset date \u2014 the evidence base for the complication statuses above.")}
          ${cl.length?cl.map(c=>`<div class="kv"><span class="kvv">${esc(cleanCode(c.nm))}</span><span class="muted">${fmtDate(c.onset)}</span></div>`).join(""):'<div class="empty">None</div>'}
        </div>
        <div class="card">${h3("Related Labs (Most Recent)","Most recent value per relevant LOINC from gold_fact_observation (eGFR, creatinine, UACR, HbA1c, LDL, HDL, triglycerides). Values shown as-is; no abnormal flagging.")}
          ${tableHTML(["Lab","Result","Date"],labList.map(([nm,m,dec,u])=>[esc(nm),
            m&&m.v!=null?`<b>${fmt(m.v,dec)}</b> <span class="muted">${esc(u)}</span>`:DASH, m&&m.dt?fmtDate(m.dt):DASH]),{empty:"None"})}
        </div>
      </div>
    </div>
    ${footer()}`;
}

SCREENS.complications=renderComplications;
