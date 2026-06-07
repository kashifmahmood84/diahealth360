// ui.js — shared rendering helpers and chart primitives used by every screen.
// Loaded after api.js, before the screen files.

const DASH = "\u2014";

function esc(s){ return (s==null?"":String(s)).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }

// ---- data lineage / provenance ("?" affordance) ----
// hover to preview, click to pin. Text supports \n line breaks and **bold**.
function infoTip(text){
  if(!text) return "";
  const safe=esc(text).replace(/\n/g,"<br>").replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
  return `<span class="info" tabindex="0" role="button" aria-label="How this is derived">i<span class="tip">${safe}</span></span>`;
}

// Structured data lineage trail for charts (hover on trail button).
function observationLineage(loinc, label){
  return [
    "Synthea synthetic FHIR source",
    "gold_fact_observation (patient observation facts)",
    "gold_dim_code \u2192 LOINC "+loinc+(label?" ("+label+")":""),
    "gold_dim_date \u2192 effective_date_key / full_date",
    "value_numeric + value_unit",
    "ref_range_low / ref_range_high (null in this cohort)",
    "interpretation / is_abnormal (null in this cohort)",
  ];
}
function formatLineageTip(steps){
  if(!steps) return "";
  if(typeof steps==="string") return esc(steps).replace(/\n/g,"<br>").replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
  return steps.map((s,i)=>`<div class="trail-step"><span class="trail-n">${i+1}</span>${esc(s)}</div>`).join("");
}
function lineageBtn(steps){
  if(!steps) return "";
  return `<button type="button" class="trailbtn" aria-label="Data lineage trail">
    <span class="trail-ico">\u29C9</span>
    <span class="trail-tip"><div class="trail-h">Data lineage</div>${formatLineageTip(steps)}</span>
  </button>`;
}
function latestRefRange(points){
  if(!points||!points.length) return null;
  for(let i=points.length-1;i>=0;i--){
    const p=points[i];
    if(p.rl!=null||p.rh!=null) return {low:p.rl,high:p.rh,unit:p.u||""};
  }
  return null;
}
function refRangeText(rr,unit){
  if(rr&&(rr.low!=null&&rr.high!=null)){
    const lo=fmt(rr.low,rr.low%1?1:0), hi=fmt(rr.high,rr.high%1?1:0);
    return `Normal range: <b>${lo}\u2013${hi}</b> ${esc(rr.unit||unit||"")}`+
      `<span class="ref-legend"><i class="ref-lo"></i> low <i class="ref-hi"></i> high</span>`;
  }
  if(rr&&(rr.low!=null||rr.high!=null)){
    const bound=rr.low!=null?`low ${fmt(rr.low)}`:`high ${fmt(rr.high)}`;
    return `Normal range: <b>${bound}</b> ${esc(rr.unit||unit||"")} <span class="muted">(partial)</span>`;
  }
  return `Normal range: <b>${DASH}</b> <span class="muted">(not in warehouse \u2014 green/red lines not drawn)</span>`;
}
function refRangeLegend(spec){
  const rr=spec.refRange||latestRefRange(spec.points);
  return `<div class="chart-ref">${refRangeText(rr,spec.unit)}</div>`;
}
// card title with optional provenance tip
function h3(title,tip){ return `<h3>${esc(title)}${infoTip(tip)}</h3>`; }
// mock-style drill-down from overview cards to a patient workspace screen
function workspaceLink(screen,label="Open Workspace"){
  return `<a class="wlink" href="#" data-workspace="${esc(screen)}">\u2192 ${esc(label)}</a>`;
}
function fmt(n,dec=0){ if(n==null||isNaN(n)) return DASH; return Number(n).toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function initials(name){ const w=(name||"").trim().split(/\s+/); return ((w[0]||"")[0]||"")+((w[1]||"")[0]||"") || "?"; }
function fmtDate(iso){
  if(!iso) return DASH;
  const d=new Date(iso+(iso.length<=10?"T00:00:00":""));
  if(isNaN(d)) return iso;
  return d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});
}
function yearOf(iso){ return iso?String(iso).slice(0,4):DASH; }
function monthsSince(iso){ if(!iso) return null; const d=new Date(iso); if(isNaN(d)) return null; return (Date.now()-d.getTime())/(1000*60*60*24*30.44); }
function cleanCode(s){ return (s||"").split(" [")[0]; }     // strip LOINC method suffix for display

// ---- persistent patient banner (shell chrome — single source for identity + demo/social + visit) ----
function bannerFact(label,value,muted){
  return `<div class="pb-fact"><span class="pb-fact-l">${esc(label)}</span><span class="pb-fact-v${muted?" muted":""}">${value}</span></div>`;
}

