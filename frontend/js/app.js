// app.js — portal sidebar + patient icon rail, banner, and top nav. Loaded last.

function workspaceEl(){
  return document.getElementById("workspace-main");
}
function isMobile(){
  return window.matchMedia("(max-width:768px)").matches;
}

const RAIL_NAV = [
  ["exit","Back to Portal","\u2302",true],
  ["dashboard","Dashboard","\u2302",false],
  ["patients","Patients","\u2637",false],
  ["population","Population","\u223F",false],
  ["portal-reports","Reports","\u25A4",false],
  ["settings","Settings","\u2699",false],
];

function buildPortalNav(){
  const nav=document.getElementById("portal-nav");
  nav.innerHTML=PORTAL_NAV.map(([id,label,ic])=>{
    const on=APP_MODE==="portal"&&id===CURRENT_SCREEN;
    return `<a data-screen="${id}" class="${on?"on":""}"><span class="ic">${ic}</span>${esc(label)}</a>`;
  }).join("");
  nav.querySelectorAll("a").forEach(a=>a.onclick=()=>navigatePortal(a.dataset.screen));
}

function buildIconRail(){
  const nav=document.getElementById("rail-nav");
  nav.innerHTML=RAIL_NAV.map(([id,tooltip,ic,emph])=>{
    if(id==="exit") return "";
    return `<button type="button" class="rail-btn" data-rail="${id}" title="${esc(tooltip)}">${ic}</button>`;
  }).join("");
  nav.querySelectorAll("[data-rail]").forEach(b=>{
    b.onclick=()=>{ backToPortal(); navigatePortal(b.dataset.rail); };
  });
  document.getElementById("rail-exit").onclick=()=>backToPortal();
}

function buildPatientTabs(){
  const box=document.getElementById("patient-tabs");
  const activeTab=tabForScreen(CURRENT_SCREEN)||"overview";
  const mobBack=isMobile()?`<button type="button" class="mob-portal-btn" id="mob-portal-btn" aria-label="Back to portal">\u2302 Portal</button>`:"";
  box.innerHTML=mobBack+PATIENT_TABS.map(t=>{
    if(t.screen){
      const on=t.id===activeTab&&CURRENT_SCREEN===t.screen;
      return `<a class="pnav-tab ${on?"on":""}" data-screen="${t.screen}">${esc(t.label)}</a>`;
    }
    const on=t.id===activeTab;
    const kids=(t.children||[]).map(([sid,cap,ic])=>{
      const subOn=CURRENT_SCREEN===sid;
      return `<a class="pdrop-item ${subOn?"on":""}" data-screen="${sid}"><span class="pdrop-ic">${ic}</span>${esc(cap)}</a>`;
    }).join("");
    return `<div class="pnav-drop ${on?"on":""}" data-gid="${t.id}">
      <button type="button" class="pnav-tab pnav-btn" data-default="${t.default||""}">${esc(t.label)}<span class="chev">\u25BE</span></button>
      <div class="pdrop"><div class="pdrop-grid">${kids}</div></div>
    </div>`;
  }).join("");

  const mobBtn=box.querySelector("#mob-portal-btn");
  if(mobBtn) mobBtn.onclick=()=>backToPortal();
  box.querySelectorAll("[data-screen]").forEach(a=>{
    a.onclick=(e)=>{ e.preventDefault(); navigatePatient(a.dataset.screen); closePatientDrops(); };
  });
  box.querySelectorAll(".pnav-btn").forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const wrap=btn.closest(".pnav-drop");
      const wasOpen=wrap.classList.contains("open");
      closePatientDrops();
      if(!wasOpen) wrap.classList.add("open");
      else if(btn.dataset.default) navigatePatient(btn.dataset.default);
    };
    if(!isMobile()){
      btn.onmouseenter=()=>{ closePatientDrops(); btn.closest(".pnav-drop").classList.add("open"); };
    }
  });
  if(!isMobile()){
    box.querySelectorAll(".pnav-drop").forEach(d=>{
      d.onmouseleave=()=>d.classList.remove("open");
    });
  }
}

function closePatientDrops(){
  document.querySelectorAll(".pnav-drop.open").forEach(n=>n.classList.remove("open"));
}

async function refreshPatientBanner(){
  const box=document.getElementById("patient-banner");
  if(APP_MODE!=="patient"||!CURRENT_PK){ box.innerHTML=""; return; }
  box.innerHTML=`<div class="loading" style="padding:16px">Loading patient\u2026</div>`;
  box.innerHTML=await patientBannerHTML();
}

function buildPatientSwitcher(){
  const sel=document.getElementById("patient-switch");
  sel.innerHTML=PATIENTS.map(p=>
    `<option value="${p.patient_key}" ${p.patient_key===CURRENT_PK?"selected":""}>${esc(p.full_name||"Patient")}</option>`
  ).join("");
  sel.onchange=()=>switchPatient(Number(sel.value));
}

