// Portal Dashboard — cohort KPIs only; patient selection lives on Patients screen.

async function safeCount(sql, params=[]){
  try{
    const rows=await q(sql,params);
    return rows[0]&&rows[0].n!=null?rows[0].n:0;
  }catch(e){
    console.error("dashboard query failed:",e.message);
    return null;
  }
}

async function renderDashboard(el){
  el.innerHTML=`<div class="loading">Loading dashboard\u2026</div>`;
  const total=PATIENTS.length;
  const [encN,cpN]=await Promise.all([
    safeCount(`SELECT COUNT(DISTINCT f.encounter_id) n FROM gold_fact_encounter f
       JOIN gold_dim_date d ON d.date_key=f.admit_date_key
       WHERE d.year=(SELECT MAX(d2.year) FROM gold_dim_date d2
         WHERE d2.date_key IN (SELECT admit_date_key FROM gold_fact_encounter))`),
    safeCount(`SELECT COUNT(*) n FROM gold_fact_careplan WHERE status='active'`),
  ]);

  el.innerHTML=`
    <div class="kpirow kpirow-5">${statCards([
      {label:"Total Patients",value:fmt(total),sub:"In cohort",tip:"COUNT of gold_dim_patient where is_current=1."},
      {label:"Active Care Plans",value:cpN==null?DASH:fmt(cpN),sub:"Across cohort",tip:"COUNT of gold_fact_careplan rows with status='active'."},
      {label:"Open Care Gaps",value:DASH,sub:"Cohort rollup pending",tip:"Cohort-level care-gap aggregation is not implemented yet."},
      {label:"Abnormal Results",value:DASH,sub:"Not in dataset",tip:"is_abnormal is 0 for all observation rows \u2014 cannot derive honestly."},
      {label:"Encounters This Year",value:encN==null?DASH:fmt(encN),sub:"Latest year in data",tip:"Distinct encounter_id count in the latest calendar year present."},
    ])}</div>
    <div class="cols">
      <div class="card dash-cta">
        <div class="dash-cta-ic">\u{1F465}</div>
        <div>
          <h3 class="serif">Patient Directory</h3>
          <p class="cardsub">Search ${fmt(total)} patients by name or MRN, then open a clinical workspace.</p>
          <button class="btn pri" onclick="navigatePortal('patients')">Open Patients \u2192</button>
        </div>
      </div>
      <div class="card dash-cta">
        <div class="dash-cta-ic">\u{1F4CA}</div>
        <div>
          <h3 class="serif">Population Analytics</h3>
          <p class="cardsub">Descriptive cohort demographics and glycemic control bands.</p>
          <button class="btn" onclick="navigatePortal('population')">View Population \u2192</button>
        </div>
      </div>
    </div>
    ${footer()}`;
}

SCREENS.dashboard=renderDashboard;
