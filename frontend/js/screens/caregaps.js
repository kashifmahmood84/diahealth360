// Care Gaps — recency status computed from REAL last-done dates vs standard
// diabetes screening intervals (CARE_GAPS in state.js). Single source of truth.

async function renderCaregaps(el){
  el.innerHTML=`<div class="loading">Loading care gaps\u2026</div>`;
  const pk=CURRENT_PK;
  const gaps=await computeCareGaps(pk);

  const open=gaps.filter(g=>g.status==="Due").length;
  const overdue=gaps.filter(g=>g.status==="Overdue").length;
  const uptodate=gaps.filter(g=>g.status==="Up to date").length;

  const cards=statCards([
    {label:"Open Gaps",value:fmt(open+overdue),sub:"Need attention",tip:"Gaps with status Due or Overdue."},
    {label:"Overdue",value:fmt(overdue),sub:"Past due",tip:"Last-done date older than 1.5\u00D7 the recommended interval, or never done."},
    {label:"Up To Date",value:fmt(uptodate),sub:"On track",tip:"Last-done date within the recommended interval."},
  ]);

  const rows=gaps.map(g=>[
    `<b>${esc(g.label)}</b>`,
    g.lastDate?fmtDate(g.lastDate):"Never",
    statusPill(g.status),
    `Every ${g.months} months`,
  ]);

  const total=gaps.length;
  const segs=[
    {label:"Up to date",value:uptodate,color:"#16a34a"},
    {label:"Due",value:open,color:"#d97706"},
    {label:"Overdue",value:overdue,color:"#dc2626"},
  ].filter(s=>s.value>0);

  const overdueList=gaps.filter(g=>g.status==="Overdue"||g.status==="Due");

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><h2 class="serif">Care Gaps ${infoTip("For each item, the most recent date is read from the real source (gold_fact_observation for labs/BP, gold_fact_immunization for vaccines, gold_fact_procedure for exams) and compared to a standard diabetes screening interval: Up to date \u2264 interval, Due \u2264 1.5\u00D7 interval, else Overdue. Intervals are care guidelines, not patient data.")}</h2>
      <p class="cardsub">Preventive and chronic care services recommended for patients with diabetes. Status is computed from the most recent date on record vs the recommended interval.</p>
    </div>
    <div class="cols">
      <div class="card">
        ${tableHTML(["Care Gap","Last Done","Status","Recommended Interval"],rows,{empty:"No care gaps configured"})}
      </div>
      <div class="stack">
        <div class="card">${h3("Screening Coverage","Share of the tracked care gaps that are Up to date / Due / Overdue. Center = % up to date.")}
          ${chartBlock(donutSVG(segs,`${total?Math.round(uptodate/total*100):0}%`,"Up to date"),{type:"donut",title:"Screening Coverage",tip:"Share of tracked care gaps by status.",segments:segs,center:`${total?Math.round(uptodate/total*100):0}%`,centerSub:"Up to date"})}
        </div>
        <div class="card">${h3("Needs Attention","Care gaps currently Due or Overdue, with the last-done date and interval.")}
          ${overdueList.length?overdueList.map(g=>`<div class="reclist">
            <div><b>${esc(g.label.split(" (")[0])}</b><div class="muted">Last: ${g.lastDate?fmtDate(g.lastDate):"Never"} \u00B7 every ${g.months} mo</div></div>
            ${statusPill(g.status)}</div>`).join(""):emptyCard("All caught up","No gaps currently due or overdue.","\u2705")}
        </div>
      </div>
    </div>
    ${footer()}`;
}

SCREENS.caregaps=renderCaregaps;
