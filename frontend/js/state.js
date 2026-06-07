// state.js — shared globals + navigation + display dictionaries. Loaded first.
// NOTE: per project decisions, names/IDs are shown RAW (exactly as stored), and
// no reference ranges / abnormal flags are invented (the warehouse has none).

// ---- navigation (from mock: portal sidebar + patient top tabs) ----
const PORTAL_NAV = [
  ["dashboard","Dashboard","\u2302"],
  ["patients","Patients","\u{1F465}"],
  ["population","Population","\u{1F4CA}"],
  ["portal-reports","Reports","\u{1F4C4}"],
  ["admin","Admin","\u{1F6E1}"],
  ["settings","Settings","\u2699"],
];

// Patient workspace top nav — group tabs + mega-menu items [screen, caption, icon]
const PATIENT_TABS = [
  {id:"overview", label:"Overview", screen:"patient360"},
  {id:"care", label:"Care", default:"caregaps", children:[
    ["caregaps","Care Gaps","\u{1F4CB}"],["complications","Complications","\u{1F9A0}"],
    ["careteam","Care Team","\u{1F465}"],
  ]},
  {id:"clinical", label:"Clinical", default:"medications", children:[
    ["medications","Medications","\u{1F48A}"],["labs","Labs","\u{1F9EA}"],
    ["procedures","Procedures","\u2695"],["devices","Devices","\u{1F4F1}"],
    ["allergies","Allergies","\u26A0"],["immunizations","Immunizations","\u{1F489}"],
    ["documents","Documents","\u{1F4C4}"],
  ]},
  {id:"timeline", label:"Timeline", default:"timeline", children:[
    ["timeline","Care Journey","\u{1F4C5}"],["encounters","Encounters","\u{1F3E5}"],
  ]},
  {id:"analytics", label:"Analytics", default:"trends", children:[
    ["trends","Trends","\u{1F4C8}"],["complications","Risk & Complications","\u{1F4CA}"],
  ]},
  {id:"coordination", label:"Coordination", default:"careteam", children:[
    ["careteam","Care Team","\u{1F465}"],["encounters","Encounters","\u{1F3E5}"],
    ["reports","Reports","\u{1F4DD}"],
  ]},
];

const PORTAL_TITLES = {
  dashboard:"Dashboard", patients:"Patients", population:"Population",
  "portal-reports":"Reports", admin:"Admin", settings:"Settings",
};
const PORTAL_SUBTITLES = {
  dashboard:"Overview of your patient population and care operations.",
  patients:"Search and open a patient clinical workspace.",
  population:"Descriptive cohort statistics for the diabetes panel.",
  "portal-reports":"Diagnostic reports across the cohort.",
  admin:"User, role, and organization configuration.",
  settings:"Application preferences and workspace settings.",
};

function tabForScreen(screen){
  for(const t of PATIENT_TABS){
    if(t.screen===screen) return t.id;
    if(t.children) for(const [sid] of t.children) if(sid===screen) return t.id;
  }
  return null;
}
function captionForScreen(screen){
  for(const t of PATIENT_TABS){
    if(t.screen===screen) return t.label;
    if(t.children) for(const [sid,cap] of t.children) if(sid===screen) return cap;
  }
  return screen;
}

// the standard 6 metric tiles: [key, label, unit, LOINC code, decimals]
const METRICS = [
  ["hba1c","HbA1c","%","4548-4",1],
  ["glucose","Avg Glucose","mg/dL","2345-7",0],
  ["egfr","eGFR","mL/min/1.73m\u00B2","33914-3",0],
  ["ldl","LDL Cholesterol","mg/dL","18262-6",0],
  ["sbp","Systolic BP","mmHg","8480-6",0],
  ["creatinine","Creatinine","mg/dL","2160-0",2],
];

// Data-lineage text for the 6 KPI metrics (shown via the "i" provenance affordance)
const METRIC_PROV = {
  "4548-4":"**HbA1c (%)**\nSource: gold_fact_observation \u2192 gold_dim_code on LOINC **4548-4**, dated via gold_dim_date.\nValue = most recent value_numeric (max effective_date) for this patient. Unit from value_unit. No reference range in dataset.",
  "2345-7":"**Avg Glucose (mg/dL)**\nSource: gold_fact_observation \u2192 gold_dim_code on LOINC **2345-7** (Glucose, Serum/Plasma).\nValue = most recent value_numeric for this patient. This is a serum glucose reading, not a CGM-derived average (no CGM data exists).",
  "33914-3":"**eGFR (mL/min/1.73m\u00B2)**\nSource: gold_fact_observation \u2192 gold_dim_code on LOINC **33914-3** (MDRD).\nValue = most recent value_numeric for this patient.",
  "18262-6":"**LDL Cholesterol (mg/dL)**\nSource: gold_fact_observation \u2192 gold_dim_code on LOINC **18262-6** (LDL, direct).\nValue = most recent value_numeric for this patient.",
  "8480-6":"**Systolic BP (mmHg)**\nSource: gold_fact_observation \u2192 gold_dim_code on LOINC **8480-6** (vital-signs).\nValue = most recent value_numeric for this patient.",
  "2160-0":"**Creatinine (mg/dL)**\nSource: gold_fact_observation \u2192 gold_dim_code on LOINC **2160-0** (Serum/Plasma).\nValue = most recent value_numeric for this patient.",
};
const PROV_NO_RANGE = "Reference ranges and abnormal/interpretation flags are empty for all rows in this warehouse, so status is shown as \u2014 rather than fabricated.";
const CLINICAL_STD_NOTE = "Clinical values: LOINC-coded observations from gold_fact_observation, effective date via gold_dim_date. Units from value_unit. Reference range and abnormal flag columns are empty in this warehouse \u2014 displayed as \u2014 per healthcare data honesty rules.";