async function patientBannerHTML(){
  const pk=CURRENT_PK;
  const [p,dx,carePlan,lastVisit,provider,careTeamN]=await Promise.all([
    patientDetail(pk), primaryDiagnosis(pk),
    q(`SELECT status FROM gold_fact_careplan WHERE patient_key=? AND status='active' LIMIT 1`,[pk]),
    q(`SELECT MAX(d.full_date) dt FROM gold_fact_encounter f
       JOIN gold_dim_date d ON d.date_key=f.admit_date_key WHERE f.patient_key=?`,[pk]),
    q(`SELECT member_name nm FROM gold_bridge_careteam_member
       WHERE patient_key=? AND member_role LIKE '%professional%' AND member_name IS NOT NULL LIMIT 1`,[pk]),
    q(`SELECT COUNT(DISTINCT member_name) n FROM gold_bridge_careteam_member WHERE patient_key=? AND member_name IS NOT NULL`,[pk]),
  ]);
  if(!p) return "";
  const addr=[p.city,p.state,p.postal_code].filter(Boolean).map(esc).join(", ");
  const cpActive=carePlan.length>0;
  const lastDt=lastVisit[0]&&lastVisit[0].dt;
  const teamN=careTeamN[0]&&careTeamN[0].n||0;
  return `<div class="pbanner-pro">
    <div class="pb-row1">
      <div class="pbanner-ava lg">${esc(initials(p.full_name))}</div>
      <div class="pb-identity">
        <h1 class="pbanner-name serif">${esc(p.full_name)}</h1>
        <div class="pbanner-meta">
          <span><b>${p.age_years??DASH}</b> yrs</span><span class="dotsep">\u00B7</span>
          <span>${esc(p.gender||DASH)}</span><span class="dotsep">\u00B7</span>
          <span>MRN <b>${esc(p.mrn||DASH)}</b></span><span class="dotsep">\u00B7</span>
          <span>DOB ${fmtDate(p.birth_date)}</span>
          ${addr?`<span class="dotsep">\u00B7</span><span>${addr}</span>`:""}
          ${p.phone?`<span class="dotsep">\u00B7</span><span>${esc(p.phone)}</span>`:""}
        </div>
        <div class="pbanner-badges">
          <span class="pbadge">Primary Dx: <b>${esc(dx?cleanCode(dx.nm):"Not recorded")}</b></span>
          ${cpActive?`<span class="pbadge pbadge-ok">Care Plan: Active</span>`:`<span class="pbadge pbadge-muted">Care Plan: None active</span>`}
        </div>
      </div>
      <div class="pb-actions">
        <button class="btn btn-pri-sm" disabled title="Coming soon">\u270E Generate Note</button>
        <button class="btn btn-ghost" disabled title="Coming soon">\u2197 Share Record</button>
      </div>
      <div class="p360-score">${healthScoreGaugeHTML()}</div>
    </div>
    <div class="pb-row2">
      <div class="pb-panel">
        <div class="pb-panel-h">Demographics &amp; Social</div>
        <div class="pb-facts">
          ${bannerFact("Language",esc(p.primary_language||DASH))}
          ${bannerFact("Marital Status",esc(p.marital_status||DASH))}
          ${bannerFact("Education","Not recorded",true)}
          ${bannerFact("Transportation","Not recorded",true)}
          ${bannerFact("Financial","Not recorded",true)}
          ${bannerFact("Housing","Not recorded",true)}
        </div>
      </div>
      <div class="pb-panel pb-panel-divider">
        <div class="pb-panel-h">Visit Information</div>
        <div class="pb-facts pb-facts-3">
          ${bannerFact("Last Visit",lastDt?fmtDate(lastDt):DASH)}
          ${bannerFact("Primary Provider",esc(provider[0]&&provider[0].nm||"Not recorded"))}
          ${bannerFact("Care Team",teamN?`${fmt(teamN)} Providers`:"Not recorded")}
        </div>
      </div>
    </div>
  </div>`;
}

function healthScoreGaugeHTML(){
  return `<div class="p360-score-ring" title="Composite health score not in dataset">${DASH}</div>
    <div class="p360-score-lbl">Overall Health ${infoTip("No composite health score exists in the warehouse. Shows \u2014 per schema honesty rules.")}</div>
    <div class="p360-score-risk">Risk Level ${riskPill(null)}</div>`;
}

function seriesTrendTag(series){
  if(!series||series.length<2) return `<span class="tag risk-pending">${DASH}</span>`;
  const a=series[series.length-2].v, b=series[series.length-1].v;
  if(a===b) return `<span class="tag">Stable</span>`;
  return b>a?`<span class="tag ta">\u2191 vs prior</span>`:`<span class="tag tr">\u2193 vs prior</span>`;
}

function labTrendArrow(series,dec=1){
  if(!series||series.length<2) return `<span class="labarr muted">${DASH}</span>`;
  const a=series[series.length-2].v, b=series[series.length-1].v;
  if(b>a) return `<span class="labarr tr">\u2191</span>`;
  if(b<a) return `<span class="labarr tg">\u2193</span>`;
  return `<span class="labarr">\u2013</span>`;
}

// Healthcare display: LOINC, as-of date, ref range —, abnormal flag —
function clinicalStrip(dt,loinc,point){
  const rr=point&&latestRefRange([point]);
  const refTxt=rr&&(rr.low!=null||rr.high!=null)
    ?`${fmt(rr.low,rr.low%1?1:0)}\u2013${fmt(rr.high,rr.high%1?1:0)} ${esc(rr.unit||"")}`.trim():DASH;
  const flag=point&&(point.interp||(point.abn!=null?(point.abn?"Abnormal":"Normal"):null))||DASH;
  return `<div class="clin-strip">
    <span>As of <b>${dt?fmtDate(dt):DASH}</b></span>
    <span>LOINC <b>${esc(loinc||DASH)}</b></span>
    <span>Ref <b>${refTxt}</b></span>
    <span>Flag <b>${esc(flag)}</b></span>
  </div>`;
}

