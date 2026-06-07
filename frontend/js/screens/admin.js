// Portal Admin (P5) — configuration placeholder (no patient data).

async function renderAdmin(el){
  el.innerHTML=`
    <div class="portalhead"><h1 class="serif">Admin</h1>
      <p class="cardsub">User, role, and organization management.</p></div>
    <div class="cols">
      <div class="card">${h3("Users & Roles","Not backed by the warehouse.")}
        ${emptyCard("Coming soon","User and role management is application configuration, not patient data.","\u{1F464}")}</div>
      <div class="card">${h3("Organizations & Integrations","Not backed by the warehouse.")}
        ${emptyCard("Coming soon","Organization and integration settings will be added later.","\u{1F517}")}</div>
    </div>
    ${footer()}`;
}

SCREENS.admin=renderAdmin;
