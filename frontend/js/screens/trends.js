// Trends & Analytics — multi-metric longitudinal view + per-metric statistics +
// lab panel trends + condition onset timeline. All from real observations.

const TREND_METRICS=[
  ["HbA1c (%)","4548-4","#0d9488",1],
  ["Avg Glucose (mg/dL)","2345-7","#2563eb",0],
  ["Weight (kg)","29463-7","#d97706",1],
  ["eGFR (mL/min/1.73m\u00B2)","33914-3","#16a34a",0],
  ["Systolic BP (mmHg)","8480-6","#9333ea",0],
];
const LAB_TREND_CODES=[
  ["HbA1c (%)","4548-4",1],["eGFR","33914-3",0],["Creatinine (mg/dL)","2160-0",2],
  ["LDL Cholesterol","18262-6",0],["HDL Cholesterol","2085-9",0],["Triglycerides","2571-8",0],
  ["ALT (U/L)","1742-6",0],["AST (U/L)","1920-8",0],
];
const RANGES=[["1Y",12],["2Y",24],["3Y",36],["5Y",60],["All",null]];

function statsOf(series){
  if(!series||!series.length) return null;
  const vals=series.map(p=>p.v);
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  const sd=Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length);
  const min=Math.min(...vals), max=Math.max(...vals);
  const minP=series.find(p=>p.v===min), maxP=series.find(p=>p.v===max);
  return {mean,sd,min,max,minP,maxP,n:vals.length,latest:series[series.length-1]};
}
function sliceRange(series,months){
  if(months==null) return series;
  const cut=Date.now()-months*30.44*24*3600*1000;
  return series.filter(p=>new Date(p.dt).getTime()>=cut);
}

