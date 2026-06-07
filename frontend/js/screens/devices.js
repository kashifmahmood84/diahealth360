// Devices — gold_fact_device (inventory only, NOT CGM telemetry). type_code is a
// SNOMED code with no display dim, shown raw. No device dates in this dataset.

async function renderDevices(el){
  el.innerHTML=`<div class="loading">Loading devices\u2026</div>`;
  const pk=CURRENT_PK;
  const rows=await q(`SELECT device_name nm, manufacturer mfr, type_code typ, udi_carrier udi, status st
     FROM gold_fact_device WHERE patient_key=? ORDER BY device_name`,[pk]);

  const total=rows.length;
  const active=rows.filter(r=>(r.st||"").toLowerCase()==="active").length;
  const types=[...new Set(rows.map(r=>r.typ).filter(Boolean))];

  const cards=statCards([
    {label:"Total Devices",value:fmt(total),sub:"All time",tip:"COUNT of gold_fact_device rows for this patient."},
    {label:"Active",value:fmt(active),sub:"Currently in use",tip:"Rows where status='active' (every device in this dataset is active)."},
    {label:"Device Types",value:fmt(types.length),sub:"Distinct codes",tip:"Distinct type_code values (SNOMED). These codes are not in gold_dim_code, so no type display name is available."},
  ]);

  const byMfr={}; rows.forEach(r=>{ const k=r.mfr||"Unknown"; byMfr[k]=(byMfr[k]||0)+1; });
  const palette=["#0d9488","#2563eb","#16a34a","#d97706","#9333ea","#dc2626","#0891b2","#db2777"];
  const segs=Object.entries(byMfr).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v],i)=>({label:k.slice(0,22),value:v,color:palette[i%palette.length]}));

  const statusOptions=`<option value="">All Statuses</option>`+[...new Set(rows.map(r=>r.st).filter(Boolean))].map(s=>`<option value="${esc(s)}">${esc(titleCase(s))}</option>`).join("");

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="card pagehead"><div class="toolbar">
      <select id="dev-status" class="select">${statusOptions}</select>
      <input class="search" id="dev-search" placeholder="Search devices\u2026">
      <span class="muted" style="margin-left:auto">Device inventory only \u2014 no telemetry/CGM data in this dataset.</span>
    </div></div>
    <div class="cols">
      <div class="card">${h3("Device Records","Source: gold_fact_device. Type (code) is the raw SNOMED type_code \u2014 these codes have no entry in gold_dim_code, so no display name is shown rather than fabricating one.")}<div class="scrollbox">
        <table><thead><tr><th>Device Name</th><th>Manufacturer</th><th>Type (code)</th><th>UDI</th><th>Status</th></tr></thead>
        <tbody id="dev-body">${rows.map(r=>`<tr class="devrow" data-st="${esc(r.st||"")}">
          <td><b>${esc(r.nm||DASH)}</b></td><td>${esc(r.mfr||DASH)}</td>
          <td class="muted">${esc(r.typ||DASH)}</td><td class="muted">${esc(r.udi||DASH)}</td>
          <td>${statusPill(r.st)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">No devices recorded</td></tr>`}</tbody></table>
      </div></div>
      <div class="stack">
        <div class="card">${h3("Devices by Manufacturer","Share of devices grouped by manufacturer (gold_fact_device.manufacturer). Shown instead of 'by type' because type_code has no display dim in this dataset.")}${segs.length?chartBlock(donutSVG(segs,fmt(total),"Total"),{type:"donut",title:"Devices by Manufacturer",tip:"Share of devices grouped by manufacturer.",segments:segs,center:fmt(total),centerSub:"Total"}):'<div class="empty">No data</div>'}</div>
        <div class="card">${h3("Device Inventory","First rows from gold_fact_device. The warehouse has no device dates, so 'recently added' ordering is not possible.")}
          ${rows.slice(0,6).map(r=>`<div class="reclist"><div><b>${esc(r.nm||DASH)}</b><div class="muted">${esc(r.mfr||"")}</div></div>${statusPill(r.st)}</div>`).join("")||'<div class="empty">None</div>'}
        </div>
      </div>
    </div>
    ${footer()}`;

  const stSel=el.querySelector("#dev-status"), srch=el.querySelector("#dev-search");
  function flt(){ const sv=stSel.value, t=srch.value.toLowerCase();
    el.querySelectorAll("#dev-body .devrow").forEach(tr=>{
      const okS=!sv||tr.dataset.st===sv, okT=!t||tr.textContent.toLowerCase().includes(t);
      tr.style.display=(okS&&okT)?"":"none"; }); }
  stSel.onchange=flt; srch.oninput=flt;
}

SCREENS.devices=renderDevices;