function vitalSparkCard(opts){
  const {label,value,unit,dt,series,color,tip,loinc,chartSpec}=opts;
  const spark=series&&series.length>=2?sparkline(series,color):`<div class="sparkempty" title="Fewer than 2 readings">No trend</div>`;
  const spec=chartSpec||(series&&series.length>=2?{
    type:"line",title:`${label} \u2014 Trend`,tip,points:series,color,yLabel:unit||"Value",timed:true,
    refRange:latestRefRange(series),unit,loinc,lineage:loinc?observationLineage(loinc,label):null,
  }:null);
  if(spec&&!spec.lineage&&loinc) spec.lineage=observationLineage(loinc,label);
  const chartHTML=spec?chartBlock(spark,spec):spark;
  return `<div class="p360-vital">
    <div class="p360-vital-head">
      <span class="p360-vital-lbl">${esc(label)}${infoTip(tip)}</span>
      <div class="p360-vital-spark">${chartHTML}</div>
    </div>
    <div class="p360-vital-val">${value}${unit?` <small class="clin-unit">${esc(unit)}</small>`:""}</div>
    ${clinicalStrip(dt,loinc,series&&series.length?series[series.length-1]:null)}
    <div class="p360-vital-foot">${seriesTrendTag(series)}<span class="muted">vs prior reading</span></div>
  </div>`;
}

function labResultRow(lbl,code,unit,v,dt,series,dec){
  const last=series&&series.length?series[series.length-1]:null;
  const rr=last&&latestRefRange([last]);
  const refTxt=rr&&(rr.low!=null||rr.high!=null)?`${fmt(rr.low)}–${fmt(rr.high)}`:DASH;
  const flag=last&&(last.interp||(last.abn!=null?(last.abn?"Abnormal":"Normal"):null))||DASH;
  const spec=series&&series.length>=2?{
    type:"line",title:`${lbl} (LOINC ${code})`,tip:METRIC_PROV[code]||`LOINC ${code} from gold_fact_observation.`,
    points:series,color:"#0d9488",yLabel:unit,timed:true,loinc:code,lineage:observationLineage(code,lbl),
  }:null;
  const mini=series&&series.length>=2?chartBlock(sparkline(series,"#0d9488"),spec):`<span class="labarr muted">${DASH}</span>`;
  return `<div class="p360-labitem">
    <div class="p360-row">
      <span><b>${esc(lbl)}</b><span class="loinc-tag">LOINC ${esc(code)}</span></span>
      <span class="p360-labv"><b>${v}</b> <small>${esc(unit)}</small> ${labTrendArrow(series,dec)}</span>
    </div>
    <div class="p360-labmeta"><span>As of ${dt?fmtDate(dt):DASH}</span><span>Ref <b>${refTxt}</b></span><span>Flag <b>${esc(flag)}</b></span>${mini}</div>
  </div>`;
}

// ---- patient header (compact, used by most screens) ----
async function compactHeader(extraCardsHTML=""){
  if(APP_MODE==="patient"){
    if(!extraCardsHTML) return "";
    return `<div class="metric-row">${extraCardsHTML}</div>`;
  }
  const p = await patientDetail();
  const dx = await primaryDiagnosis();
  if(!p) return "";
  return `<div class="hdr">
    <div class="ava">${esc(initials(p.full_name))}</div>
    <div class="hmain">
      <div class="nm">${esc(p.full_name)}</div>
      <div class="meta">
        <span>\u{1F464} <b>${p.age_years??DASH}</b> yrs</span>
        <span>\u2641 ${esc(p.gender||DASH)}</span>
        <span>\u{1F194} MRN ${esc(p.mrn||DASH)}</span>
        <span>\u{1F382} DOB ${fmtDate(p.birth_date)}</span>
        ${p.city?`<span>\u{1F4CD} ${esc(p.city)}${p.state?", "+esc(p.state):""}</span>`:""}
      </div>
      <div class="dx">Primary Dx: <b>${esc(dx?cleanCode(dx.nm):"Not recorded")}</b></div>
    </div>
    <div class="hcards">${extraCardsHTML}</div>
  </div>`;
}

// ---- patient header (big, Overview) with action buttons ----
async function bigHeader(){
  if(APP_MODE==="patient") return "";
  const p = await patientDetail();
  const dx = await primaryDiagnosis();
  if(!p) return "";
  return `<div class="hdr">
    <div class="ava big">${esc(initials(p.full_name))}</div>
    <div class="hmain">
      <div class="nm xl">${esc(p.full_name)}</div>
      <div class="meta">
        <span>\u{1F464} <b>${p.age_years??DASH}</b> yrs</span>
        <span>\u2641 ${esc(p.gender||DASH)}</span>
        <span>\u{1F194} MRN ${esc(p.mrn||DASH)}</span>
        <span>\u{1F382} ${fmtDate(p.birth_date)}</span>
        ${p.city?`<span>\u{1F4CD} ${esc(p.city)}${p.state?", "+esc(p.state):""}</span>`:""}
      </div>
      <div class="dx">Primary Dx: <b>${esc(dx?cleanCode(dx.nm):"Not recorded")}</b></div>
    </div>
    <div class="hactions">
      <button class="btn pri" disabled title="Coming soon">\u270E Generate Note</button>
      <button class="btn" disabled title="Coming soon">\u2197 Share Record</button>
    </div>
  </div>`;
}

