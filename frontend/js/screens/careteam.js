// Care Team — gold_bridge_careteam_member + gold_dim_provider + gold_fact_careplan.
// Managing organization is null for all patients in this dataset (honest empty state).

async function renderCareteam(el){
  el.innerHTML=`<div class="loading">Loading care team\u2026</div>`;
  const pk=CURRENT_PK;
  const [members, plans, org] = await Promise.all([
    q(`SELECT DISTINCT m.member_name nm, m.member_role role, pr.specialty_name spec, pr.npi npi
       FROM gold_bridge_careteam_member m LEFT JOIN gold_dim_provider pr ON pr.provider_key=m.provider_key
       WHERE m.patient_key=? AND m.member_name IS NOT NULL ORDER BY m.member_role`,[pk]),
    q(`SELECT cp.category_code cat, cp.status st, ds.full_date s, de.full_date e
       FROM gold_fact_careplan cp LEFT JOIN gold_dim_date ds ON ds.date_key=cp.start_date_key
       LEFT JOIN gold_dim_date de ON de.date_key=cp.end_date_key
       WHERE cp.patient_key=? ORDER BY ds.full_date DESC`,[pk]),
    q(`SELECT o.org_name nm, o.org_type typ FROM gold_dim_patient p
       LEFT JOIN gold_dim_organization o ON o.organization_id=p.managing_org_id
       WHERE p.patient_key=? AND p.is_current=1`,[pk]),
  ]);

  const o=org[0]||{};
  const memberCards=members.length?members.map(m=>`
    <div class="memcard">
      <div class="memava">${esc(initials(m.nm))}</div>
      <div class="meminfo">
        <div class="memname">${esc(m.nm)}</div>
        <div class="memrole">${esc((m.role||"").replace(/\s*\([^)]*\)/g,""))}</div>
      </div>
      <div class="memmeta">
        <div><span class="kvk">Specialty</span> ${esc(m.spec||DASH)}</div>
        <div><span class="kvk">NPI</span> ${esc(m.npi||DASH)}</div>
      </div>
    </div>`).join(""):`<div class="empty">No care team members recorded</div>`;

  const planRows=plans.map(p=>[
    `<b>${esc(titleCase(p.cat||"Care Plan"))}</b>`,
    statusPill(p.st),
    `${fmtDate(p.s)} \u2013 ${p.e?fmtDate(p.e):"ongoing"}`,
  ]);

  el.innerHTML=`
    ${await compactHeader("")}
    <div class="cols">
      <div class="card">
        <div class="cardhead">${h3("Care Team Members","Source: gold_bridge_careteam_member (member_name, member_role) joined to gold_dim_provider (specialty_name, npi) via provider_key. Specialty is uniformly 'General Practice Physician' in this synthetic dataset.")}
          <button class="btn" disabled title="Coming soon">\u21BA View History</button></div>
        <p class="cardsub">Providers and roles documented in the clinical record.</p>
        ${memberCards}
        <div class="note">\u24D8 Care team data is limited to providers and organizations documented in the clinical record.</div>
      </div>
      <div class="stack">
        <div class="card">${h3("Managing Organization","gold_dim_patient.managing_org_id \u2192 gold_dim_organization. This id is null for all 25 patients, so this is an honest empty state.")}
          ${o.nm?`<div class="memname">${esc(o.nm)}</div><div class="muted">${esc(o.typ||"")}</div>`
            :emptyCard("Not recorded","No managing organization is associated with this patient in the dataset.","\u{1F3E2}")}
        </div>
        <div class="card">${h3("Care Plans","Source: gold_fact_careplan. Title is null for all rows, so the category_code is shown as the plan name; period from start/end_date_key via gold_dim_date.")}
          <p class="cardsub">Care plans documented for this patient</p>
          ${tableHTML(["Care Plan","Status","Period"],planRows,{empty:"No care plans recorded"})}
        </div>
      </div>
    </div>
    ${footer()}`;
}

SCREENS.careteam=renderCareteam;