function updateChrome(){
  const inPatient=APP_MODE==="patient";
  const root=document.getElementById("app-root");
  root.classList.toggle("mode-patient",inPatient);
  root.classList.toggle("mode-portal",!inPatient);
  document.getElementById("portal-side").hidden=inPatient;
  document.getElementById("icon-rail").hidden=!inPatient||isMobile();
  document.documentElement.classList.toggle("is-mobile",isMobile());
  document.documentElement.classList.toggle("mode-patient-doc",inPatient);
  document.getElementById("portal-top").hidden=inPatient;
  document.getElementById("patient-chrome").hidden=!inPatient;

  if(inPatient){
    buildIconRail();
    buildPatientTabs();
    buildPatientSwitcher();
    refreshPatientBanner();
  } else {
    buildPortalNav();
    const title=document.getElementById("portal-title");
    const cohort=PATIENTS.length?`<span class="cohort-pill">${fmt(PATIENTS.length)} patients loaded</span>`:"";
    title.innerHTML=`<h1 class="serif">${esc(PORTAL_TITLES[CURRENT_SCREEN]||"Portal")} ${cohort}</h1>
      <p>${esc(PORTAL_SUBTITLES[CURRENT_SCREEN]||"")}</p>`;
    wirePortalSearch();
  }
}

function wirePortalSearch(){
  const inp=document.getElementById("portal-search");
  if(!inp||inp._wired) return;
  inp._wired=true;
  inp.onkeydown=(e)=>{
    if(e.key==="Enter"&&inp.value.trim()){
      navigatePortal("patients");
      setTimeout(()=>{
        const s=document.getElementById("pt-search");
        if(s){ s.value=inp.value.trim(); s.dispatchEvent(new Event("input")); }
      },120);
    }
  };
}

function backToPortal(){
  APP_MODE="portal";
  CURRENT_SCREEN="dashboard";
  updateChrome();
  renderScreen("dashboard");
}

function navigatePortal(screen){
  APP_MODE="portal";
  CURRENT_SCREEN=screen;
  updateChrome();
  renderScreen(screen);
}

function openPatient(pk,screen="patient360"){
  CURRENT_PK=pk;
  APP_MODE="patient";
  CURRENT_SCREEN=screen;
  updateChrome();
  renderScreen(screen);
}

function switchPatient(pk){
  if(!pk||pk===CURRENT_PK) return;
  CURRENT_PK=pk;
  updateChrome();
  renderScreen(CURRENT_SCREEN);
}

function navigatePatient(screen){
  if(APP_MODE!=="patient") return;
  CURRENT_SCREEN=screen;
  buildPatientTabs();
  buildPatientSwitcher();
  renderScreen(screen);
}

function navigate(screen){
  if(PORTAL_NAV.some(([id])=>id===screen)) navigatePortal(screen);
  else navigatePatient(screen);
}

function renderScreen(screen){
  const el=workspaceEl();
  if(!el) return;
  el.scrollTop=0; window.scrollTo(0,0);
  const fn=SCREENS[screen];
  if(fn){ fn(el).catch(e=>{ el.innerHTML=`<div class="card fatal"><h3 class="serif">Error loading screen</h3><p>${esc(e.message)}</p></div>`; }); }
  else { el.innerHTML=`<div class="card"><div class="empty">Screen not found: ${esc(screen)}</div></div>`; }
}

async function boot(){
  PATIENTS=await loadPatients();
  if(!PATIENTS.length){ workspaceEl().innerHTML='<div class="loading">No patients found.</div>'; return; }
  openPatient(defaultPatientKey(),"patient360");
}

document.addEventListener("click",(e)=>{
  if(!e.target.closest(".pnav-drop")) closePatientDrops();
  const z=e.target.closest&&e.target.closest("[data-chart]");
  if(z){ openChartModal(z.dataset.chart); e.stopPropagation(); return; }
  const ws=e.target.closest&&e.target.closest("[data-workspace]");
  if(ws){ navigatePatient(ws.dataset.workspace); e.stopPropagation(); return; }
});
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ closeChartModal(); closePatientDrops(); } });
document.addEventListener("click",(e)=>{
  const info=e.target.closest&&e.target.closest(".info");
  document.querySelectorAll(".info.pinned").forEach(n=>{ if(n!==info) n.classList.remove("pinned"); });
  if(info){ info.classList.toggle("pinned"); e.stopPropagation(); }
});

function showFatal(msg){
  const el=workspaceEl();
  if(el) el.innerHTML=`<div class="card fatal"><h3 class="serif">Could not load DiaHealth 360</h3><p>${esc(msg)}</p><p class="cardsub">Try a hard refresh (Cmd+Shift+R). If this persists, check the browser console Network tab for failed API calls.</p></div>`;
}

window.addEventListener("error",(e)=>{
  console.error(e.error||e.message);
  if(!PATIENTS||!PATIENTS.length) showFatal(e.message||"JavaScript error during startup");
});
window.addEventListener("unhandledrejection",(e)=>{
  console.error(e.reason);
});

let _resizeT;
window.addEventListener("resize",()=>{
  clearTimeout(_resizeT);
  _resizeT=setTimeout(()=>{ if(PATIENTS&&PATIENTS.length) updateChrome(); },150);
});
boot().catch(e=>showFatal(e.message));