// ---- summary stat cards (top-right of most screens) ----
// items: [{label, value, sub}]
function statCards(items){
  return items.map(it=>`<div class="scard">
    <div class="sl">${esc(it.label)}${infoTip(it.tip)}</div>
    <div class="sv">${it.value}</div>
    <div class="ss">${esc(it.sub||"")}</div>
  </div>`).join("");
}

// ---- generic table ----
function tableHTML(headers, rows, opts={}){
  const align = opts.align||[];
  const head = headers.map((h,i)=>`<th${align[i]?` style="text-align:${align[i]}"`:""}>${esc(h)}</th>`).join("");
  if(!rows.length){
    return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>
      <tr><td colspan="${headers.length}" class="empty">${esc(opts.empty||"No records")}</td></tr></tbody></table></div>`;
  }
  const body = rows.map(r=>`<tr>${r.map((c,i)=>`<td${align[i]?` style="text-align:${align[i]}"`:""}>${c}</td>`).join("")}</tr>`).join("");
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ---- status pill ----
function pill(text,kind){ return `<span class="tag ${kind||""}">${esc(text)}</span>`; }
function statusPill(status){
  const s=(status||"").toLowerCase();
  if(["active","completed","finished","current","final","up to date"].includes(s)) return pill(status||DASH,"tg");
  if(["stopped","entered-in-error","cancelled","inactive","superseded","overdue"].includes(s)) return pill(status||DASH,"tr");
  if(["due","on-hold","intended"].includes(s)) return pill(status||DASH,"ta");
  return pill(status||DASH,"");
}

// ---- complication risk UI (levels computed later — stub returns null) ----
function computeComplicationRisk(/* domainKey, ctx */){ return null; }

function riskLevelStyle(level){
  if(level==="low") return {pct:33,color:"#16a34a",label:"Low"};
  if(level==="medium") return {pct:66,color:"#d97706",label:"Medium"};
  if(level==="high") return {pct:100,color:"#dc2626",label:"High"};
  return {pct:0,color:"#c9d4db",label:DASH};
}
function riskPill(level){
  const s=riskLevelStyle(level);
  if(!level) return `<span class="tag risk-pending">${DASH}</span>`;
  const kind=level==="low"?"tg":level==="medium"?"ta":"tr";
  return pill(s.label,kind);
}
function riskBarRow(label,level,driver){
  const s=riskLevelStyle(level);
  const trackTip=level?"":"Risk model pending";
  return `<div class="crow riskrow">
    <span class="risklbl">${esc(label)}</span>
    ${driver?`<span class="riskdrv muted">${esc(driver)}</span>`:'<span class="riskdrv"></span>'}
    <div class="risk-track"${trackTip?` title="${esc(trackTip)}"`:""}><div class="risk-fill" style="width:${s.pct}%;background:${s.color}"></div></div>
    <span class="lvl" style="color:${level?s.color:"var(--faint)"}">${esc(s.label)}</span>
  </div>`;
}
function riskDriverText(key,latest){
  if(key==="kidney"&&latest.egfr&&latest.egfr.v!=null) return `eGFR ${fmt(latest.egfr.v,0)}`;
  if(key==="cv"){
    if(latest.ldl&&latest.ldl.v!=null) return `LDL ${fmt(latest.ldl.v,0)}`;
    if(latest.sbp&&latest.sbp.v!=null) return `BP ${fmt(latest.sbp.v,0)}`;
  }
  return "";
}

// ---- empty state ----
function emptyCard(title,sub,icon="\u{1F5C2}"){
  return `<div class="estate">
    <div class="eicon">${icon}</div>
    <div class="etitle">${esc(title)}</div>
    <div class="esub">${esc(sub||"")}</div>
  </div>`;
}

// ---- footer ----
function footer(){
  return `<div class="foot">Data source: diahealth_compact_full.db &middot; Model: Medallion Gold &middot; ${PATIENTS.length} patients &middot; Live data</div>`;
}

// ================= CHARTS (inline SVG, with axes) =================

function fmtShort(iso){ if(!iso) return ""; const d=new Date(iso+(String(iso).length<=10?"T00:00:00":""));
  if(isNaN(d)) return String(iso); return d.toLocaleDateString("en-US",{month:"short",year:"2-digit"}); }
function niceNum(x,round){ if(x<=0) return 1; const exp=Math.floor(Math.log10(x)),f=x/Math.pow(10,exp);
  let nf; if(round){ nf=f<1.5?1:f<3?2:f<7?5:10; } else { nf=f<=1?1:f<=2?2:f<=5?5:10; } return nf*Math.pow(10,exp); }
function axisTicks(min,max,n=4){ if(min===max){ min-=1; max+=1; } const range=niceNum(max-min,false);
  const step=niceNum(range/n,true); const lo=Math.floor(min/step)*step, hi=Math.ceil(max/step)*step;
  const ticks=[]; for(let v=lo;v<=hi+step*0.5;v+=step) ticks.push(+v.toFixed(6)); return ticks; }

// single-series line chart with labeled X/Y axes, gridlines, optional reference band
function lineChartSVG(series,color="#0d9488",opts={}){
  if(!series||!series.length) return `<div class="chartempty">No readings</div>`;
  const W=opts.w||560,H=opts.h||210, compact=opts.compact||H<150;
  const mL=compact?34:48, mR=14, mT=compact?8:12, mB=compact?22:30;
  const pw=W-mL-mR, ph=H-mT-mB;
  const vals=series.map(p=>p.v);
  const ref=opts.refRange||latestRefRange(series);
  let dmin=Math.min(...vals),dmax=Math.max(...vals);
  if(ref&&ref.low!=null) dmin=Math.min(dmin,ref.low);
  if(ref&&ref.high!=null) dmax=Math.max(dmax,ref.high);
  if(opts.target!=null){ dmin=Math.min(dmin,opts.target); dmax=Math.max(dmax,opts.target); }
  const ticks=axisTicks(dmin,dmax,compact?3:4); const lo=ticks[0],hi=ticks[ticks.length-1];
  const dec=Math.abs(hi)<10?1:0;
  const x=i=>mL+(series.length===1?pw/2:(i/(series.length-1))*pw);
  const y=v=>mT+ph-((v-lo)/(hi-lo))*ph;
  const grid=ticks.map(t=>`<line x1="${mL}" y1="${y(t).toFixed(1)}" x2="${mL+pw}" y2="${y(t).toFixed(1)}" stroke="#eef3f6"/>`+
    `<text x="${mL-6}" y="${(y(t)+3).toFixed(1)}" font-size="9" fill="#8595a0" text-anchor="end">${fmt(t,dec)}</text>`).join("");
  const maxX=compact?4:6, step=Math.max(1,Math.ceil(series.length/maxX));
  let xl=""; for(let i=0;i<series.length;i+=step) xl+=`<text x="${x(i).toFixed(1)}" y="${H-8}" font-size="9" fill="#8595a0" text-anchor="middle">${fmtShort(series[i].dt)}</text>`;
  const axes=`<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${mT+ph}" stroke="#c9d4db"/><line x1="${mL}" y1="${(mT+ph).toFixed(1)}" x2="${mL+pw}" y2="${(mT+ph).toFixed(1)}" stroke="#c9d4db"/>`;
  let refSVG="";
  if(ref&&(ref.low!=null||ref.high!=null)){
    if(ref.low!=null&&ref.high!=null){
      const yTop=y(Math.max(ref.low,ref.high)), yBot=y(Math.min(ref.low,ref.high));
      refSVG+=`<rect x="${mL}" y="${yTop.toFixed(1)}" width="${pw}" height="${Math.max(1,yBot-yTop).toFixed(1)}" fill="#16a34a" opacity="0.12"/>`;
    }
    if(ref.high!=null){
      const yh=y(ref.high).toFixed(1);
      refSVG+=`<line x1="${mL}" y1="${yh}" x2="${mL+pw}" y2="${yh}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.85"/>
        <text x="${mL+pw-2}" y="${(+yh-3).toFixed(1)}" font-size="8" fill="#dc2626" text-anchor="end">high</text>`;
    }
    if(ref.low!=null){
      const yl=y(ref.low).toFixed(1);
      refSVG+=`<line x1="${mL}" y1="${yl}" x2="${mL+pw}" y2="${yl}" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.85"/>
        <text x="${mL+pw-2}" y="${(+yl+10).toFixed(1)}" font-size="8" fill="#16a34a" text-anchor="end">low</text>`;
    }
  }
  const tline=opts.target!=null?`<line x1="${mL}" y1="${y(opts.target).toFixed(1)}" x2="${mL+pw}" y2="${y(opts.target).toFixed(1)}" stroke="#d97706" stroke-dasharray="4 4"/>`:"";
  const path=series.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area=`M${x(0).toFixed(1)} ${(mT+ph).toFixed(1)} `+series.map((p,i)=>`L${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ")+` L${x(series.length-1).toFixed(1)} ${(mT+ph).toFixed(1)} Z`;
  const dots=series.length<=80?series.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.2" fill="${color}"><title>${fmtDate(p.dt)}: ${fmt(p.v,2)}</title></circle>`).join(""):"";
  const yTitle=opts.yLabel?`<text x="11" y="${(mT+ph/2).toFixed(1)}" font-size="9" fill="#8595a0" text-anchor="middle" transform="rotate(-90 11 ${(mT+ph/2).toFixed(1)})">${esc(opts.yLabel)}</text>`:"";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="height:${H}px" class="chart">${grid}${axes}${refSVG}${tline}`+
    `<path d="${area}" fill="${color}" opacity="0.07"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>${dots}${xl}${yTitle}</svg>`;
}

// tiny sparkline (no axes by design)
function sparkline(series,color="#0d9488"){
  if(!series||series.length<2) return `<div class="sparkempty"></div>`;
  const W=120,H=30; const vals=series.map(p=>p.v); let mn=Math.min(...vals),mx=Math.max(...vals); if(mn===mx){mn-=1;mx+=1;}
  const x=i=>(i/(series.length-1))*W, y=v=>H-2-((v-mn)/(mx-mn))*(H-4);
  const path=series.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" class="spark" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
}

// multi-metric trends as axed small-multiples (each in its own real units/scale)
// seriesList: [{name, color, dec, unit, points:[{dt,v}]}]
// opts: {big, months, hidden:Set<name>}
function multiLineSVG(seriesList,opts={}){
  let valid=seriesList.filter(s=>s.points&&s.points.length);
  if(opts.hidden) valid=valid.filter(s=>!opts.hidden.has(s.name));
  if(!valid.length) return `<div class="chartempty">No readings</div>`;
  const big=!!opts.big, cw=big?470:330, chh=big?250:152;
  return `<div class="trendgrid${big?" big":""}">`+valid.map(s=>{
    let pts=s.points; if(opts.months) pts=sliceByMonths(pts,opts.months,opts.anchor);
    const last=pts[pts.length-1];
    const rr=latestRefRange(s.points);
    const refLbl=rr&&(rr.low!=null&&rr.high!=null)?`${fmt(rr.low)}–${fmt(rr.high)}`:DASH;
    return `<div class="tgcell"><div class="tgtop"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b>${fmt(last.v,s.dec??1)}</b></div>`+
      `<div class="tgref muted">${refLbl}</div>`+
      lineChartSVG(pts,s.color,{w:cw,h:chh,compact:!big,yLabel:s.unit,refRange:rr})+`</div>`;
  }).join("")+`</div>`;
}

// vertical bar chart with axes. data: [{label, value}]
function barChartSVG(data,color="#0d9488",opts={}){
  if(!data||!data.length) return `<div class="chartempty">No data</div>`;
  const W=opts.w||560,H=opts.h||210, mL=40,mR=12,mT=10,mB=34;
  const pw=W-mL-mR, ph=H-mT-mB;
  const mx=Math.max(...data.map(d=>d.value),1); const ticks=axisTicks(0,mx,4); const hi=ticks[ticks.length-1];
  const y=v=>mT+ph-(v/hi)*ph;
  const grid=ticks.map(t=>`<line x1="${mL}" y1="${y(t).toFixed(1)}" x2="${mL+pw}" y2="${y(t).toFixed(1)}" stroke="#eef3f6"/>`+
    `<text x="${mL-6}" y="${(y(t)+3).toFixed(1)}" font-size="9" fill="#8595a0" text-anchor="end">${fmt(t)}</text>`).join("");
  const bw=pw/data.length, maxLab=Math.max(1,Math.ceil(data.length/12));
  let bars="",labels="";
  data.forEach((d,i)=>{ const h=(d.value/hi)*ph, bx=mL+i*bw+bw*0.15, by=mT+ph-h, w=bw*0.7;
    bars+=`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0,h).toFixed(1)}" rx="1.5" fill="${color}"><title>${esc(d.label)}: ${fmt(d.value)}</title></rect>`;
    if(i%maxLab===0) labels+=`<text x="${(bx+w/2).toFixed(1)}" y="${H-12}" font-size="8.5" fill="#8595a0" text-anchor="middle">${esc(d.label)}</text>`; });
  const axes=`<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${mT+ph}" stroke="#c9d4db"/><line x1="${mL}" y1="${(mT+ph).toFixed(1)}" x2="${mL+pw}" y2="${(mT+ph).toFixed(1)}" stroke="#c9d4db"/>`;
  const yTitle=opts.yLabel?`<text x="10" y="${(mT+ph/2).toFixed(1)}" font-size="9" fill="#8595a0" text-anchor="middle" transform="rotate(-90 10 ${(mT+ph/2).toFixed(1)})">${esc(opts.yLabel)}</text>`:"";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="height:${H}px" class="chart">${grid}${axes}${bars}${labels}${yTitle}</svg>`;
}

// horizontal bars. data: [{label, value, pct}]
function hbarsSVG(data,color="#0d9488"){
  if(!data||!data.length) return `<div class="empty">No data</div>`;
  const mx=Math.max(...data.map(d=>d.value),1);
  return `<div class="hbars">${data.map(d=>`
    <div class="hbar">
      <span class="hl">${esc(d.label)}</span>
      <span class="ht"><span class="hf" style="width:${(d.value/mx*100).toFixed(1)}%;background:${color}"></span></span>
      <span class="hv">${fmt(d.value)}${d.pct!=null?` <small>(${d.pct}%)</small>`:""}</span>
    </div>`).join("")}</div>`;
}

// donut chart. segments: [{label,value,color}]
function donutSVG(segments,centerLabel,centerSub){
  const total=segments.reduce((a,s)=>a+s.value,0);
  if(!total) return `<div class="empty">No data</div>`;
  const R=54,C=2*Math.PI*R; let off=0;
  const arcs=segments.map(s=>{
    const frac=s.value/total, len=frac*C;
    const seg=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="20"
      stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
      transform="rotate(-90 70 70)"/>`;
    off+=len; return seg;
  }).join("");
  const legend=segments.map(s=>`<div class="dlg"><i style="background:${s.color}"></i>${esc(s.label)}
    <b>${fmt(s.value)}</b> <small>(${Math.round(s.value/total*100)}%)</small></div>`).join("");
  return `<div class="donutwrap">
    <svg viewBox="0 0 140 140" class="donut">${arcs}
      <text x="70" y="68" text-anchor="middle" font-size="20" font-weight="700" fill="#13344b">${esc(centerLabel||fmt(total))}</text>
      <text x="70" y="84" text-anchor="middle" font-size="9" fill="#8595a0">${esc(centerSub||"Total")}</text>
    </svg>
    <div class="dlegend">${legend}</div>
  </div>`;
}