// Complication risk domains — UI is live; levels are computed later (computeComplicationRisk in ui.js).
const RISK_DOMAINS = [
  {key:"kidney", short:"Kidney", label:"Kidney Disease", icon:"\u{1F9A0}", keywords:["kidney","renal","nephropathy","ckd"]},
  {key:"retina", short:"Retinopathy", label:"Retinopathy", icon:"\u{1F441}", keywords:["retinopathy","retinal"]},
  {key:"neuro", short:"Neuropathy", label:"Neuropathy", icon:"\u26A1", keywords:["neuropathy"]},
  {key:"cv", short:"Cardiovascular", label:"Cardiovascular", icon:"\u2764", keywords:["hypertens","hyperlipidemia","cardiovascular","coronary","ischemic","heart"]},
  {key:"foot", short:"Foot Ulcer", label:"Foot Ulcer", icon:"\u{1F9B6}", keywords:["foot ulcer","diabetic foot","ulcer of"]},
];
const RISK_PENDING_TIP = "Low / Medium / High levels use a rule-based clinical risk model (e.g. eGFR bands, LDL, exam recency, documented conditions). The scoring engine is not enabled yet \u2014 levels show \u2014 until configured. Supporting values beside each row are real readings from the warehouse.";

// FHIR v3 ActCode encounter class -> readable label (display dictionary, not data)
const ENC_CLASS = {
  AMB:"Ambulatory", EMER:"Emergency", IMP:"Inpatient",
  HH:"Home Health", VR:"Virtual", ACUTE:"Acute", NONAC:"Non-acute",
  OBSENC:"Observation", PRENC:"Pre-admission", SS:"Short Stay",
};

// Lab panel grouping for the Labs screen. Maps LOINC code -> [panel, short label].
const LAB_PANELS = {
  "2345-7":["Metabolic Panel","Glucose"],
  "2951-2":["Metabolic Panel","Sodium"],
  "2823-3":["Metabolic Panel","Potassium"],
  "2075-0":["Metabolic Panel","Chloride"],
  "2028-9":["Metabolic Panel","CO2 (Bicarbonate)"],
  "3094-0":["Metabolic Panel","BUN"],
  "2160-0":["Metabolic Panel","Creatinine"],
  "17861-6":["Metabolic Panel","Calcium"],
  "49765-1":["Metabolic Panel","Calcium (Blood)"],
  "1751-7":["Metabolic Panel","Albumin"],
  "4548-4":["Diabetes & Renal","HbA1c"],
  "33914-3":["Diabetes & Renal","eGFR"],
  "14959-1":["Diabetes & Renal","Microalbumin/Creatinine"],
  "18262-6":["Lipid Panel","LDL Cholesterol"],
  "2085-9":["Lipid Panel","HDL Cholesterol"],
  "2571-8":["Lipid Panel","Triglycerides"],
  "2093-3":["Lipid Panel","Total Cholesterol"],
  "1742-6":["Liver Panel","ALT"],
  "1920-8":["Liver Panel","AST"],
  "718-7":["Hematology","Hemoglobin"],
  "4544-3":["Hematology","Hematocrit"],
  "20570-8":["Hematology","Hematocrit (calc)"],
};
const LAB_PANEL_ORDER = ["Diabetes & Renal","Metabolic Panel","Lipid Panel","Liver Panel","Hematology","Urinalysis","Other Labs"];

const CARE_GAPS = [
  {key:"eye",   label:"Eye Exam (Retinopathy Screening)", months:12, kind:"procedure", match:["%retina%","%ophthalmolog%","%eye exam%","%fundus%"]},
  {key:"foot",  label:"Foot Exam (Comprehensive)",        months:12, kind:"procedure", match:["%foot%"]},
  {key:"flu",   label:"Influenza Vaccine",                months:12, kind:"immunization", match:["%influenza%"]},
  {key:"a1c",   label:"HbA1c Testing",                    months:3,  kind:"lab", match:["4548-4"]},
  {key:"ldl",   label:"LDL Cholesterol Monitoring",       months:12, kind:"lab", match:["18262-6"]},
  {key:"kidney",label:"Kidney Monitoring (eGFR)",         months:6,  kind:"lab", match:["33914-3"]},
  {key:"uacr",  label:"Urine Albumin/Creatinine (UACR)",  months:12, kind:"lab", match:["14959-1"]},
  {key:"bp",    label:"Blood Pressure Monitoring",        months:3,  kind:"lab", match:["8480-6"]},
];

let PATIENTS = [];
let CURRENT_PK = null;
let APP_MODE = "portal";       // "portal" | "patient"
let CURRENT_SCREEN = "dashboard";
let SHOW_ALL_PATIENTS = false;
const SCREENS = {};
