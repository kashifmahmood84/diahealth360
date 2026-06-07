// Documents — gold_fact_document (metadata only; no document body/PDF in dataset,
// so Download is disabled). Layout kept per mock.

function titleCase(s){ return (s||"").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }

async function renderDocuments(el){
  el.innerHTML=`<div class="loading">Loading documents\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT d.full_date dt, f.category_code cat, f.content_type ct, f.status st,
       e.encounter_class cls, tcd.display typ
     FROM gold_fact_document f JOIN gold_dim_date d ON d.date_key=f.document_date_key
     LEFT JOIN gold_fact_encounter e ON e.encounter_id=f.encounter_id
     LEFT JOIN gold_dim_code tcd ON tcd.code=f.type_code
     WHERE f.patient_key=? ORDER BY d.full_date DESC`,[pk]);

  const total=rows.length;
  const byYear={}; rows.forEach(r=>{ byYear[yearOf(r.dt)]=(byYear[yearOf(r.dt)]||0)+1; });
  const yrs=Object.keys(byYear).sort(); const recentYear=yrs[yrs.length-1];
  const cats=[...new Set(rows.map(r=>r.cat).filter(Boolean))];

  const cards=statCards([
    {label:"Total Documents",value:fmt(total),sub:"All time",tip:"COUNT of gold_fact_document rows for this patient."},
    {label:"Most Recent Year",value:fmt(byYear[recentYear]||0),sub:recentYear||"",tip:"Document count in the latest calendar year present (document_date_key via gold_dim_date)."},
    {label:"Document Types",value:fmt(cats.length),sub:"Categories",tip:"Distinct category_code values present. This dataset has a single category (clinical-note)."},
  ]);

  // by status (real variation; mock's 8-type pie does not exist in this dataset)
  const byStatus={}; rows.forEach(r=>{ const k=titleCase(r.st||"Unknown"); byStatus[k]=(byStatus[k]||0)+1; });
  const palette=["#0d9488","#d97706","#2563eb","#9333ea"];
  const segs=Object.entries(byStatus).map(([k,v],i)=>({label:k,value:v,color:palette[i%palette.length]}));

  const recent=rows.slice(0,6);
  const shown=rows.slice(0,300);

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><div class="toolbar">
      <input class="search" id="doc-search" placeholder="Search documents\u2026">
      <span class="muted" style="margin-left:auto">This dataset stores document metadata only (no file body).</span>
    </div></div>
    <div class="cols">
      <div class="card">${h3("Document Records","Source: gold_fact_document \u2192 gold_dim_date. Document name = type_code via gold_dim_code (all rows are LOINC 34117-2). Encounter = encounter_class of the linked encounter. The warehouse stores metadata only (no file body/PDF), so download is disabled.")}<div class="scrollbox">
        <table><thead><tr><th>Document</th><th>Category</th><th>Date</th><th>Encounter</th><th>Content Type</th><th>Status</th><th>File</th></tr></thead>
        <tbody id="doc-body">${shown.map(r=>`<tr class="docrow">
          <td><b>${esc(cleanCode(r.typ)||"Clinical Document")}</b></td>
          <td>${pill(titleCase(r.cat||DASH),"")}</td>
          <td>${fmtDate(r.dt)}</td>
          <td>${esc(ENC_CLASS[r.cls]||r.cls||DASH)}</td>
          <td class="muted">${esc(r.ct||DASH)}</td>
          <td>${statusPill(r.st)}</td>
          <td><button class="iconbtn" disabled title="No file (metadata only)">\u2913</button></td></tr>`).join("")
          ||`<tr><td colspan="7" class="empty">No documents</td></tr>`}</tbody></table>
      </div></div>
      <div class="stack">
        <div class="card">${h3("Documents by Status","Share of documents by status (current / superseded). The mock's 8-type pie does not exist in this dataset \u2014 only one document type is present \u2014 so status is shown instead.")}${chartBlock(donutSVG(segs,fmt(total),"Total"),{type:"donut",title:"Documents by Status",tip:"Share of documents by status.",segments:segs,center:fmt(total),centerSub:"Total"})}</div>
        <div class="card">${h3("Recent Documents","6 most recent gold_fact_document rows by document_date_key.")}
          ${recent.map(r=>`<div class="reclist"><div><b>${esc(cleanCode(r.typ)||"Clinical Document")}</b>
            <div class="muted">${titleCase(r.cat||"")}</div></div><span class="muted">${fmtDate(r.dt)}</span></div>`).join("")||'<div class="empty">None</div>'}
        </div>
      </div>
    </div>
    ${footer()}`;

  const s=el.querySelector("#doc-search");
  s.oninput=()=>{ const t=s.value.toLowerCase();
    el.querySelectorAll("#doc-body .docrow").forEach(tr=>tr.style.display=(!t||tr.textContent.toLowerCase().includes(t))?"":"none"); };
}

SCREENS.documents=renderDocuments;
