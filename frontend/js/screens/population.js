// Portal Population (P3) — descriptive cohort stats (stub shell; charts pending).

async function renderPopulation(el){
  el.innerHTML=`<div class="loading">Loading population\u2026</div>`;
  const summ=await q(`SELECT COUNT(*) n, AVG(latest_hba1c) avg_a1c FROM gold_agg_patient_summary`,[]);
  const s=summ[0]||{};
  el.innerHTML=`
    <div class="portalhead"><h1 class="serif">Population</h1>
      <p class="cardsub">Descriptive cohort statistics \u2014 not predictive models.</p></div>
    <div class="kpirow">${statCards([
      {label:"Patients",value:fmt(PATIENTS.length),sub:"In cohort"},
      {label:"Cohort avg HbA1c",value:s.avg_a1c!=null?fmt(s.avg_a1c,1)+"%":DASH,sub:"From gold_agg_patient_summary"},
    ])}</div>
    <div class="cols3">
      <div class="card">${h3("Demographics","Age-band and gender distribution \u2014 chart pending.")}
        ${emptyCard("Charts coming soon","Demographics visualizations will use gold_dim_patient and gold_agg_patient_summary.","\u{1F465}")}</div>
      <div class="card">${h3("Glycemic Control","HbA1c control bands across the cohort \u2014 chart pending.")}
        ${emptyCard("Charts coming soon","Band counts from latest_hba1c in gold_agg_patient_summary.","\u{1F4CA}")}</div>
      <div class="card">${h3("Condition Prevalence","Top active conditions by patient count \u2014 chart pending.")}
        ${emptyCard("Charts coming soon","From gold_fact_condition where is_active=1.","\u{1F4CB}")}</div>
    </div>
    ${footer()}`;
}

SCREENS.population=renderPopulation;