// ================= CHART ZOOM / SLICE-AND-DICE =================
// Every chart is wrapped with chartBlock(inlineHTML, spec). The inline (small)
// chart is shown as-is; the zoom button opens a large modal with controls
// (date range, series toggles) + an underlying data table for traceability.

const CHART_REG = {};
let CHART_SEQ = 0;
const MODAL_RANGES = [{label:"1Y",m:12},{label:"2Y",m:24},{label:"5Y",m:60},{label:"All",m:0}];

function parseChartDate(iso){
  if(!iso) return null;
  const s=String(iso);
  const d=new Date(s.length<=10?s+"T12:00:00":s);
  return isNaN(d)?null:d;
}
function latestInPoints(points){
  let t=0;
  for(const p of points||[]){
    const d=parseChartDate(p.dt);
    if(d&&d.getTime()>t) t=d.getTime();
  }
  return t||Date.now();
}
function chartDataAnchor(spec){
  if(!spec) return Date.now();
  if(spec.type==="line") return latestInPoints(spec.points);
  if(spec.type==="multiline") return latestInPoints((spec.series||[]).flatMap(s=>s.points||[]));
  return Date.now();
}
function sliceByMonths(points,months,anchor){
  if(!months) return points||[];
  const end=anchor||Date.now();
  const cut=end-months*30.44*24*3600*1000;
  return (points||[]).filter(p=>{ const d=parseChartDate(p.dt); return d&&d.getTime()>=cut&&d.getTime()<=end; });
}

