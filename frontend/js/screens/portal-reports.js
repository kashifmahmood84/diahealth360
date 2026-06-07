// Portal Reports (P4) — cross-cohort diagnostic reports (stub).

async function renderPortalReports(el){
  el.innerHTML=`<div class="loading">Loading reports\u2026</div>`;
  const rows=await q(`SELECT COUNT(*) n FROM gold_fact_diagnostic_report`,[]);
  el.innerHTML=`
    <div class="portalhead"><h1 class="serif">Reports</h1>
      <p class="cardsub">Diagnostic reports across the cohort.</p></div>
    <div class="card">${h3("Cohort Reports","Cross-patient report table \u2014 open a patient workspace for individual reports.")}
      ${statCards([{label:"Total Reports",value:fmt(rows[0]&&rows[0].n||0),sub:"All patients"}])}
      ${emptyCard("Portal report browser coming soon","Use a patient's Coordination \u2192 Reports workspace for per-patient reports.","\u{1F4C4}")}
    </div>
    ${footer()}`;
}

SCREENS["portal-reports"]=renderPortalReports;
