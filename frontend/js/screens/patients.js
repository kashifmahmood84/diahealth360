// Portal Patients — primary patient selection (EHR-style directory).

async function renderPatients(el){
  el.innerHTML=`<div class="loading">Loading patients\u2026</div>`;
  const rows=await Promise.all(PATIENTS.map(async p=>{
    const [dx, lastEnc] = await Promise.all([
      q(`SELECT c.display nm FROM gold_fact_condition f
         JOIN gold_dim_code c ON c.code_key=f.condition_code_key
         WHERE f.patient_key=? AND f.is_active=1 ORDER BY f.onset_date_key LIMIT 1`,[p.patient_key]),
      q(`SELECT MAX(d.full_date) dt FROM gold_fact_encounter f
         JOIN gold_dim_date d ON d.date_key=f.admit_date_key WHERE f.patient_key=?`,[p.patient_key]),
    ]);
    return {p, dx:dx[0]&&dx[0].nm, last:lastEnc[0]&&lastEnc[0].dt};
  }));

  el.innerHTML=`
    <div class="card ptable-wrap">
      <div class="ptable-toolbar">
        <div class="search-wrap grow">
          <span class="search-ico">\u{1F50D}</span>
          <input class="portal-search" id="pt-search" placeholder="Search by name or MRN\u2026" autocomplete="off">
        </div>
        <span class="muted">${fmt(PATIENTS.length)} patients</span>
      </div>
      <table class="ptable pro-table"><thead><tr>
        <th>Patient</th><th>Age / Sex</th><th>MRN</th><th>Primary Dx</th><th>Last Visit</th><th>Risk</th><th></th>
      </tr></thead><tbody id="pt-body">
        ${rows.map(({p,dx,last})=>{ const q=((p.full_name||"")+" "+(p.mrn||"")).toLowerCase().replace(/"/g,"");
          const ageSex=`${p.age_years??""} / ${(p.gender||"")[0]||""}`;
          return `<tr class="ptrow" data-pk="${p.patient_key}" data-q="${q}" tabindex="0" role="button">
            <td><div class="ptrow-name"><span class="ptrow-ava">${esc(initials(p.full_name))}</span><b>${esc(p.full_name||"")}</b></div></td>
            <td>${esc(ageSex)}</td>
            <td class="mono muted">${esc(p.mrn||DASH)}</td>
            <td>${esc(dx?cleanCode(dx):"Not recorded")}</td>
            <td>${last?fmtDate(last):DASH}</td>
            <td>${riskPill(null)}</td>
            <td class="row-go">\u203A</td></tr>`; }).join("")}
      </tbody></table>
    </div>
    ${footer()}`;

  function openRow(r){ openPatient(Number(r.dataset.pk)); }
  el.querySelectorAll(".ptrow").forEach(r=>{
    r.onclick=()=>openRow(r);
    r.onkeydown=(e)=>{ if(e.key==="Enter"||e.key===" ") { e.preventDefault(); openRow(r); } };
  });
  el.querySelector("#pt-search").oninput=(e)=>{
    const t=e.target.value.toLowerCase();
    el.querySelectorAll(".ptrow").forEach(r=>r.style.display=(!t||r.dataset.q.includes(t))?"":"none");
  };
}

SCREENS.patients=renderPatients;