// wrap a rendered chart with lineage trail (hover) + expand. spec describes modal data.
function chartBlock(innerHTML, spec={}){
  const id="ch"+(++CHART_SEQ);
  if(!spec.refRange&&spec.points) spec.refRange=latestRefRange(spec.points);
  if(spec.type==="multiline"&&!spec.refRange) spec.refRange=latestRefRange(spec.series&&spec.series[0]&&spec.series[0].points);
  if(!spec.lineage){
    if(spec.loinc) spec.lineage=observationLineage(spec.loinc,spec.title);
    else if(spec.tip) spec.lineage=[spec.tip];
  }
  CHART_REG[id]=spec;
  const tools=`<div class="charttools">${lineageBtn(spec.lineage)}<button class="zoombtn" data-chart="${id}" title="Expand & analyze" aria-label="Expand chart">\u26F6</button></div>`;
  const showRef=spec.type==="line"||spec.type==="multiline";
  return `<div class="chartblock">${tools}${showRef?refRangeLegend(spec):""}${innerHTML}</div>`;
}

function chartTableHTML(spec,st){
  if(spec.type==="line"){
    const pts=sliceByMonths(spec.points||[],st.months,st.anchor).slice().reverse();
    return tableHTML(["Date",spec.yLabel||"Value","Reference","Flag"],
      pts.map(p=>[fmtDate(p.dt),`<b>${fmt(p.v,2)}</b>`,
        p.rl!=null||p.rh!=null?`${fmt(p.rl)}–${fmt(p.rh)}`:DASH,
        p.interp||p.abn?esc(p.interp||(p.abn?"Abnormal":"Normal")):DASH]),
      {align:["","right","right","right"],empty:"No readings"});
  }
  if(spec.type==="multiline"){
    const list=(spec.series||[]).filter(s=>!st.hidden.has(s.name));
    const maps=list.map(s=>{ const m={}; sliceByMonths(s.points,st.months,st.anchor).forEach(p=>m[p.dt]=p); return m; });
    const dates=[...new Set([].concat(...maps.map(m=>Object.keys(m))))].sort().reverse();
    const rows=dates.map(dt=>[fmtDate(dt),...list.map((s,i)=>{ const p=maps[i][dt];
      return p?`${fmt(p.v,s.dec??1)} <small class="muted">${p.rl!=null||p.rh!=null?"ref "+fmt(p.rl)+"-"+fmt(p.rh):DASH}</small>`:DASH; })]);
    return tableHTML(["Date",...list.map(s=>s.name)],rows,{empty:"No readings"});
  }
  if(spec.type==="bar"||spec.type==="hbars"){
    const d=spec.data||[];
    return tableHTML([spec.xLabel||"Category",spec.yLabel||"Value"],d.map(x=>[esc(x.label),`<b>${fmt(x.value)}</b>`]),{align:["","right"],empty:"No data"});
  }
  if(spec.type==="donut"){
    const segs=spec.segments||[]; const tot=segs.reduce((a,s)=>a+s.value,0)||1;
    return tableHTML(["Segment","Count","Share"],segs.map(s=>[esc(s.label),fmt(s.value),`${Math.round(s.value/tot*100)}%`]),{align:["","right","right"],empty:"No data"});
  }
  if(spec.type==="custom"){
    if(!spec.tableRows||!spec.tableRows.length) return "";
    return tableHTML(spec.tableHeads||[],spec.tableRows.map(r=>r.map(c=>esc(c))),{});
  }
  return "";
}

