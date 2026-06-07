// Medications — from gold_fact_medication_request + gold_dim_medication.
// "Route" has no schema -> shown as "\u2014". Dose shows dosage_text where present.

async function renderMedications(el){
  el.innerHTML=`<div class="loading">Loading medications\u2026</div>`;
  const pk=CURRENT_PK;

  const [list, counts, timeline, orders, admins] = await Promise.all([
    q(`SELECT m.medication_display nm, MAX(mr.dosage_text) dose, mr.status st,
         MAX(d.full_date) dt, MAX(pr.provider_name) prescriber
       FROM gold_fact_medication_request mr
       JOIN gold_dim_medication m ON m.medication_key=mr.medication_key
       LEFT JOIN gold_dim_date d ON d.date_key=mr.authored_date_key
       LEFT JOIN gold_dim_provider pr ON ('us-npi|'||pr.npi)=mr.requester_id
       WHERE mr.patient_key=? GROUP BY m.medication_display, mr.status ORDER BY dt DESC`,[pk]),
    q(`SELECT COUNT(*) total,
         SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) act, MAX(d.full_date) last
       FROM gold_fact_medication_request mr LEFT JOIN gold_dim_date d ON d.date_key=mr.authored_date_key
       WHERE mr.patient_key=?`,[pk]),
    q(`SELECT m.medication_display nm, MIN(d.full_date) s, MAX(d.full_date) e,
         SUM(CASE WHEN mr.status='active' THEN 1 ELSE 0 END) act
       FROM gold_fact_medication_request mr JOIN gold_dim_medication m ON m.medication_key=mr.medication_key
       JOIN gold_dim_date d ON d.date_key=mr.authored_date_key
       WHERE mr.patient_key=? GROUP BY m.medication_display ORDER BY s`,[pk]),
    q(`SELECT m.medication_display nm, COUNT(*) n FROM gold_fact_medication_request mr
       JOIN gold_dim_medication m ON m.medication_key=mr.medication_key
       WHERE mr.patient_key=? GROUP BY m.medication_display ORDER BY n DESC LIMIT 6`,[pk]),
    q(`SELECT m.medication_display nm, COUNT(*) n FROM gold_fact_medication_admin ma
       JOIN gold_dim_medication m ON m.medication_key=ma.medication_key
       WHERE ma.patient_key=? GROUP BY m.medication_display`,[pk]),
  ]);

  const c=counts[0]||{};
  const cards=statCards([
    {label:"Active Meds",value:fmt(c.act||0),sub:"As of today",tip:"COUNT of gold_fact_medication_request rows with status='active' for this patient."},
    {label:"Total Prescriptions",value:fmt(c.total||0),sub:"All time",tip:"COUNT of all gold_fact_medication_request rows for this patient."},
    {label:"Last Authored",value:c.last?fmtDate(c.last):DASH,sub:"",tip:"Most recent authored_date_key across this patient's medication requests (via gold_dim_date)."},
  ]);

  const active=list.filter(m=>m.st==="active");
  const past=list.filter(m=>m.st!=="active");
  const medRow=m=>[`<b>${esc(cleanCode(m.nm))}</b>`, esc(m.dose||DASH), `<span class="muted">${DASH}</span>`,
                   fmtDate(m.dt), esc(m.prescriber||DASH), statusPill(m.st)];
  const heads=["Medication","Dose & Instructions","Route","Authored","Prescriber","Status"];

  // timeline bars across all meds
  const dated=timeline.filter(t=>t.s);
  let years=dated.flatMap(t=>[+yearOf(t.s),+yearOf(t.e)]);
  const minY=years.length?Math.min(...years):2015, maxY=new Date().getFullYear(), span=Math.max(1,maxY-minY);
  const tlHTML=dated.length?`<div class="onset">${dated.map(t=>{
      const ls=(+yearOf(t.s)-minY)/span*100, le=(+yearOf(t.e)-minY)/span*100;
      const col=t.act>0?"#0d9488":"#9aa7b1";
      return `<div class="onrow"><span class="onlbl">${esc(cleanCode(t.nm))}</span>
        <span class="ontrack"><span class="onbar" style="left:${ls.toFixed(1)}%;width:${Math.max(2,le-ls).toFixed(1)}%;background:${col}"></span></span>
        <span class="ondate">${t.act>0?"Active":"Past"}</span></div>`;
    }).join("")}<div class="onaxis"><span>${minY}</span><span>${maxY}</span></div></div>`
    :`<div class="empty">No medication history</div>`;

  // admins vs orders
  const adminMap=Object.fromEntries(admins.map(a=>[a.nm,a.n]));
  const avo=orders.map(o=>({label:cleanCode(o.nm),orders:o.n,admins:adminMap[o.nm]||0}));
  const mxAvo=Math.max(1,...avo.flatMap(a=>[a.orders,a.admins]));
  const avoHTML=avo.length?`<div class="avo">${avo.map(a=>`
    <div class="avorow"><div class="avolbl">${esc(a.label)}</div>
      <div class="avobar"><span class="avof" style="width:${(a.orders/mxAvo*100).toFixed(0)}%;background:#0d9488"></span><b>${a.orders}</b></div>
      <div class="avobar"><span class="avof" style="width:${(a.admins/mxAvo*100).toFixed(0)}%;background:#2563eb"></span><b>${a.admins}</b></div>
    </div>`).join("")}<div class="avolegend"><span><i style="background:#0d9488"></i>Orders</span><span><i style="background:#2563eb"></i>Administrations</span></div></div>`
    :`<div class="empty">No data</div>`;

  el.innerHTML=`
    ${await compactHeader(cards)}
    <div class="cols">
      <div class="card">
        ${h3("Medication List","Source: gold_fact_medication_request \u2192 gold_dim_medication (name), gold_dim_date (authored), gold_dim_provider (prescriber via requester_id = 'us-npi|'+npi). Dose = dosage_text where present (~13% of rows). Route has no column in the warehouse, shown as \u2014. Grouped by status into Active vs Past.")}
        <input class="search" id="med-search" placeholder="Search medications\u2026" style="margin-bottom:8px">
        <div class="grouplabel">Active Medications (${active.length})</div>
        ${tableHTML(heads,active.map(medRow),{empty:"No active medications"})}
        <div class="grouplabel" style="margin-top:14px">Past Medications (${past.length})</div>
        ${tableHTML(heads,past.map(medRow),{empty:"No past medications"})}
      </div>
      <div class="stack">
        <div class="card">${h3("Medication Timeline","Per medication, the bar spans the first to last authored_date_key in gold_fact_medication_request. Teal = has an active request; grey = past only.")}${chartBlock(tlHTML,{type:"custom",title:"Medication Timeline",tip:"Per medication, span from first to last authored date.",big:tlHTML,tableHeads:["Medication","First","Last","Status"],tableRows:dated.map(t=>[cleanCode(t.nm),fmtDate(t.s),fmtDate(t.e),t.act>0?"Active":"Past"])})}</div>
        <div class="card">${h3("Administrations vs Orders","Orders = COUNT in gold_fact_medication_request; Administrations = COUNT in gold_fact_medication_admin, both grouped by gold_dim_medication.medication_display. Top medications by order count.")}
          <p class="cardsub">Counts across the record</p>${chartBlock(avoHTML,{type:"custom",title:"Administrations vs Orders",tip:"Orders from gold_fact_medication_request, administrations from gold_fact_medication_admin.",big:avoHTML,tableHeads:["Medication","Orders","Administrations"],tableRows:avo.map(a=>[a.label,String(a.orders),String(a.admins)])})}</div>
      </div>
    </div>
    ${footer()}`;

  const s=el.querySelector("#med-search");
  s.oninput=()=>{ const t=s.value.toLowerCase();
    el.querySelectorAll(".card table tbody tr").forEach(tr=>{
      const txt=tr.textContent.toLowerCase(); tr.style.display=(!t||txt.includes(t))?"":"none"; }); };
}

SCREENS.medications=renderMedications;
