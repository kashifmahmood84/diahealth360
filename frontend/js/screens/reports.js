// Reports — gold_fact_diagnostic_report. Conclusions are null in this dataset and
// there is no report->observation link, so those columns show "\u2014" (kept per mock).

function reportCat(cat){
  if(!cat) return "Other";
  if(cat.toUpperCase()==="LAB") return "Lab";
  if(/^\d/.test(cat)) return "Clinical Note";
  return titleCase(cat);
}

async function renderReports(el){
  el.innerHTML=`<div class="loading">Loading reports\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT d.full_date eff, d2.full_date iss, cd.display nm, r.category cat, r.status st
     FROM gold_fact_diagnostic_report r JOIN gold_dim_code cd ON cd.code_key=r.report_code_key
     LEFT JOIN gold_dim_date d ON d.date_key=r.effective_date_key
     LEFT JOIN gold_dim_date d2 ON d2.date_key=r.issued_date_key
     WHERE r.patient_key=? ORDER BY d.full_date DESC`,[pk]);

  const total=rows.length;
  const latest=rows[0];
  const byCat={}; rows.forEach(r=>{ const k=reportCat(r.cat); byCat[k]=(byCat[k]||0)+1; });
  const palette=["#0d9488","#2563eb","#9333ea","#d97706","#16a34a","#dc2626"];
  const segs=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>({label:k,value:v,color:palette[i%palette.length]}));

  const cards=statCards([
    {label:"Total Reports",value:fmt(total),sub:"All time",tip:"COUNT of gold_fact_diagnostic_report rows for this patient."},
    {label:"Abnormal Conclusions",value:DASH,sub:"Not recorded",tip:"conclusion is null for every diagnostic report in the warehouse, so abnormal conclusions cannot be derived."},
    {label:"Latest Report",value:latest?fmtDate(latest.eff):DASH,sub:latest?cleanCode(latest.nm).slice(0,24):"",tip:"Most recent effective_date_key across this patient's diagnostic reports."},
  ]);

  const catOptions=`<option value="">All Categories</option>`+Object.keys(byCat).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join("");
  const shown=rows.slice(0,300);
  const recent=rows.slice(0,6);

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><div class="toolbar">
      <select id="rep-cat" class="select">${catOptions}</select>
      <input class="search" id="rep-search" placeholder="Search reports\u2026">
      <span class="muted" style="margin-left:auto">Conclusions & linked observations are not available in this dataset.</span>
    </div></div>
    <div class="cols">
      <div class="card">${h3("Report Records","Source: gold_fact_diagnostic_report \u2192 gold_dim_code (name), gold_dim_date (effective/issued). Conclusion is null for all rows and there is no report\u2192observation link, so the Conclusion column is \u2014.")}<div class="scrollbox">
        <table><thead><tr><th>Report</th><th>Category</th><th>Effective</th><th>Issued</th><th>Status</th><th>Conclusion</th></tr></thead>
        <tbody id="rep-body">${shown.map(r=>`<tr class="reprow" data-cat="${esc(reportCat(r.cat))}">
          <td><b>${esc(cleanCode(r.nm))}</b></td><td>${pill(reportCat(r.cat),"")}</td>
          <td>${fmtDate(r.eff)}</td><td>${fmtDate(r.iss)}</td><td>${statusPill(r.st)}</td>
          <td class="muted">${DASH}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">No reports</td></tr>`}</tbody></table>
      </div></div>
      <div class="stack">
        <div class="card">${h3("Reports by Category","Share of diagnostic reports by category (gold_fact_diagnostic_report.category: LAB, clinical note, or other). Segments sum to the total.")}${chartBlock(donutSVG(segs,fmt(total),"Total"),{type:"donut",title:"Reports by Category",tip:"Share of diagnostic reports by category.",segments:segs,center:fmt(total),centerSub:"Total"})}</div>
        <div class="card">${h3("Recent Reports","6 most recent diagnostic reports by effective_date_key (name via gold_dim_code).")}
          ${recent.map(r=>`<div class="reclist"><div><b>${esc(cleanCode(r.nm))}</b>
            <div class="muted">${reportCat(r.cat)}</div></div><span class="muted">${fmtDate(r.eff)}</span></div>`).join("")||'<div class="empty">None</div>'}
        </div>
      </div>
    </div>
    ${footer()}`;

  const catSel=el.querySelector("#rep-cat"), srch=el.querySelector("#rep-search");
  function flt(){ const cv=catSel.value, t=srch.value.toLowerCase();
    el.querySelectorAll("#rep-body .reprow").forEach(tr=>{
      const okC=!cv||tr.dataset.cat===cv, okT=!t||tr.textContent.toLowerCase().includes(t);
      tr.style.display=(okC&&okT)?"":"none"; }); }
  catSel.onchange=flt; srch.oninput=flt;
}

SCREENS.reports=renderReports;