function chartBigHTML(spec,st){
  if(spec.type==="multiline"){
    const list=(spec.series||[]).filter(s=>!st.hidden.has(s.name));
    return multiLineSVG(list,{big:true,months:st.months,anchor:st.anchor});
  }
  if(spec.type==="line"){
    const pts=sliceByMonths(spec.points||[],st.months,st.anchor);
    return lineChartSVG(pts,spec.color||"#0d9488",{w:1000,h:430,yLabel:spec.yLabel,refRange:spec.refRange});
  }
  if(spec.type==="bar")  return barChartSVG(spec.data||[],spec.color||"#0d9488",{w:1000,h:430,yLabel:spec.yLabel});
  if(spec.type==="hbars")return `<div class="bighbars">${hbarsSVG(spec.data||[],spec.color||"#0d9488")}</div>`;
  if(spec.type==="donut")return `<div class="bigdonut">${donutSVG(spec.segments||[],spec.center,spec.centerSub)}</div>`;
  if(spec.type==="custom")return `<div class="bigcustom">${spec.big||""}</div>`;
  return "";
}

function ensureModalRoot(){
  let r=document.getElementById("chartmodal");
  if(!r){
    r=document.createElement("div"); r.id="chartmodal"; r.className="cmodal";
    r.innerHTML=`<div class="cmback"></div><div class="cmwin" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(r);
    r.querySelector(".cmback").onclick=closeChartModal;
    const win=r.querySelector(".cmwin");
    win.addEventListener("click",(e)=>{
      if(!r.classList.contains("open")||!r._chartSt||!r._chartDraw) return;
      e.stopPropagation();
      const st=r._chartSt, draw=r._chartDraw, spec=r._chartSpec;
      const closeBtn=e.target.closest("[data-role=close]");
      if(closeBtn){ closeChartModal(); return; }
      const rb=e.target.closest('[data-role="range"] button');
      if(rb){ st.months=Number(rb.dataset.m)||0; draw(); return; }
      const sb=e.target.closest('[data-role="series"] button');
      if(sb&&spec){
        const n=sb.dataset.s;
        if(st.hidden.has(n)) st.hidden.delete(n);
        else if((spec.series.length-st.hidden.size)>1) st.hidden.add(n);
        draw(); return;
      }
      const tb=e.target.closest('[data-role="table"]');
      if(tb){ st.table=!st.table; draw(); }
    });
  }
  return r;
}
function closeChartModal(){
  const r=document.getElementById("chartmodal");
  if(r){ r.classList.remove("open"); r._chartSt=null; r._chartSpec=null; r._chartDraw=null; }
}

function openChartModal(id){
  const spec=CHART_REG[id]; if(!spec) return;
  const root=ensureModalRoot(), win=root.querySelector(".cmwin");
  const isMulti=spec.type==="multiline", isLine=spec.type==="line";
  const timed=(isMulti||isLine)&&spec.timed!==false;
  const anchor=chartDataAnchor(spec);
  const st={ months:0, hidden:new Set(), table:false, anchor };
  function controls(){
    let h="";
    if(timed){
      const anchorLbl=anchor?fmtDate(new Date(anchor).toISOString().slice(0,10)):"";
      h+=`<div class="cmgroup"><span class="cmlbl">Range</span><div class="rangebtns" data-role="range">`+
        MODAL_RANGES.map(r=>`<button type="button" data-m="${r.m}" class="${Number(r.m)===st.months?"on":""}">${r.label}</button>`).join("")+
        `</div>${anchorLbl?`<span class="muted cm-anchor">ending ${anchorLbl}</span>`:""}</div>`;
    }
    if(isMulti) h+=`<div class="cmgroup"><span class="cmlbl">Metrics</span><div class="serieschips" data-role="series">`+
      (spec.series||[]).map(s=>{
        const nm=String(s.name).replace(/"/g,"&quot;");
        return `<button type="button" class="chip ${st.hidden.has(s.name)?"off":"on"}" data-s="${nm}"><i style="background:${s.color}"></i>${esc(s.name)}</button>`;
      }).join("")+`</div></div>`;
    h+=`<button type="button" class="btn dtbtn ${st.table?"pri":""}" data-role="table" style="margin-left:auto">${st.table?"Hide data table":"Show data table"}</button>`;
    return `<div class="cmtools">${h}</div>`;
  }
  function draw(){
    const refNote=(spec.type==="line"||spec.type==="multiline")?`<div class="chart-ref cm-ref">${refRangeText(spec.refRange,spec.unit)}</div>`:"";
    const trail=spec.lineage?`<div class="cm-trail">${lineageBtn(spec.lineage)}<span class="muted">Hover for data trail</span></div>`:"";
    win.innerHTML=`<div class="cmhead"><h3>${esc(spec.title||"Chart")}${infoTip(spec.tip)}</h3>`+
      `<button type="button" class="cmx" data-role="close" aria-label="Close">\u2715</button></div>`+
      trail+refNote+controls()+`<div class="cmbody">${chartBigHTML(spec,st)}</div>`+
      (st.table?`<div class="cmtable">${chartTableHTML(spec,st)}</div>`:"");
  }
  root._chartSt=st; root._chartSpec=spec; root._chartDraw=draw;
  draw();
  root.classList.add("open");
}