async function renderTrends(el){
  el.innerHTML=`<div class="loading">Loading trends\u2026</div>`;
  const pk=CURRENT_PK;
  const tiles=await Promise.all(METRICS.map(async ([k,label,unit,code,dec])=>{
    const m=await latestMetric(code);
    return {label,code,tip:METRIC_PROV[code],v:m&&m.v!=null?fmt(m.v,dec):DASH,dt:m&&m.dt};
  }));
  const series={};
  await Promise.all(TREND_METRICS.map(async ([nm,code])=>{ series[code]=await metricSeries(code); }));
  const labSeries={};
  await Promise.all(LAB_TREND_CODES.map(async ([nm,code])=>{ labSeries[code]=await metricSeries(code); }));
  const conds=await q(`SELECT c.display nm, MIN(d.full_date) onset FROM gold_fact_condition f
     JOIN gold_dim_code c ON c.code_key=f.condition_code_key
     JOIN gold_dim_date d ON d.date_key=f.onset_date_key
     WHERE f.patient_key=? AND f.is_chronic=1 GROUP BY c.display ORDER BY onset LIMIT 8`,[pk]);

  el.innerHTML=`
    ${await compactHeader(statCards(tiles.slice(0,3).map(t=>({label:t.label,value:t.v,sub:t.dt?fmtDate(t.dt):"No data",tip:t.tip}))))}
    <div class="card pagehead">
      <h2 class="serif">Longitudinal Analytics ${infoTip("Each metric is plotted from gold_fact_observation.value_numeric over effective_date (joined to gold_dim_code by LOINC, dated via gold_dim_date). The range buttons filter the series client-side by date.")}</h2>
      <p class="cardsub">Multi-metric trends over time</p>
      <div class="toolbar">
        <div class="rangebtns" id="range">${RANGES.map(([l],i)=>`<button data-i="${i}" class="${l==="All"?"on":""}">${l}</button>`).join("")}</div>
      </div>
    </div>
    <div class="cols">
      <div class="card"><div id="mainchart"></div></div>
      <div class="card">
        ${h3("Statistics","Computed in-browser from the selected metric's gold_fact_observation series (within the chosen range): mean, latest, min, max, and population standard deviation. % in target is omitted because the dataset has no reference ranges.")}
        <select id="statmetric" class="select">${TREND_METRICS.map(([nm,code])=>`<option value="${code}">${esc(nm)}</option>`).join("")}</select>
        <div id="statbox"></div>
      </div>
    </div>
    <div class="cols">
      <div class="card">${h3("Lab Panel Trends","Each mini-chart is value_numeric over effective_date from gold_fact_observation for one LOINC code (HbA1c 4548-4, eGFR 33914-3, Creatinine 2160-0, LDL 18262-6, HDL 2085-9, Triglycerides 2571-8, ALT 1742-6, AST 1920-8).")}
        <div class="labgrid">${LAB_TREND_CODES.map(([nm,code,dec])=>{
          const s=labSeries[code]; const last=s.length?s[s.length-1]:null;
          return `<div class="labmini"><div class="lmtop"><span>${esc(nm)}</span><b>${last?fmt(last.v,dec):DASH}</b></div>`+
            chartBlock(lineChartSVG(s,"#0d9488",{w:240,h:100,refRange:latestRefRange(s)}),
              {type:"line",title:nm+" \u2014 Trend",tip:"value_numeric over effective_date from gold_fact_observation for this LOINC code.",points:s,color:"#0d9488",yLabel:nm,loinc:code,lineage:observationLineage(code,nm)})+`</div>`;
        }).join("")}</div>
      </div>
      <div class="card">${h3("Condition Onset Timeline","Source: gold_fact_condition where is_chronic=1, earliest onset_date_key per condition (via gold_dim_date). Bars run from diagnosis year to the current year.")}
        <p class="cardsub">Chronic conditions from diagnosis to present</p>
        ${chartBlock(condOnsetHTML(conds),{type:"custom",title:"Condition Onset Timeline",tip:"gold_fact_condition where is_chronic=1, earliest onset per condition. Bars run from diagnosis year to present.",big:condOnsetHTML(conds),tableHeads:["Condition","Onset"],tableRows:conds.filter(c=>c.onset).map(c=>[cleanCode(c.nm),fmtDate(c.onset)])})}
      </div>
    </div>
    ${footer()}`;

  const rangeEl=el.querySelector("#range");
  const statSel=el.querySelector("#statmetric");
  let months=null;
  function drawMain(){
    const unitOf=nm=>(nm.match(/\(([^)]+)\)/)||[])[1]||"";
    const inlineSeries=TREND_METRICS.map(([nm,code,color,dec])=>({name:nm,color,dec,unit:unitOf(nm),points:sliceRange(series[code],months)}));
    const fullSeries=TREND_METRICS.map(([nm,code,color,dec])=>({name:nm,color,dec,unit:unitOf(nm),points:series[code]||[]}));
    el.querySelector("#mainchart").innerHTML=chartBlock(multiLineSVG(inlineSeries),
      {type:"multiline",title:"Longitudinal Analytics",tip:"Each metric is value_numeric over effective_date from gold_fact_observation (joined to gold_dim_code by LOINC). Toggle metrics and date range in the expanded view.",series:fullSeries,
        lineage:["gold_fact_observation","gold_dim_code (LOINC per metric)","gold_dim_date effective_date_key","value_numeric + ref_range columns"]});
  }
  function drawStats(){
    const code=statSel.value||TREND_METRICS[0][1]; const s=sliceRange(series[code]||[],months); const st=statsOf(s);
    const box=el.querySelector("#statbox");
    if(!st){ box.innerHTML=`<div class="empty">No readings in range</div>`; return; }
    box.innerHTML=[
      ["Mean",fmt(st.mean,2)],["Latest",`${fmt(st.latest.v,2)} (${fmtDate(st.latest.dt)})`],
      ["Minimum",`${fmt(st.min,2)} (${fmtDate(st.minP.dt)})`],["Maximum",`${fmt(st.max,2)} (${fmtDate(st.maxP.dt)})`],
      ["Variability (Std Dev)",fmt(st.sd,2)],["# Readings",fmt(st.n)],
    ].map(([k,v])=>`<div class="kv"><span class="kvk">${esc(k)}</span><span class="kvv">${esc(v)}</span></div>`).join("")
     +`<p class="chartnote">% in target not shown \u2014 reference ranges are not available in the dataset.</p>`;
  }
  rangeEl.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    rangeEl.querySelectorAll("button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
    months=RANGES[+b.dataset.i][1]; drawMain(); drawStats();
  });
  statSel.onchange=drawStats;
  drawMain(); drawStats();
}

function condOnsetHTML(conds){
  const dated=conds.filter(c=>c.onset);
  if(!dated.length) return `<div class="empty">No chronic conditions recorded</div>`;
  const years=dated.map(c=>+yearOf(c.onset)); const minY=Math.min(...years), maxY=new Date().getFullYear();
  const span=Math.max(1,maxY-minY);
  return `<div class="onset">${dated.map(c=>{
    const y=+yearOf(c.onset); const left=(y-minY)/span*100;
    return `<div class="onrow">
      <span class="onlbl">${esc(cleanCode(c.nm))}</span>
      <span class="ontrack"><span class="onbar" style="left:${left.toFixed(1)}%;right:0"></span></span>
      <span class="ondate">${fmtDate(c.onset)}</span>
    </div>`;
  }).join("")}<div class="onaxis"><span>${minY}</span><span>${maxY}</span></div></div>`;
}

SCREENS.trends=renderTrends;
