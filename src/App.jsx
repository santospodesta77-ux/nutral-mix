import React, { useState, useMemo, useRef, useEffect } from "react";

// ============================================================
// SMIX · Gestión integral de campos · campaña 26-27
// General Pico, La Pampa
// ============================================================
const TINTA = "#2E2A22";
const CREMA = "#F8F5EC";
const FONDO = "#EFEBDF";
const VERDE = "#43A047";
const NARANJA = "#E08A2B";
const ROJO = "#C0392B";
const AZUL = "#3B82C4";

const COLOR_CV = {
  MAIZ:"#E8B83E","MAIZ 2":"#E8B83E","MAIZ T":"#E8B83E",
  SOJA:"#43A047","SOJA 2":"#43A047",
  GIRASOL:"#D97B29","GIRASOL 2":"#D97B29",
  PASTURA:"#6FA85A", SORGO:"#A8753E", MANI:"#C9A16B",
  CEBADA:"#C9B458", TRIGO:"#D4AF37", CENTENO:"#9C8557",
  AVENA:"#BFB87A", AGROPIRO:"#8DA86E", VERDEO:"#7A8B6F", FINA:"#C9B458",
};
const baseCv = c => c ? c.toUpperCase().replace(/\s*\d+$/,"").replace(/\s*T$/,"").trim() : "";
const colorCv = c => COLOR_CV[baseCv(c)] || COLOR_CV[c?.toUpperCase?.()] || "#DEDBD3";

// ── helpers ─────────────────────────────────────────────────
const fmt  = n => Math.round(n).toLocaleString("es-AR");
const fmt1 = n => (Math.round(n*10)/10).toLocaleString("es-AR",{minimumFractionDigits:1});
const fechaCorta = f => { const[y,m,d]=f.split("-"); return `${d}/${m}/${y.slice(2)}`; };
const diasHasta  = f => Math.round((new Date(f)-new Date("2026-06-30"))/86400000);
const centro = poly => {
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
};
const anchoP = poly => Math.max(...poly.map(p=>p[0]))-Math.min(...poly.map(p=>p[0]));
const haCampo = c => c.lotes.reduce((s,l)=>s+(Number(l.ha)||0),0);

function escalaColor(val,min,max,c1,c2){
  if(val==null||isNaN(val)) return null;
  const t=Math.max(0,Math.min(1,(val-min)/(max-min)));
  const hi=(a,b)=>Math.round(parseInt(a,16)+(parseInt(b,16)-parseInt(a,16))*t);
  const r1=c1.slice(1,3),g1=c1.slice(3,5),b1=c1.slice(5,7);
  const r2=c2.slice(1,3),g2=c2.slice(3,5),b2=c2.slice(5,7);
  return `rgb(${hi(r1,r2)},${hi(g1,g2)},${hi(b1,b2)})`;
}

// ── DATOS: rotación ─────────────────────────────────────────
// 26-27 invierno: sólo lo sembrado hoy (30/6/2026)
const INV_26_FALLBACK = {
  "L3H|4":"TRIGO","L3H|6":"VERDEO","L3H|8":"VERDEO",
  "L3H|9A":"PASTURA","L3H|10O":"CEBADA",
  "L3H|12":"PASTURA","L3H|13G":"CEBADA","L3H|13CH":"CEBADA",
  "L3H|14":"VERDEO","L3H|15":"PASTURA","L3H|16":"PASTURA",
  "L3H|24":"PASTURA","L3H|25":"PASTURA","L3H|30":"AGROPIRO",
  "LA CHOLITA|4":"CEBADA","LA CHOLITA|5":"CEBADA",
  "LOS ABUELOS|5A":"TRIGO","LOS ABUELOS|5B":"TRIGO","LOS ABUELOS|8B":"CENTENO",
  "EL 5|1":"AVENA","EL 5|2":"AVENA",
  "DON ANTONIO|10":"AVENA","DON ANTONIO|11":"AVENA",
  "DOÑA TERESA|6":"CEBADA","LA CUCA|2":"FINA",
};
// 26-27 plan gruesa
const PLAN_2627_FALLBACK = {
  "L3H|1":"MAIZ","L3H|2":"GIRASOL","L3H|3":"SOJA","L3H|5":"PASTURA",
  "L3H|6":"VERDEO-MAIZ","L3H|7":"MAIZ","L3H|8":"VERDEO-MAIZ",
  "L3H|9B":"SOJA","L3H|10O":"CEBADA-MAIZ","L3H|10E":"VERDEO-MAIZ","L3H|11":"PASTURA","L3H|13G":"CEBADA-SOJA",
  "L3H|13CH":"CEBADA-SOJA","L3H|14":"VERDEO-MAIZ","L3H|17":"GIRASOL",
  "L3H|18":"PASTURA","L3H|19":"SOJA","L3H|20":"SOJA","L3H|21N":"SOJA",
  "L3H|21S":"SOJA","L3H|22":"GIRASOL","L3H|23":"CEBADA-GIRASOL", // doble cultivo confirmado
  "L3H|26":"MAIZ","L3H|27":"MAIZ","L3H|28":"GIRASOL","L3H|29":"MAIZ",
  "L3H|4":"TRIGO-SOJA",
  "LA CUCA|1":"SOJA","LA CUCA|2":"FINA","LA CUCA|3N":"MAIZ",
  "LA CHOLITA|1":"GIRASOL","LA CHOLITA|2":"SOJA","LA CHOLITA|3":"MAIZ",
  "LA CHOLITA|4":"CEBADA","LA CHOLITA|5":"CEBADA",
  "EL DESCANSO|1":"MAIZ","EL DESCANSO|2":"SOJA","EL DESCANSO|3":"MAIZ",
  "EL DESCANSO|4":"SOJA","EL DESCANSO|5":"GIRASOL","EL DESCANSO|6":"SOJA",
  "EL DESCANSO|7":"MAIZ","EL DESCANSO|8":"MAIZ",
  "LOS ABUELOS|5A":"TRIGO","LOS ABUELOS|5B":"TRIGO","LOS ABUELOS|8B":"CENTENO",
  "EL 5|1":"AVENA-MAIZ","EL 5|2":"AVENA",
  "DON ANTONIO|10":"AVENA","DON ANTONIO|11":"AVENA","DOÑA TERESA|6":"CEBADA",
};
// 25-26 cultivo por lote
const CULT_2526_FALLBACK = {
  "L3H|1":"SOJA 2","L3H|2":"MAIZ","L3H|3":"MAIZ","L3H|4":"MANI","L3H|5":"GIRASOL",
  "L3H|6":"PASTURA","L3H|7":"MANI","L3H|8":"PASTURA","L3H|9A":"PASTURA","L3H|9B":"MAIZ 2",
  "L3H|10O":"MAIZ","L3H|10E":"SOJA 2","L3H|11":"PASTURA","L3H|12":"GIRASOL","L3H|13G":"GIRASOL",
  "L3H|13CH":"GIRASOL","L3H|14":"PASTURA","L3H|15":"PASTURA","L3H|16":"PASTURA","L3H|17":"SOJA",
  "L3H|18":"GIRASOL 2","L3H|19":"MAIZ 2","L3H|20":"MAIZ","L3H|21N":"MAIZ T","L3H|21S":"MAIZ",
  "L3H|22":"SOJA 2","L3H|23":"SOJA","L3H|24":"PASTURA","L3H|25":"PASTURA","L3H|26":"SOJA 2",
  "L3H|27":"SOJA","L3H|28":"SOJA","L3H|29":"SOJA 2",
  "LA CUCA|1":"MAIZ","LA CUCA|2":"GIRASOL","LA CUCA|3N":"SOJA",
  "LA CHOLITA|1":"SOJA","LA CHOLITA|2":"MAIZ","LA CHOLITA|3":"GIRASOL","LA CHOLITA|4":"GIRASOL","LA CHOLITA|5":"GIRASOL",
  "EL DESCANSO|1":"SOJA","EL DESCANSO|2":"MAIZ","EL DESCANSO|3":"SOJA","EL DESCANSO|4":"MAIZ",
  "EL DESCANSO|5":"MAIZ","EL DESCANSO|6":"MAIZ","EL DESCANSO|7":"GIRASOL","EL DESCANSO|8":"GIRASOL",
  "LA DORA|1":"SOJA","LA DORA|2":"GIRASOL","LA DORA|4":"MAIZ","LA DORA|5":"MAIZ","LA DORA|6":"PASTURA","LA DORA|7":"MAIZ","LA DORA|8":"GIRASOL",
  "LAS TIAS|9":"SORGO","LAS TIAS|10":"MAIZ","LAS TIAS|11":"SOJA","LAS TIAS|12":"PASTURA",
  "LOS ABUELOS|2":"GIRASOL","LOS ABUELOS|3":"GIRASOL","LOS ABUELOS|4":"MAIZ","LOS ABUELOS|6C":"MAIZ",
  "LOS ABUELOS|7B":"MAIZ","LOS ABUELOS|8A":"MAIZ","LOS ABUELOS|8B":"MAIZ","LOS ABUELOS|3O":"MAIZ",
  "LA MARIA OLIVA|2":"MAIZ","LA MARIA OLIVA|3":"MAIZ","LA MARIA OLIVA|FRANJA 1":"MAIZ","LA MARIA OLIVA|FRANJA 2":"MAIZ",
  "EL 5|1":"MAIZ","EL 5|2":"SORGO","EL 5|4":"PASTURA",
  "LA FLECHA|1":"SORGO","LA FLECHA|2":"SORGO","LA FLECHA|3":"MAIZ","LA FLECHA|4":"MAIZ","LA FLECHA|5":"MAIZ",
  "DON ANTONIO|2":"GIRASOL","DON ANTONIO|3":"PASTURA","DON ANTONIO|4":"PASTURA","DON ANTONIO|7":"PASTURA",
  "DON ANTONIO|9":"MAIZ","DON ANTONIO|10":"SORGO","DON ANTONIO|11":"SORGO","DON ANTONIO|14":"MAIZ",
  "DOÑA TERESA|1":"MAIZ","DOÑA TERESA|2":"MAIZ","DOÑA TERESA|4":"GIRASOL","DOÑA TERESA|5":"PASTURA",
  "DOÑA TERESA|6":"GIRASOL","DOÑA TERESA|7":"PASTURA","DOÑA TERESA|8":"SORGO","DOÑA TERESA|9":"PASTURA",
  "EL TORELLO|1":"MAIZ","EL TORELLO|2":"PASTURA","EL TORELLO|3":"PASTURA","EL TORELLO|5":"SORGO",
  "EL TORELLO|6":"MAIZ","EL TORELLO|7":"MAIZ","EL TORELLO|8":"MAIZ","EL TORELLO|9":"PASTURA",
  "DON RAMON|1":"SORGO","DON RAMON|2":"SORGO","DON RAMON|3":"SORGO","DON RAMON|5":"GIRASOL","DON RAMON|6":"MAIZ",
  "EL ABUELO|1":"MAIZ 2","EL ABUELO|2":"GIRASOL","EL ABUELO|3":"MAIZ 2","EL ABUELO|4":"GIRASOL","EL ABUELO|5":"GIRASOL",
  "LOS NIETOS|2":"MAIZ","LOS NIETOS|4":"MAIZ","LOS NIETOS|5":"MAIZ","LOS NIETOS|7":"MAIZ","LOS NIETOS|9":"GIRASOL","LOS NIETOS|11":"MAIZ",
  "EL CIPRES|1":"SORGO","EL CIPRES|2N":"PASTURA","EL CIPRES|2S":"PASTURA","EL CIPRES|5":"MAIZ",
  "EL CIPRES|6":"MAIZ","EL CIPRES|7":"PASTURA","EL CIPRES|3":"MAIZ",
  "DON MARCELINO|1":"SORGO","DON MARCELINO|2":"PASTURA","DON MARCELINO|3":"MAIZ","DON MARCELINO|4":"PASTURA",
  "DON MARCELINO|5":"MAIZ","DON MARCELINO|6":"PASTURA",
  "LA ADORACION|3":"GIRASOL","LA ADORACION|4":"MAIZ","LA ADORACION|5":"MAIZ",
  "LA CARLOTA|1":"MAIZ","LA CARLOTA|9":"MAIZ","LA CARLOTA|11":"MAIZ",
};

// rindes 25-26
const RINDE_2526_FALLBACK = {
  // L3H girasoles
  "L3H|5":30,"L3H|12":29,"L3H|13G":34,"L3H|13CH":24,"L3H|18":12,
  // L3H maíz tardío
  "L3H|21N":82,
  // L3H sojas
  "L3H|1":24,"L3H|17":35,"L3H|22":31,"L3H|23":32,"L3H|26":32,"L3H|27":36,"L3H|28":33,"L3H|29":38,
  // La Cuca
  "LA CUCA|2":28,"LA CUCA|3N":37,
  // La Cholita
  "LA CHOLITA|1":28,"LA CHOLITA|3":30,"LA CHOLITA|4":22,"LA CHOLITA|5":20,
  // El Descanso
  "EL DESCANSO|1":43,"EL DESCANSO|3":43,"EL DESCANSO|7":28,"EL DESCANSO|8":28,
  // La Dora
  "LA DORA|1":30,
  // Otros
  "LAS TIAS|11":37,"LOS ABUELOS|2":11,"LOS ABUELOS|3":7,
  "DON RAMON|5":25,"LA ADORACION|3":19,
};

// ============================================================
// HISTORICO DE ROTACION — 8 campañas por lote (19-20 a 26-27)
// cv = cultivo, rF = rinde fina qq/ha, rG = rinde gruesa qq/ha
// ============================================================
const HISTORICO_ROTACION_FALLBACK = {
  "L3H|1":{"19-20":{cv:"MAIZ",rF:null,rG:85},"20-21":{cv:"SOJA",rF:null,rG:31},"21-22":{cv:"GIRASOL",rF:null,rG:29},"22-23":{cv:"SOJA",rF:null,rG:10},"23-24":{cv:"MAIZ",rF:null,rG:77.5},"24-25":{cv:"GIRASOL",rF:null,rG:14.9},"25-26":{cv:"TRIGO-SOJA",rF:37,rG:24},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "L3H|2":{"19-20":{cv:"MAIZ",rF:null,rG:78},"20-21":{cv:"GIRASOL",rF:null,rG:28},"21-22":{cv:"TRIGO-MAIZ",rF:62,rG:42},"22-23":{cv:"SOJA",rF:null,rG:25.5},"23-24":{cv:"GIRASOL",rF:null,rG:28.2},"24-25":{cv:"TRIGO",rF:30,rG:null},"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "L3H|3":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"MAIZ",rF:null,rG:78},"21-22":{cv:"GIRASOL",rF:null,rG:25},"22-23":{cv:"TRIGO-SOJA",rF:28.5,rG:18},"23-24":{cv:"MAIZ",rF:null,rG:90},"24-25":{cv:"MANI",rF:null,rG:null},"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "L3H|4":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"MAIZ",rF:null,rG:72},"21-22":{cv:"SOJA",rF:null,rG:41},"22-23":{cv:"MAIZ",rF:null,rG:62},"23-24":{cv:"SOJA",rF:null,rG:31},"24-25":{cv:"MAIZ",rF:null,rG:56.6},"25-26":{cv:"MANI",rF:null,rG:null},"26-27":{cv:"TRIGO-SOJA",rF:null,rG:null}},
  "L3H|5":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"MAIZ",rF:null,rG:85},"24-25":{cv:"SOJA",rF:null,rG:24.3},"25-26":{cv:"GIRASOL",rF:null,rG:30},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|6":{"19-20":{cv:"GIRASOL",rF:null,rG:26},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"VERDEO-MAIZ",rF:null,rG:null}},
  "L3H|7":{"19-20":{cv:"GIRASOL",rF:null,rG:31},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"MAIZ",rF:null,rG:45.9},"25-26":{cv:"MANI",rF:null,rG:null},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "L3H|8":{"19-20":{cv:"MAIZ",rF:null,rG:95},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"MAIZ",rF:null,rG:92},"22-23":{cv:"GIRASOL",rF:null,rG:21},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"VERDEO-MAIZ",rF:null,rG:null}},
  "L3H|9A":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"MAIZ",rF:null,rG:61},"24-25":{cv:"GIRASOL",rF:null,rG:12.8},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|9B":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"MAIZ",rF:null,rG:61},"24-25":{cv:"GIRASOL",rF:null,rG:12.8},"25-26":{cv:"TRIGO-MAIZ",rF:41,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "L3H|10E":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"VERDEO-MAIZ",rF:null,rG:null}},
  "L3H|10O":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"CEBADA-MAIZ",rF:null,rG:null}},
  "L3H|11":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|12":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"GIRASOL",rF:null,rG:29},"22-23":{cv:"MAIZ",rF:null,rG:32},"23-24":{cv:"MANI",rF:null,rG:null},"24-25":{cv:"SOJA",rF:null,rG:23},"25-26":{cv:"GIRASOL",rF:null,rG:29},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|13G":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"MAIZ",rF:null,rG:65},"22-23":{cv:"SOJA",rF:null,rG:10},"23-24":{cv:"MANI",rF:null,rG:null},"24-25":{cv:"CENTENO-SOJA",rF:null,rG:11.1},"25-26":{cv:"GIRASOL",rF:null,rG:34},"26-27":{cv:"CEBADA-SOJA",rF:null,rG:null}},
  "L3H|13CH":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"GIRASOL",rF:null,rG:24},"26-27":{cv:"CEBADA-SOJA",rF:null,rG:null}},
  "L3H|13CH BAJO":{"19-20":{cv:"AGROPIRO",rF:null,rG:null},"20-21":{cv:"AGROPIRO",rF:null,rG:null},"21-22":{cv:"AGROPIRO",rF:null,rG:null},"22-23":{cv:"AGROPIRO",rF:null,rG:null},"23-24":{cv:"AGROPIRO",rF:null,rG:null},"24-25":{cv:"AGROPIRO",rF:null,rG:null},"25-26":{cv:"AGROPIRO",rF:null,rG:null},"26-27":{cv:"AGROPIRO",rF:null,rG:null}},
  "L3H|14":{"19-20":{cv:"SOJA",rF:null,rG:38},"20-21":{cv:"GIRASOL",rF:null,rG:33},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"VERDEO-MAIZ",rF:null,rG:null}},
  "L3H|15":{"19-20":{cv:"SOJA",rF:null,rG:38},"20-21":{cv:"GIRASOL",rF:null,rG:33},"21-22":{cv:"PASTURA",rF:null,rG:null},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|16":{"19-20":{cv:"MAIZ",rF:null,rG:83},"20-21":{cv:"SOJA",rF:null,rG:20},"21-22":{cv:null,rF:null,rG:null},"22-23":{cv:"MAIZ",rF:null,rG:32},"23-24":{cv:"GIRASOL",rF:null,rG:21},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|17":{"19-20":{cv:"SOJA",rF:null,rG:34},"20-21":{cv:"MAIZ",rF:null,rG:91},"21-22":{cv:"SOJA",rF:null,rG:47},"22-23":{cv:"GIRASOL",rF:null,rG:29.5},"23-24":{cv:"CEBADA-SOJA",rF:17.8,rG:38.5},"24-25":{cv:"MAIZ",rF:null,rG:79},"25-26":{cv:"SOJA",rF:null,rG:30},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "L3H|18":{"19-20":{cv:"SOJA",rF:null,rG:27},"20-21":{cv:"GIRASOL",rF:null,rG:31},"21-22":{cv:"MAIZ",rF:null,rG:94},"22-23":{cv:"SOJA",rF:null,rG:0.6},"23-24":{cv:"CEBADA-SOJA",rF:17.8,rG:32.5},"24-25":{cv:"GIRASOL",rF:null,rG:17.13},"25-26":{cv:"CEBADA-GIRASOL",rF:39,rG:12},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|19":{"19-20":{cv:"PASTURA",rF:null,rG:null},"20-21":{cv:"PASTURA",rF:null,rG:null},"21-22":{cv:"MAIZ",rF:null,rG:98},"22-23":{cv:"GIRASOL",rF:null,rG:25},"23-24":{cv:"MAIZ",rF:null,rG:72},"24-25":{cv:"GIRASOL",rF:null,rG:10},"25-26":{cv:"CEBADA-MAIZ",rF:39,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "L3H|20":{"19-20":{cv:"SOJA",rF:null,rG:30},"20-21":{cv:"MANI",rF:null,rG:null},"21-22":{cv:"CEBADA-SOJA",rF:38,rG:14},"22-23":{cv:"MAIZ",rF:null,rG:70},"23-24":{cv:"SOJA",rF:null,rG:37},"24-25":{cv:"MANI",rF:null,rG:null},"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "L3H|21N":{"19-20":{cv:"MAIZ",rF:null,rG:78},"20-21":{cv:"GIRASOL",rF:null,rG:34},"21-22":{cv:"TRIGO-MAIZ",rF:52,rG:29},"22-23":{cv:"SOJA",rF:null,rG:16},"23-24":{cv:"MAIZ",rF:null,rG:92},"24-25":{cv:"SOJA",rF:null,rG:35.6},"25-26":{cv:"MAIZ T",rF:null,rG:82},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "L3H|21S":{"19-20":{cv:"MAIZ",rF:null,rG:78},"20-21":{cv:"GIRASOL",rF:null,rG:34},"21-22":{cv:"TRIGO-MAIZ",rF:52,rG:29},"22-23":{cv:"SOJA",rF:null,rG:16},"23-24":{cv:"MAIZ",rF:null,rG:92},"24-25":{cv:"SOJA",rF:null,rG:35.6},"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "L3H|22":{"19-20":{cv:"SOJA",rF:null,rG:44},"20-21":{cv:"GIRASOL",rF:null,rG:27},"21-22":{cv:"SOJA",rF:null,rG:40},"22-23":{cv:"MAIZ",rF:null,rG:57},"23-24":{cv:"SOJA",rF:null,rG:29.7},"24-25":{cv:"TRIGO",rF:25,rG:null},"25-26":{cv:"TRIGO-SOJA",rF:29,rG:31},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "L3H|23":{"19-20":{cv:"MAIZ",rF:null,rG:80},"20-21":{cv:"TRIGO-MAIZ",rF:50,rG:60},"21-22":{cv:"SOJA",rF:null,rG:43},"22-23":{cv:"TRIGO-SOJA",rF:21.5,rG:0.6},"23-24":{cv:"MANI",rF:null,rG:null},"24-25":{cv:"MAIZ",rF:null,rG:58.3},"25-26":{cv:"SOJA",rF:null,rG:32},"26-27":{cv:"CEBADA-GIRASOL",rF:null,rG:null}},
  "L3H|24":{"19-20":{cv:"MAIZ",rF:null,rG:81},"20-21":{cv:"SOJA",rF:null,rG:36},"21-22":{cv:"GIRASOL",rF:null,rG:27},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|25":{"19-20":{cv:"MAIZ",rF:null,rG:75},"20-21":{cv:"SOJA",rF:null,rG:28},"21-22":{cv:"GIRASOL",rF:null,rG:23},"22-23":{cv:"PASTURA",rF:null,rG:null},"23-24":{cv:"PASTURA",rF:null,rG:null},"24-25":{cv:"PASTURA",rF:null,rG:null},"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "L3H|26":{"19-20":{cv:"SOJA",rF:null,rG:40},"20-21":{cv:"TRIGO-MAIZ",rF:31,rG:50},"21-22":{cv:"SOJA",rF:null,rG:41},"22-23":{cv:"MAIZ",rF:null,rG:69},"23-24":{cv:"GIRASOL",rF:null,rG:21},"24-25":{cv:"TRIGO",rF:18,rG:null},"25-26":{cv:"TRIGO-SOJA",rF:28,rG:32},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "L3H|27":{"19-20":{cv:"MAIZ",rF:null,rG:115},"20-21":{cv:"SOJA",rF:null,rG:48},"21-22":{cv:"MAIZ",rF:null,rG:77},"22-23":{cv:"GIRASOL",rF:null,rG:23},"23-24":{cv:"SOJA",rF:null,rG:39},"24-25":{cv:"MAIZ",rF:null,rG:78},"25-26":{cv:"SOJA",rF:null,rG:36},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "L3H|28":{"19-20":{cv:"GIRASOL",rF:null,rG:37},"20-21":{cv:"TRIGO-MAIZ",rF:53,rG:60},"21-22":{cv:"SOJA",rF:null,rG:42},"22-23":{cv:"MAIZ",rF:null,rG:70},"23-24":{cv:"TRIGO-SOJA",rF:20,rG:35},"24-25":{cv:"MAIZ",rF:null,rG:74},"25-26":{cv:"SOJA",rF:null,rG:33},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "L3H|29":{"19-20":{cv:"SOJA",rF:null,rG:36},"20-21":{cv:"GIRASOL",rF:null,rG:24},"21-22":{cv:"CEBADA-SOJA",rF:23,rG:0.9},"22-23":{cv:"SORGO",rF:null,rG:null},"23-24":{cv:"MAIZ",rF:null,rG:63},"24-25":{cv:"GIRASOL",rF:null,rG:17},"25-26":{cv:"TRIGO-SOJA",rF:27,rG:null},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "L3H|30":{"19-20":{cv:"AGROPIRO",rF:null,rG:null},"20-21":{cv:"AGROPIRO",rF:null,rG:null},"21-22":{cv:"AGROPIRO",rF:null,rG:null},"22-23":{cv:"AGROPIRO",rF:null,rG:null},"23-24":{cv:"AGROPIRO",rF:null,rG:null},"24-25":{cv:"AGROPIRO",rF:null,rG:null},"25-26":{cv:"AGROPIRO",rF:null,rG:null},"26-27":{cv:"AGROPIRO",rF:null,rG:null}},
  "LA CUCA|1":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "LA CUCA|2":{"25-26":{cv:"GIRASOL",rF:null,rG:28},"26-27":{cv:"FINA",rF:null,rG:null}},
  "LA CUCA|3N":{"25-26":{cv:"SOJA",rF:null,rG:37},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LA CHOLITA|1":{"25-26":{cv:"SOJA 2",rF:null,rG:28},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "LA CHOLITA|2":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "LA CHOLITA|3":{"25-26":{cv:"GIRASOL",rF:null,rG:30},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LA CHOLITA|4":{"25-26":{cv:"GIRASOL",rF:null,rG:22},"26-27":{cv:"CEBADA",rF:null,rG:null}},
  "LA CHOLITA|5":{"25-26":{cv:"GIRASOL",rF:null,rG:20},"26-27":{cv:"CEBADA",rF:null,rG:null}},
  "EL DESCANSO|1":{"25-26":{cv:"SOJA",rF:null,rG:43},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "EL DESCANSO|2":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "EL DESCANSO|3":{"25-26":{cv:"SOJA",rF:null,rG:43},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "EL DESCANSO|4":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "EL DESCANSO|5":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "EL DESCANSO|6":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "EL DESCANSO|7":{"25-26":{cv:"GIRASOL",rF:null,rG:28},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "EL DESCANSO|8":{"25-26":{cv:"GIRASOL",rF:null,rG:28},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LA DORA|1":{"25-26":{cv:"SOJA",rF:null,rG:30},"26-27":{cv:"GIRASOL",rF:null,rG:null}},
  "LA DORA|2":{"25-26":{cv:"GIRASOL",rF:null,rG:null},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LA DORA|4":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "LA DORA|5":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "LA DORA|6":{"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "LA DORA|7":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "LA DORA|8":{"25-26":{cv:"GIRASOL",rF:null,rG:null},"26-27":{cv:"CEBADA-SOJA",rF:null,rG:null}},
  "LAS TIAS|9":{"25-26":{cv:"SORGO",rF:null,rG:null},"26-27":{cv:"CENTENO",rF:null,rG:null}},
  "LAS TIAS|10":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"SOJA",rF:null,rG:null}},
  "LAS TIAS|11":{"25-26":{cv:"SOJA",rF:null,rG:37},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LAS TIAS|12":{"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "LOS ABUELOS|2":{"25-26":{cv:"GIRASOL",rF:null,rG:11},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|3":{"25-26":{cv:"GIRASOL",rF:null,rG:7},"26-27":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|4":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|5":{"26-27":{cv:"TRIGO",rF:null,rG:null}},
  "LOS ABUELOS|6A":{"25-26":{cv:"VERDEO",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "LOS ABUELOS|6C":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|7B":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|8A":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|8B":{"25-26":{cv:"MAIZ",rF:null,rG:null},"26-27":{cv:"CENTENO",rF:null,rG:null}},
  "LOS ABUELOS|3O":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
  "LOS ABUELOS|9A":{"25-26":{cv:"PASTURA",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "LOS ABUELOS|9B":{"25-26":{cv:"CENTENO",rF:null,rG:null},"26-27":{cv:"PASTURA",rF:null,rG:null}},
  "LOS ABUELOS|10":{"26-27":{cv:"CENTENO",rF:null,rG:null}},
  "LA MARIA OLIVA|2":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
  "LA MARIA OLIVA|3":{"25-26":{cv:"MAIZ",rF:null,rG:null}},
};

const CAMPAÑAS = ["19-20","20-21","21-22","22-23","23-24","24-25","25-26","26-27"];

// márgenes 25-26
const MB_LOTE = {
  "L3H|1":{cultivo:"SOJA 2",dir:264,rinde:24,mb:-212,mbsa:253},
  "L3H|5":{cultivo:"GIRASOL",dir:292,rinde:30,mb:531,mbsa:947},
  "L3H|9B":{cultivo:"MAIZ 2",dir:337,rinde:0,mb:-802,mbsa:-337},
  "L3H|12":{cultivo:"GIRASOL",dir:269,rinde:29,mb:525,mbsa:897},
  "L3H|13G":{cultivo:"GIRASOL",dir:259,rinde:34,mb:739,mbsa:1111},
  "L3H|13CH":{cultivo:"GIRASOL",dir:211,rinde:24,mb:377,mbsa:749},
  "L3H|17":{cultivo:"SOJA",dir:292,rinde:35,mb:17,mbsa:482},
  "L3H|21N":{cultivo:"MAIZ T",dir:354,rinde:82,mb:612,mbsa:1077},
  "L3H|22":{cultivo:"SOJA 2",dir:209,rinde:31,mb:7,mbsa:472},
  "L3H|23":{cultivo:"SOJA",dir:262,rinde:32,mb:-22,mbsa:443},
  "L3H|26":{cultivo:"SOJA 2",dir:250,rinde:32,mb:-10,mbsa:455},
  "L3H|27":{cultivo:"SOJA",dir:277,rinde:36,mb:55,mbsa:520},
  "L3H|28":{cultivo:"SOJA",dir:299,rinde:33,mb:-36,mbsa:429},
  "L3H|29":{cultivo:"SOJA 2",dir:198,rinde:38,mb:181,mbsa:646},
  "LA CUCA|2":{cultivo:"GIRASOL",dir:280,rinde:28,mb:466,mbsa:845},
  "LA CUCA|3N":{cultivo:"SOJA",dir:238,rinde:37,mb:417,mbsa:761},
  "LA CHOLITA|1":{cultivo:"SOJA",dir:205,rinde:28,mb:396,mbsa:406},
  "LA CHOLITA|3":{cultivo:"GIRASOL",dir:294,rinde:30,mb:479,mbsa:913},
  "LA CHOLITA|4":{cultivo:"GIRASOL",dir:291,rinde:22,mb:214,mbsa:586},
  "LA CHOLITA|5":{cultivo:"GIRASOL",dir:291,rinde:20,mb:132,mbsa:504},
  "EL DESCANSO|1":{cultivo:"SOJA",dir:234,rinde:43,mb:384,mbsa:725},
  "EL DESCANSO|3":{cultivo:"SOJA",dir:230,rinde:43,mb:388,mbsa:729},
  "EL DESCANSO|7":{cultivo:"GIRASOL",dir:161,rinde:28,mb:623,mbsa:964},
  "EL DESCANSO|8":{cultivo:"GIRASOL",dir:166,rinde:28,mb:618,mbsa:959},
  "LA DORA|1":{cultivo:"SOJA",dir:260,rinde:30,mb:149,mbsa:397},
};

// análisis de suelo (0-20, promedio por lote, último disponible)
// Texturas por lote (propiedad física, no cambia con el manejo)
// Formato: [arcilla%, limo%, arena%] — promedio de posiciones cuando aplica
const TEXTURA_LOTE_FALLBACK = {
  "L3H|3":  [7.3, 30.7, 62],
  "L3H|25": [8, 33, 59],
  "L3H|24": [9, 30, 61],
  "L3H|5":  [4.67, 22, 73.33],
  "L3H|2":  [6, 20, 74],
  "L3H|20": [9, 26, 65],
  "L3H|10E":[5.33, 20, 74.67],
};

const SUELOS_FALLBACK = {
  // === Análisis 2017 ===
  "L3H|16":{fecha:"2017",P:17.1,N:14.2,MO:1.521},
  "L3H|27":{fecha:"2017",P:16.3,N:9.1,MO:1.112},
  "L3H|25":{fecha:"2017",P:10.1,N:9.5,MO:0.958},
  "L3H|17":{fecha:"2017",P:13.2,N:null,MO:1.159},
  "L3H|9":{fecha:"2017",P:28.2,N:null,MO:1.119},
  // === Análisis 2019 ===
  "L3H|7":{fecha:"2019",P:19.4,N:8.3,MO:1.52},
  "L3H|18":{fecha:"2019",P:16.6,N:9.3,MO:1.51},
  // === Análisis 2021 (promedio loma/mediloma/bajo) ===
  "L3H|24":{fecha:"2021",P:18.05,N:10.65,MO:1.175,IMO:"3.03%"},
  // === Análisis 29/10/25 ===
  "L3H|3":{fecha:"29/10/25",P:21.4,N:3.41,MO:1.25,IMO:"3.29%"}, // MO/(7.3+30.7)*100
  "L3H|5":{fecha:"29/10/25",P:16.33,N:4.87,MO:0.99,IMO:"3.71%"},
  "L3H|21N":{fecha:"29/10/25",P:16.7,N:8.85,MO:1.29},
  // === Análisis 01/11/25 ===
  "L3H|2":{fecha:"01/11/25",P:18.5,N:2.68,MO:1.21,IMO:"4.65%"},
  "L3H|20":{fecha:"01/11/25",P:9.05,N:0.95,MO:1.42,IMO:"4.06%"},
  "L3H|10E":{fecha:"01/11/25",P:14.5,N:9.28,MO:1.5,IMO:"5.92%"},
  // === Análisis 26/05/26 — Lote 13G (sin textura propia todavía) ===
  "L3H|13G":{fecha:"26/05/26",P:14.57,N:5.1,MO:1.07,pH:6.82},
};

// aplicaciones herbicidas (registro)
const APLICACIONES_FALLBACK = [
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5b (sur)",ha:45,cultivo:"TRIGO",costo:1328.5,productos:["CONTROLMAX","POWERSPRAY 2,4D 68%","Dicamba Duranor","Metsulfuron Metil","RizoSpray EXTREMO"]},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"8B (SUR)",ha:23,cultivo:"CENTENO",costo:670.9,productos:["CONTROLMAX","POWERSPRAY 2,4D 68%","Dicamba Duranor","Metsulfuron Metil","RizoSpray EXTREMO"]},
  {fecha:"2026-06-25",campo:"L3H",lote:"23",ha:53,cultivo:"CEBADA",costo:2997.6,productos:["CONTROLMAX","POWERSPRAY 2,4D 68%","Dicamba Duranor","Flurocloridona 25%","RizoSpray EXTREMO"]},
  {fecha:"2026-06-25",campo:"L3H",lote:"1",ha:60,cultivo:"MAIZ",costo:2092.2,productos:["CONTROLMAX","POWERSPRAY 2,4D 68%","Dicamba Duranor","Atrazina 90% sólida","RizoSpray EXTREMO"]},
  {fecha:"2026-06-24",campo:"LA DORA",lote:"1",ha:59,cultivo:"MAIZ",costo:1953.7,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","ATRAZINA 90"]},
  {fecha:"2026-06-24",campo:"LAS TIAS",lote:"11",ha:63,cultivo:"MAIZ",costo:2086.1,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","ATRAZINA 90"]},
  {fecha:"2026-06-16",campo:"EL TORELLO",lote:"5",ha:23,cultivo:"FINA",costo:521.8,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
  {fecha:"2026-06-16",campo:"LOS NIETOS",lote:"7",ha:20,cultivo:"FINA",costo:478.3,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
  {fecha:"2026-06-16",campo:"EL CIPRES",lote:"1",ha:28,cultivo:"FINA",costo:669.6,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
  {fecha:"2026-06-16",campo:"LOS NIETOS",lote:"4",ha:27,cultivo:"FINA",costo:645.4,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
  {fecha:"2026-06-15",campo:"EL DESCANSO",lote:"3",ha:23,cultivo:"MAIZ",costo:746,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","ATRAZINA 90"]},
  {fecha:"2026-06-14",campo:"DOÑA TERESA",lote:"8",ha:14,cultivo:"CEBADA",costo:382.8,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
  {fecha:"2026-06-13",campo:"LA CUCA",lote:"3N",ha:85,cultivo:"GIRASOL",costo:2937,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROXIPIR 48","DIFLUFENICAN"]},
  {fecha:"2026-06-12",campo:"LA CHOLITA",lote:"1",ha:54,cultivo:"GIRASOL",costo:1866.5,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROXIPIR 48","DIFLUFENICAN"]},
  {fecha:"2026-06-11",campo:"L3H",lote:"28",ha:47,cultivo:"GIRASOL",costo:1674.7,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROXIPIR 48","DIFLUFENICAN"]},
  {fecha:"2026-06-11",campo:"L3H",lote:"22",ha:51,cultivo:"GIRASOL",costo:1762.8,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROXIPIR 48","DIFLUFENICAN"]},
  {fecha:"2026-06-11",campo:"L3H",lote:"17",ha:112,cultivo:"GIRASOL",costo:3870.2,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROXIPIR 48","DIFLUFENICAN"]},
  {fecha:"2026-06-11",campo:"L3H",lote:"26",ha:53,cultivo:"MAIZ",costo:1719,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","ATRAZINA 90"]},
  {fecha:"2026-06-11",campo:"L3H",lote:"27",ha:50,cultivo:"MAIZ",costo:1621.6,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","ATRAZINA 90"]},
  {fecha:"2026-06-11",campo:"L3H",lote:"29",ha:30,cultivo:"MAIZ",costo:973,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","ATRAZINA 90"]},
  {fecha:"2026-05-18",campo:"EL ABUELO",lote:"2-4-5",ha:120,cultivo:"CEBADA",costo:4373.1,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROCLORIDONA","DICAMBA"]},
  {fecha:"2026-05-15",campo:"L3H",lote:"13G",ha:120,cultivo:"CEBADA",costo:4961.1,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","FLUROCLORIDONA","ACEITE METILADO"]},
  {fecha:"2026-04-26",campo:"LA CHOLITA",lote:"4",ha:50,cultivo:"CEBADA",costo:2070.7,productos:["GLIFOSATO BOX 72%","2-4 D 97 SIGMA","LIGIER PH BIO","METSULFURON"]},
  {fecha:"2026-04-25",campo:"EL DESCANSO",lote:"1",ha:15,cultivo:"COBERTURA",costo:684,productos:["GLIFOSATO BOX 72%","TERBUTILAZINA","LIGIER PH BIO","2-4 D 97 SIGMA"]},
  {fecha:"2026-03-18",campo:"L3H",lote:"12",ha:78,cultivo:"PASTURA",costo:1738.6,productos:["GLIFOSATO GRANULADO","2-4 D 97 SIGMA","FLUMETSULAN","ACEITE METILADO","LIGIER PH BIO"]},
  {fecha:"2026-06-25",campo:"L3H",lote:"23",ha:53,cultivo:"CEBADA",costo:2997.6,productos:["CONTROLMAX","POWERSPRAY 2-4D 68%","DICAMBA","FLUROCLORIDONA 25%","RIZOSPRAY EXTREMO"]},
  {fecha:"2026-06-25",campo:"L3H",lote:"1",ha:60,cultivo:"MAIZ",costo:2092.2,productos:["CONTROLMAX","POWERSPRAY 2-4D 68%","DICAMBA","ATRAZINA 90%","RIZOSPRAY EXTREMO"]},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5B (sur)",ha:45,cultivo:"TRIGO",costo:1328.5,productos:["CONTROLMAX","POWERSPRAY 2-4D 68%","DICAMBA","METSULFURON","RIZOSPRAY EXTREMO"]},
  {fecha:"2026-07-02",campo:"EL TORELLO",lote:"5",ha:52,cultivo:"CEBADA",costo:1243.7,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
].map((a,i)=>({...a,id:i,costoHa:a.ha?a.costo/a.ha:0})).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
// fertilizaciones realizadas (registro campaña 26-27 y 25-26 relevantes)
const FERTILIZACIONES_FALLBACK = [
  {fecha:"2026-06-25",campo:"L3H",lote:"13G",ha:142,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"90 kg/ha",costoHa:52.2,notas:"Fertilización a la siembra"},
  {fecha:"2026-06-25",campo:"L3H",lote:"10O",ha:30,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"90 kg/ha",costoHa:52.2,notas:"Fertilización a la siembra"},
  {fecha:"2026-06-25",campo:"L3H",lote:"13CH",ha:16,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"90 kg/ha",costoHa:52.2,notas:""},
  {fecha:"2026-05-18",campo:"EL ABUELO",lote:"2-4-5",ha:120,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"80 kg/ha",costoHa:46.4,notas:""},
  {fecha:"2026-04-26",campo:"LA CHOLITA",lote:"4",ha:50,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"85 kg/ha",costoHa:49.3,notas:""},
  {fecha:"2026-04-26",campo:"LA CHOLITA",lote:"5",ha:20,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"85 kg/ha",costoHa:49.3,notas:""},
  {fecha:"2026-06-14",campo:"DOÑA TERESA",lote:"6",ha:6,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"85 kg/ha",costoHa:49.3,notas:""},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5A",ha:30,cultivo:"TRIGO",tipo:"Arranque",producto:"Nutrimap",dosis:"130 kg/ha",costoHa:98.8,notas:"Trigo B620"},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5B",ha:30,cultivo:"TRIGO",tipo:"Arranque",producto:"Nutrimap",dosis:"130 kg/ha",costoHa:98.8,notas:""},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"8B",ha:19,cultivo:"CENTENO",tipo:"Arranque",producto:"MAP",dosis:"70 kg/ha",costoHa:40.6,notas:""},
  // Nuevas fert 06-08/07/26 (planilla actualizada)
  {fecha:"2026-07-06",campo:"LOS NIETOS",lote:"4",ha:27,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-06",campo:"EL ABUELO",lote:"2",ha:62,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-06",campo:"EL ABUELO",lote:"4",ha:17,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-06",campo:"EL ABUELO",lote:"5",ha:40,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-06",campo:"EL TORELLO",lote:"5",ha:52,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"13C",ha:25,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"13G",ha:115,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"10",ha:30,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"70 kg/ha",costoHa:65.6,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"23",ha:50,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"70 kg/ha",costoHa:65.6,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"4",ha:100,cultivo:"TRIGO",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-08",campo:"LA CHOLITA",lote:"5",ha:50,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  {fecha:"2026-07-08",campo:"LA CHOLITA",lote:"6",ha:20,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP azufrado NUTRIEN",dosis:"50 kg/ha",costoHa:46.9,notas:""},
  // Urea-S incorporada (fertilización N temprana - siembra)
  {fecha:"2026-07-07",campo:"L3H",lote:"13G",ha:115,cultivo:"CEBADA",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:"Incorporada con siembra"},
  {fecha:"2026-07-07",campo:"L3H",lote:"13C",ha:25,cultivo:"CEBADA",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"10",ha:25,cultivo:"CEBADA",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"150 kg/ha",costoHa:84.75,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"23",ha:50,cultivo:"CEBADA",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:""},
  {fecha:"2026-07-07",campo:"L3H",lote:"4",ha:100,cultivo:"TRIGO",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:""},
  {fecha:"2026-07-08",campo:"EL ABUELO",lote:"4",ha:100,cultivo:"TRIGO",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:""},
  {fecha:"2026-07-08",campo:"LA CHOLITA",lote:"6",ha:20,cultivo:"CEBADA",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:""},
  {fecha:"2026-07-08",campo:"LA CHOLITA",lote:"5",ha:60,cultivo:"CEBADA",tipo:"N siembra",producto:"UREA-S NUTRIEN incorp.",dosis:"100 kg/ha",costoHa:56.5,notas:""},
].map((f,i)=>({...f,id:i})).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));



// próximas acciones
const ACCIONES_INIT = [
  {id:1,campo:"L3H",lote:"21-2-3-9-23-27-28-17",accion:"Post emergente maíz — atención arañuela",fecha:"2026-07-10",prioridad:"alta",hecha:false},
  {id:2,campo:"LOS ABUELOS",lote:"todos (soja 2da)",accion:"Post emergente — defoliante",fecha:"2026-07-09",prioridad:"media",hecha:false},
  {id:3,campo:"LA MARIA OLIVA",lote:"todos",accion:"Post emergente sorgo",fecha:"2026-07-09",prioridad:"media",hecha:false},
  {id:4,campo:"EL 5",lote:"todos",accion:"Post emergente pastura — control tucura",fecha:"2026-07-09",prioridad:"media",hecha:false},
];

const PRODUCTOR = {
  "L3H":"Sucesión/Haydee","LA CUCA":"Andrés","LOS ABUELOS":"Haydee","DOÑA TERESA":"Enrique",
  "DON ANTONIO":"Mariano","LA FLECHA":"Matías","LA CHOLITA":"Faroux M. Graciela","LA DORA":"Matean SAS",
  "LAS TIAS":"Lorenzo","LOS NIETOS":"Enrique/Andrés","EL TORELLO":"Mariano/Andrés",
  "EL CIPRES":"Mariano/Matías/Andrés","DON MARCELINO":"Enrique","EL ABUELO":"Enrique",
  "EL DESCANSO":"Mariano/Andrés","DON RAMON":"—","LA MARIA OLIVA":"—","EL 5":"—",
  "LA ADORACION":"—","LA CARLOTA":"—",
};
const COLORES_APP = ["#E2574C","#3B82C4","#43A047","#F2B707"];

// ── PLANOS ──────────────────────────────────────────────────
const CAMPOS = [
  {id:"L3H",nombre:"Las Tres Hermanas",vb:[20,10,770,740],
   refs:[{x:535,y:138,t:"Urruspuru"},{x:280,y:230,t:"Blanco Nora"},{x:762,y:440,t:"Garciarena",rot:90},{x:32,y:455,t:"Calle",rot:-90},{x:375,y:746,t:"Calle"}],
   lotes:[
    {id:"13CH",label:"13ch",ha:16,poly:[[45,30],[158,30],[45,220]]},
    {id:"13G",label:"13",ha:142,poly:[[178,30],[243,30],[243,258],[45,258],[45,234]]},
    {id:"26",label:"26",ha:53,poly:[[395,148],[480,148],[480,258],[395,258]]},
    {id:"27",label:"27",ha:50,poly:[[480,148],[565,148],[565,258],[480,258]]},
    {id:"28",label:"28",ha:47,poly:[[565,148],[650,148],[650,258],[565,258]]},
    {id:"29",label:"29",ha:28,poly:[[650,148],[700,148],[700,258],[650,258]]},
    {id:"30",label:"30",ha:28,poly:[[700,148],[748,148],[748,258],[700,258]]},
    {id:"12",label:"12",ha:78,poly:[[45,262],[185,262],[185,375],[45,375]]},
    {id:"11",label:"11",ha:32,poly:[[185,262],[243,262],[243,375],[185,375]]},
    {id:"10O",label:"10O",ha:30,poly:[[243,262],[319,262],[319,375],[243,375]]},
    {id:"10E",label:"10E",ha:60,poly:[[319,262],[395,262],[395,375],[319,375]]},
    {id:"22",label:"22",ha:51,poly:[[395,262],[480,262],[480,375],[395,375]]},
    {id:"23",label:"23",ha:53,poly:[[480,262],[565,262],[565,375],[480,375]]},
    {id:"24",label:"24",ha:50,poly:[[565,262],[650,262],[650,375],[565,375]]},
    {id:"25",label:"25",ha:54,poly:[[650,262],[748,262],[748,375],[650,375]]},
    {id:"7",label:"7",ha:91,poly:[[45,379],[185,379],[185,487],[45,487]]},
    {id:"8",label:"8",ha:28,poly:[[185,379],[218,379],[218,487],[185,487]]},
    {id:"9A",label:"9A",ha:30,poly:[[218,417],[300,417],[300,487],[218,487]]},
    {id:"9B",label:"9B",ha:55,poly:[[300,379],[395,379],[395,487],[300,487]]},
    {id:"14",label:"14",ha:50,poly:[[395,379],[480,379],[480,487],[395,487]]},
    {id:"15",label:"15",ha:56,poly:[[480,379],[565,379],[565,487],[480,487]]},
    {id:"16",label:"16",ha:104,poly:[[565,379],[748,379],[748,487],[565,487]]},
    {id:"6",label:"6",ha:68,poly:[[45,491],[148,491],[148,612],[45,612]]},
    {id:"5",label:"5",ha:42,poly:[[148,491],[218,491],[218,612],[148,612]]},
    {id:"4",label:"4",ha:111,poly:[[218,491],[395,491],[395,612],[218,612]]},
    {id:"19",label:"19",ha:31,poly:[[395,491],[440,491],[440,612],[395,612]]},
    {id:"18",label:"18",ha:80,poly:[[440,491],[565,491],[565,612],[440,612]]},
    {id:"17",label:"17",ha:112,poly:[[565,491],[748,491],[748,612],[565,612]]},
    {id:"1",label:"1",ha:60,poly:[[45,616],[148,616],[148,722],[45,722]]},
    {id:"2",label:"2",ha:35,poly:[[148,616],[218,616],[218,722],[148,722]]},
    {id:"3",label:"3",ha:98,poly:[[218,616],[395,616],[395,722],[218,722]]},
    {id:"20",label:"20",ha:97,poly:[[395,616],[560,616],[560,722],[395,722]]},
    {id:"21N",label:"21N",ha:63,poly:[[560,616],[748,616],[748,669],[560,669]]},
    {id:"21S",label:"21S",ha:32,poly:[[560,669],[748,669],[748,722],[560,722]]},
   ]},
  {id:"LA CUCA",nombre:"La Cuca",vb:[0,0,820,700],refs:[],
   lotes:[
    {id:"5",label:"5",ha:182,poly:[[10,10],[240,10],[228,350],[10,350]]},
    {id:"4N",label:"4N",ha:75,poly:[[240,10],[435,10],[435,180],[234,180]]},
    {id:"4S",label:"4S",ha:75,poly:[[234,180],[435,180],[435,350],[228,350]]},
    {id:"3N",label:"3N",ha:85,poly:[[435,10],[660,10],[660,180],[435,180]]},
    {id:"3S",label:"3S",ha:85,poly:[[435,180],[660,180],[660,350],[435,350]]},
    {id:"2",label:"2",ha:112,poly:[[660,10],[808,10],[808,340],[660,340]]},
    {id:"6",label:"6",ha:65,poly:[[428,358],[660,358],[660,478],[428,512]]},
    {id:"7",label:"7",ha:97,poly:[[428,512],[660,478],[660,688],[428,688]]},
    {id:"1",label:"1",ha:107,poly:[[660,340],[808,340],[808,688],[660,688]]},
   ]},
  {id:"LA CHOLITA",nombre:"La Cholita",vb:[0,0,700,540],refs:[{x:672,y:270,t:"Meridiano V",rot:90}],
   lotes:[
    {id:"1",label:"1",ha:54,poly:[[370,60],[645,60],[645,190],[370,190]]},
    {id:"2",label:"2",ha:54,poly:[[370,190],[645,190],[645,320],[370,320]]},
    {id:"3",label:"3",ha:54,poly:[[370,320],[645,320],[645,460],[370,460]]},
    {id:"4",label:"4",ha:50,poly:[[195,220],[370,220],[370,480],[195,480]]},
    {id:"5",label:"5",ha:20,poly:[[25,220],[195,220],[195,480],[25,480]]},
   ]},
  {id:"EL DESCANSO",nombre:"El Descanso",vb:[0,0,1040,640],
   refs:[{x:520,y:80,t:"Monserrat"},{x:520,y:615,t:"Capello"},{x:22,y:340,t:"Aeroclub",rot:-90},{x:1022,y:340,t:"Calle",rot:90}],
   lotes:[
    {id:"7",label:"7",ha:30,poly:[[40,100],[315,100],[315,320],[40,320]]},
    {id:"8",label:"8",ha:25,poly:[[40,320],[315,320],[315,580],[40,580]]},
    {id:"5",label:"5",ha:21,poly:[[315,100],[545,100],[545,320],[315,320]]},
    {id:"3",label:"3",ha:23,poly:[[545,100],[800,100],[800,318],[545,318]]},
    {id:"1",label:"1",ha:14,poly:[[800,100],[1000,100],[1000,318],[800,318]]},
    {id:"6",label:"6",ha:26,poly:[[315,320],[545,320],[545,580],[315,580]]},
    {id:"4",label:"4",ha:30,poly:[[545,318],[800,318],[800,580],[545,580]]},
    {id:"2",label:"2",ha:23,poly:[[800,318],[1000,318],[1000,580],[800,580]]},
   ]},
  {id:"LA DORA",nombre:"La Dora",vb:[0,0,430,790],refs:[{x:330,y:778,t:"Ruta N° 4"}],
   lotes:[
    {id:"7",label:"7",ha:56,poly:[[15,45],[210,45],[210,205],[15,205]]},
    {id:"6",label:"6",ha:56,poly:[[210,8],[405,45],[405,205],[210,205]]},
    {id:"5",label:"5",ha:66,poly:[[15,205],[210,205],[210,390],[15,390]]},
    {id:"4",label:"4",ha:67,poly:[[210,205],[405,205],[405,390],[210,390]]},
    {id:"3",label:"3",ha:11,poly:[[15,396],[122,396],[122,455],[15,462]]},
    {id:"1",label:"1",ha:59,poly:[[15,466],[210,456],[210,735],[18,522]]},
    {id:"8",label:"8",ha:42,poly:[[15,526],[225,762],[15,762]]},
    {id:"2",label:"2",ha:110,poly:[[210,390],[405,390],[405,735],[210,735]]},
   ]},
  {id:"LAS TIAS",nombre:"Las Tías",vb:[0,0,380,440],refs:[],
   lotes:[
    {id:"10",label:"10",ha:63,poly:[[10,10],[190,10],[190,222],[10,222]]},
    {id:"12",label:"12",ha:62,poly:[[190,10],[370,10],[370,222],[190,222]]},
    {id:"9",label:"9",ha:62,poly:[[10,222],[190,222],[190,430],[10,430]]},
    {id:"11",label:"11",ha:63,poly:[[190,222],[370,222],[370,430],[190,430]]},
   ]},
  {id:"LOS ABUELOS",nombre:"Los Abuelos",vb:[0,0,780,420],refs:[],
   grises:[{poly:[[15,15],[173,15],[173,160],[15,160]],label:"12"},{poly:[[568,15],[755,15],[755,148],[568,148]],label:"1"},{poly:[[15,165],[365,165],[365,205],[15,205]],label:"Monte"}],
   lotes:[
    {id:"10",label:"10",ha:43,poly:[[178,15],[245,15],[245,90],[178,90]]},
    {id:"11",label:"11",ha:40,poly:[[178,90],[245,90],[245,160],[178,160]]},
    {id:"9A",label:"9A",ha:25,poly:[[245,15],[310,15],[310,90],[245,90]]},
    {id:"9B",label:"9B",ha:16,poly:[[245,90],[310,90],[310,160],[245,160]]},
    {id:"8A",label:"8A",ha:22,poly:[[310,15],[362,15],[362,90],[310,90]]},
    {id:"8B",label:"8B",ha:19,poly:[[310,90],[362,90],[362,160],[310,160]]},
    {id:"7A",label:"7A",ha:26,poly:[[365,15],[440,15],[440,100],[365,100]]},
    {id:"7B",label:"7B",ha:32,poly:[[440,15],[513,15],[513,100],[440,100]]},
    {id:"6A",label:"6A",ha:21,poly:[[516,15],[565,15],[565,75],[516,75]]},
    {id:"6B",label:"6B",ha:12,poly:[[516,75],[565,75],[565,135],[516,135]]},
    {id:"6C",label:"6C",ha:16,poly:[[516,135],[565,135],[565,200],[516,200]]},
    {id:"4",label:"4",ha:11,poly:[[568,152],[640,152],[640,200],[568,200]]},
    {id:"2",label:"2",ha:42,poly:[[640,152],[755,152],[755,200],[640,200]]},
    {id:"5A",label:"5A",ha:30,poly:[[516,205],[610,205],[610,303],[516,303]]},
    {id:"5B",label:"5B",ha:30,poly:[[516,303],[610,303],[610,400],[516,400]]},
    {id:"3O",label:"3O",ha:21,poly:[[610,208],[665,208],[665,400],[610,400]]},
    {id:"3",label:"3",ha:39,poly:[[703,210],[755,210],[755,400],[703,400]]},
   ]},
  {id:"LA MARIA OLIVA",nombre:"La María Oliva",vb:[0,0,830,460],
   refs:[{x:415,y:452,t:"Ruta Provincial N° 10"},{x:16,y:230,t:"camino vecinal",rot:-90}],
   grises:[{poly:[[30,68],[145,68],[145,240],[30,240]],label:"Monte 5"},{poly:[[205,123],[370,123],[370,240],[205,240]],label:"Monte 4"},{poly:[[398,133],[800,133],[800,240],[398,240]],label:"Monte 3"},{poly:[[30,240],[395,240],[395,432],[30,432]],label:"Monte 2"},{poly:[[398,243],[800,243],[800,432],[398,432]],label:"Monte 1"}],
   lotes:[
    {id:"3",label:"L3",ha:15,poly:[[30,20],[215,20],[215,65],[30,65]]},
    {id:"2",label:"L2",ha:10,poly:[[215,20],[395,20],[395,65],[215,65]]},
    {id:"1",label:"L1",ha:25,poly:[[398,20],[800,20],[800,65],[398,65]]},
    {id:"FRANJA 2",label:"Franja 2",ha:41,poly:[[145,68],[365,68],[365,120],[205,120],[205,240],[145,240]]},
    {id:"FRANJA 1",label:"Franja 1",ha:33,poly:[[398,88],[800,88],[800,130],[398,130]]},
   ]},
  {id:"EL 5",nombre:"El 5",vb:[0,0,780,310],refs:[],
   grises:[{poly:[[10,10],[615,10],[615,300],[10,300]],label:"Monte"}],
   lotes:[
    {id:"5",label:"5",ha:26,poly:[[420,15],[530,15],[530,155],[490,155],[420,100]]},
    {id:"4",label:"4",ha:30,poly:[[535,15],[615,15],[615,155],[535,155]]},
    {id:"1",label:"1",ha:100,poly:[[620,15],[768,15],[768,170],[620,170]]},
    {id:"2",label:"2y3",ha:45,poly:[[620,173],[768,173],[768,252],[620,252]]},
   ]},
  {id:"LA FLECHA",nombre:"La Flecha",vb:[0,0,345,265],refs:[],
   lotes:[
    {id:"1",label:"1",ha:6,poly:[[15,15],[85,15],[85,100],[15,100]]},
    {id:"2",label:"2",ha:18,poly:[[85,15],[210,15],[210,120],[85,120]]},
    {id:"3",label:"3",ha:20,poly:[[210,15],[330,15],[330,120],[210,120]]},
    {id:"5",label:"5",ha:25,poly:[[15,100],[210,100],[210,250],[15,250]]},
    {id:"4",label:"4",ha:25,poly:[[210,120],[330,120],[330,250],[210,250]]},
   ]},
  {id:"DON ANTONIO",nombre:"Don Antonio",vb:[0,0,430,430],refs:[{x:422,y:215,t:"Ruta N° 7",rot:90}],
   grises:[
     // laguna dentro del lote 13
     {poly:[[45,105],[145,95],[175,140],[165,215],[120,240],[65,225],[35,175]],label:"laguna"},
   ],
   lotes:[
    // ── Fila superior ───────────────────────────────────
    // 12: 21ha, esquina NO, con borde SO diagonal hacia la laguna
    {id:"12",label:"12",ha:21,poly:[[10,10],[195,10],[195,90],[75,90],[10,60]]},
    // 9: 15ha, arriba centro-este, con borde S diagonal que sigue la laguna
    {id:"9",label:"9",ha:15,poly:[[195,10],[300,10],[300,95],[240,110],[195,90]]},
    // 8: ~5ha, arriba a la derecha, franja fina
    {id:"8",label:"8",ha:5,poly:[[300,10],[420,10],[420,55],[300,55]]},
    // 8A: 7.5ha, debajo de 8
    {id:"8A",label:"8a",ha:7.5,poly:[[300,55],[420,55],[420,115],[300,115]]},

    // ── Fila media ──────────────────────────────────────
    // 13: 82ha, gran lote oeste que rodea la laguna. Comparte bordes: diagonal con 11 (dos tramos) e inferior con 5
    {id:"13",label:"13",ha:82,poly:[[10,60],[75,90],[195,90],[210,225],[195,260],[10,260]]},
    // 10: 10ha, alto y angosto, pegado al 7 por su izquierda, baja desde el 9 hasta la altura del 7
    {id:"10",label:"10",ha:10,poly:[[240,110],[300,95],[300,260],[240,260]]},
    // 11: 21ha, pentágono - lado corto arriba con 9, dos lados con 13 (diagonal+vertical), abajo con 5, derecha con 10
    {id:"11",label:"11",ha:21,poly:[[195,90],[240,110],[240,260],[195,260],[210,225]]},
    // 7: 25ha, este bajo la 8A
    {id:"7",label:"7",ha:25,poly:[[300,115],[420,115],[420,260],[300,260]]},

    // ── Franja delgada 5 (3ha) ──────────────────────────
    {id:"5",label:"5",ha:3,poly:[[145,260],[300,260],[300,285],[145,285]]},

    // ── Fila baja (13 termina aquí al oeste) ────────────
    // 4: 20ha, centro-oeste bajo la franja 5
    {id:"4",label:"4",ha:20,poly:[[145,285],[300,285],[300,355],[145,355]]},
    // 3: 20ha, este bajo la 7
    {id:"3",label:"3",ha:20,poly:[[300,260],[420,260],[420,355],[300,355]]},

    // ── Fila inferior ───────────────────────────────────
    // 2: 27ha, SO, lote más al oeste
    {id:"2",label:"2",ha:27,poly:[[145,355],[300,355],[300,425],[145,425]]},
    // 1: 25ha, SE
    {id:"1",label:"1",ha:25,poly:[[300,355],[420,355],[420,425],[300,425]]},
   ]},
  {id:"DOÑA TERESA",nombre:"Doña Teresa",vb:[0,0,315,655],refs:[],
   lotes:[
    {id:"1",label:"1",ha:18,poly:[[15,15],[150,15],[150,110],[15,110]]},
    {id:"2",label:"2",ha:15,poly:[[150,15],[300,15],[300,140],[150,140]]},
    {id:"5",label:"5",ha:13,poly:[[15,110],[150,110],[150,215],[15,215]]},
    {id:"4",label:"4",ha:16,poly:[[150,140],[300,140],[300,250],[150,250]]},
    {id:"7",label:"7",ha:22,poly:[[15,215],[150,215],[150,330],[15,330]]},
    {id:"6",label:"6",ha:6,poly:[[150,250],[300,250],[300,330],[150,330]]},
    {id:"9",label:"9",ha:13,poly:[[15,330],[150,330],[150,430],[15,430]]},
    {id:"8",label:"8",ha:14,poly:[[150,330],[300,330],[300,450],[150,450]]},
    {id:"10",label:"10",ha:68,poly:[[15,430],[150,430],[150,640],[15,640]]},
   ]},
  {id:"EL TORELLO",nombre:"El Torello",vb:[0,0,705,265],refs:[],
   lotes:[
    {id:"8",label:"8",ha:49,poly:[[15,15],[120,15],[120,130],[15,130]]},
    {id:"6",label:"6",ha:26,poly:[[120,15],[225,15],[225,130],[120,130]]},
    {id:"3",label:"3",ha:89,poly:[[225,15],[450,15],[450,130],[225,130]]},
    {id:"1",label:"1",ha:88,poly:[[450,15],[690,15],[690,130],[450,130]]},
    {id:"9",label:"9",ha:43,poly:[[15,130],[120,130],[120,250],[15,250]]},
    {id:"7",label:"7",ha:28,poly:[[120,130],[225,130],[225,250],[120,250]]},
    {id:"5",label:"5",ha:52,poly:[[225,130],[430,130],[430,250],[225,250]]},
    {id:"2",label:"2",ha:58,poly:[[458,130],[690,130],[690,250],[458,250]]},
   ]},
  {id:"DON RAMON",nombre:"Don Ramón",vb:[0,0,380,705],refs:[],
   lotes:[
    {id:"4",label:"4",ha:16,poly:[[35,95],[115,42],[115,330],[35,330]]},
    {id:"3",label:"3",ha:10,poly:[[115,95],[180,95],[180,330],[115,330]]},
    {id:"1",label:"1",ha:20,poly:[[180,42],[345,42],[345,185],[180,185]]},
    {id:"2",label:"2",ha:18,poly:[[180,185],[345,185],[345,330],[180,330]]},
    {id:"5",label:"5",ha:65,poly:[[35,330],[180,330],[180,690],[35,690]]},
    {id:"6",label:"6",ha:60,poly:[[180,330],[345,330],[345,690],[180,690]]},
   ]},
  {id:"EL ABUELO",nombre:"El Abuelo",vb:[0,0,690,370],
   refs:[{x:14,y:185,t:"RP N°7 km 135",rot:-90},{x:680,y:185,t:"Calle Vecinal",rot:90}],
   lotes:[
    {id:"1",label:"1",ha:42,poly:[[30,15],[360,15],[360,160],[30,160]]},
    {id:"3",label:"3",ha:35,poly:[[360,15],[665,15],[665,160],[360,160]]},
    {id:"2",label:"2",ha:62,poly:[[30,160],[315,160],[315,355],[30,355]]},
    {id:"4",label:"4",ha:17,poly:[[315,160],[415,160],[415,355],[315,355]]},
    {id:"5",label:"5",ha:40,poly:[[415,160],[665,160],[665,355],[415,355]]},
   ]},
  {id:"LOS NIETOS",nombre:"Los Nietos",vb:[0,0,680,525],refs:[{x:672,y:260,t:"Ruta N°7",rot:90}],
   lotes:[
    {id:"11",label:"11",ha:60,poly:[[15,15],[205,15],[205,300],[15,300]]},
    {id:"9",label:"9",ha:43,poly:[[205,15],[335,15],[335,300],[205,300]]},
    {id:"10",label:"10",ha:20,poly:[[205,300],[335,300],[335,410],[205,410]]},
    {id:"5",label:"5",ha:27,poly:[[335,15],[490,15],[490,150],[335,150]]},
    {id:"1",label:"1",ha:28,poly:[[490,15],[665,15],[665,150],[490,150]]},
    {id:"6",label:"6",ha:15,poly:[[335,150],[490,150],[490,270],[335,270]]},
    {id:"2",label:"2",ha:15,poly:[[490,150],[665,150],[665,270],[490,270]]},
    {id:"7",label:"7",ha:20,poly:[[335,270],[490,270],[490,405],[335,405]]},
    {id:"3",label:"3",ha:27,poly:[[490,270],[665,270],[665,405],[490,405]]},
    {id:"8",label:"8",ha:26,poly:[[335,405],[490,405],[490,510],[335,510]]},
    {id:"4",label:"4",ha:27,poly:[[490,405],[665,405],[665,510],[490,510]]},
   ]},
  {id:"EL CIPRES",nombre:"El Ciprés",vb:[0,0,655,785],
   refs:[{x:200,y:22,t:"Sogorbe"},{x:645,y:440,t:"Graves",rot:90},{x:14,y:380,t:"Ruta N° 7",rot:-90}],
   grises:[{poly:[[358,392],[450,392],[450,488],[358,488]],label:"casco"}],
   lotes:[
    {id:"2N",label:"2N",ha:64,poly:[[80,30],[355,30],[355,255],[80,255]]},
    {id:"2S",label:"2S",ha:45,poly:[[80,255],[355,255],[355,390],[80,390]]},
    {id:"3",label:"3",ha:37,poly:[[355,200],[640,200],[640,308],[355,308]]},
    {id:"5",label:"5",ha:27,poly:[[390,308],[640,308],[640,390],[390,390]]},
    {id:"1",label:"1",ha:28,poly:[[80,390],[355,390],[355,490],[80,490]]},
    {id:"6",label:"6",ha:50,poly:[[355,490],[500,490],[500,770],[355,770]]},
    {id:"7",label:"7",ha:41,poly:[[500,490],[640,490],[640,690],[500,690]]},
   ]},
  {id:"DON MARCELINO",nombre:"Don Marcelino",vb:[0,0,900,435],
   refs:[{x:300,y:50,t:"Rainhart Javier"},{x:740,y:130,t:"Ernesto Selinger"},{x:450,y:430,t:"Calle"}],
   grises:[{poly:[[345,60],[395,60],[395,305],[345,305]],label:""}],
   lotes:[
    {id:"6",label:"6",ha:22,poly:[[20,60],[345,60],[345,185],[20,185]]},
    {id:"5",label:"5",ha:14,poly:[[395,60],[600,60],[600,185],[395,185]]},
    {id:"4",label:"4",ha:22,poly:[[20,185],[345,185],[345,305],[20,305]]},
    {id:"3",label:"3",ha:35,poly:[[395,185],[880,185],[880,305],[395,305]]},
    {id:"2",label:"2",ha:21,poly:[[20,305],[395,305],[395,420],[20,420]]},
    {id:"1",label:"1",ha:30,poly:[[395,305],[880,305],[880,420],[395,420]]},
   ]},
  {id:"LA ADORACION",nombre:"La Adoración",vb:[0,0,540,490],refs:[{x:270,y:485,t:"camino vecinal"}],
   lotes:[
    {id:"4",label:"4",ha:50,poly:[[15,15],[280,15],[280,250],[15,250]]},
    {id:"5",label:"5",ha:50,poly:[[280,15],[525,15],[525,250],[280,250]]},
    {id:"3",label:"3",ha:50,poly:[[280,250],[525,250],[525,475],[280,475]]},
   ]},
  {id:"LA CARLOTA",nombre:"La Carlota",vb:[0,0,960,440],refs:[{x:480,y:433,t:"Calle"}],
   grises:[{poly:[[20,20],[450,20],[450,190],[20,190]],label:"C. Yurk"},{poly:[[20,190],[335,190],[335,300],[20,300]],label:"Gette"}],
   lotes:[
    {id:"9",label:"9",ha:26,poly:[[450,20],[690,20],[690,190],[450,190]]},
    {id:"10",label:"10",ha:30,poly:[[690,20],[945,20],[945,105],[690,105]]},
    {id:"11",label:"11",ha:10,poly:[[870,105],[945,105],[945,190],[870,190]]},
    {id:"4",label:"4",ha:38,poly:[[450,190],[690,190],[690,300],[450,300]]},
    {id:"6",label:"6",ha:40,poly:[[690,190],[945,190],[945,300],[690,300]]},
    {id:"1",label:"1",ha:45,poly:[[20,300],[335,300],[335,415],[20,415]]},
    {id:"3",label:"3",ha:26,poly:[[335,300],[565,300],[565,415],[335,415]]},
    {id:"5",label:"5",ha:38,poly:[[565,300],[690,300],[690,415],[565,415]]},
    {id:"7",label:"7",ha:40,poly:[[690,300],[945,300],[945,415],[690,415]]},
   ]},
];

// ── LÓGICA DE CAPAS ─────────────────────────────────────────
// modo = campaña | rindes | margenes | suelos
// modo = campaña | rindes | margenes | suelos
// suelo_var = P | N | MO
// datos = {INV_26, PLAN_2627, RINDE_2526, SUELOS}
// Devuelve fill primario, label. Si es doble cultivo devuelve fill2 (para rayado)
function getFill(campoId, loteId, modo, sueloVar, datos = {}) {
  const {INV_26 = INV_26_FALLBACK, PLAN_2627 = PLAN_2627_FALLBACK, RINDE_2526 = RINDE_2526_FALLBACK, SUELOS = SUELOS_FALLBACK} = datos;
  const k=`${campoId}|${loteId}`;
  if(modo==="campaña"){
    const inv=INV_26[k];       // cultivo fina (invierno)
    const plan=PLAN_2627[k];    // cultivo gruesa (o doble cultivo con guión)
    // Caso doble cultivo: (a) fina invierno + gruesa distinta, o (b) plan viene "X-Y"
    let fina=inv, gruesa=null;
    if(plan){
      if(plan.includes("-")){
        const [f,g]=plan.split("-").map(s=>s.trim());
        fina=fina||f;
        gruesa=g;
      } else {
        gruesa=plan;
      }
    }
    // Si el plan es igual a la fina (ej "PASTURA"), no es doble cultivo
    if(fina&&gruesa&&baseCv(fina)===baseCv(gruesa)) gruesa=null;
    if(!fina&&!gruesa) return {fill:"#F0EDE5",label:"sin sembrar",dim:true};
    if(fina&&gruesa) return {
      fill:colorCv(fina),
      fill2:colorCv(gruesa),
      label:`${fina} + ${gruesa}`,
      dim:false,
      doble:true
    };
    const cv=fina||gruesa;
    return {fill:colorCv(cv),label:cv,dim:false};
  }
  if(modo==="rindes"){
    const r=RINDE_2526[k];
    if(r==null) return {fill:"#F0EDE5",label:"s/d",dim:true};
    return {fill:escalaColor(r,0,90,"#FFF5CC","#BF4000")||"#FFF5CC",label:`${r} qq/ha`,dim:false};
  }
  if(modo==="margenes"){
    const m=MB_LOTE[k];
    if(!m) return {fill:"#F0EDE5",label:"s/d",dim:true};
    const fill=m.mbsa>=0
      ? escalaColor(m.mbsa,0,1200,"#C8E6C9","#1B5E20")||"#C8E6C9"
      : escalaColor(Math.abs(m.mbsa),0,600,"#FFCDD2","#B71C1C")||"#FFCDD2";
    return {fill,label:`${m.mbsa>=0?"+":""}${fmt(m.mbsa)} US$/ha`,dim:false};
  }
  if(modo==="suelos"){
    const s=SUELOS[k];
    if(!s) return {fill:"#F0EDE5",label:"sin análisis",dim:true};
    if(sueloVar==="P"){
      const c=escalaColor(s.P,5,35,"#FFF9C4","#E65100");
      return {fill:c||"#F0EDE5",label:`P: ${s.P??"-"} ppm`,dim:!s.P};
    }
    if(sueloVar==="N"){
      const c=escalaColor(s.N,0,20,"#E3F2FD","#0D47A1");
      return {fill:c||"#F0EDE5",label:`N: ${s.N??"-"} kg/ha`,dim:!s.N};
    }
    if(sueloVar==="MO"){
      const c=escalaColor(s.MO,0.3,1.8,"#FFF3E0","#33691E");
      return {fill:c||"#F0EDE5",label:`MO: ${s.MO??"-"}%`,dim:!s.MO};
    }
  }
  return {fill:"#F0EDE5",label:"",dim:true};
}

// ── COMPONENTE MAPA ──────────────────────────────────────────
function MapaCampo({campo, modo, sueloVar, mini=false, onLoteClick, datos}){
  const [hov,setHov]=useState(null);
  const [vx,vy,vw,vh]=campo.vb;
  const k=vw/700;
  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{width:"100%",height:"auto",display:"block",cursor:onLoteClick?"pointer":"default"}}>
      {(campo.grises||[]).map((g,j)=>{
        const[cx,cy]=centro(g.poly);
        return <g key={j}>
          <polygon points={g.poly.map(p=>p.join(",")).join(" ")} fill="#E6E3DA" stroke="#C7C1B0" strokeWidth={k}/>
          {!mini&&g.label&&<text x={cx} y={cy} fontSize={10*k} fontStyle="italic" textAnchor="middle" fill="#9A937E">{g.label}</text>}
        </g>;
      })}
      {!mini&&(campo.refs||[]).map((r,j)=>(
        <text key={j} x={r.x} y={r.y} fontSize={10.5*k} fontStyle="italic" fill="#8A8270" textAnchor="middle" transform={r.rot?`rotate(${r.rot} ${r.x} ${r.y})`:undefined}>{r.t}</text>
      ))}
      {campo.lotes.map(l=>{
        const info=getFill(campo.id,l.id,modo,sueloVar,datos);
        const {fill,fill2,label,dim,doble}=info;
        const [cx,cy]=centro(l.poly);
        const w=anchoP(l.poly);
        const isH=hov===l.id;
        const patternId=`p_${campo.id.replace(/\s+/g,"")}_${l.id.replace(/\s+/g,"")}`.replace(/[^a-zA-Z0-9_]/g,"");
        return <g key={l.id} onMouseEnter={()=>!mini&&setHov(l.id)} onMouseLeave={()=>setHov(null)} onClick={onLoteClick?()=>onLoteClick(campo,l):undefined}>
          {doble&&(
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width={12*k} height={12*k} patternTransform="rotate(45)">
                <rect width={6*k} height={12*k} fill={fill}/>
                <rect x={6*k} width={6*k} height={12*k} fill={fill2}/>
              </pattern>
            </defs>
          )}
          <polygon points={l.poly.map(p=>p.join(",")).join(" ")}
            fill={doble?`url(#${patternId})`:fill} stroke={isH?"#1A1610":TINTA}
            strokeWidth={(isH?2.5:dim?0.8:1.3)*k} opacity={dim?0.75:1}/>
          {!mini&&w>=34*k&&(
            <g style={{pointerEvents:"none"}}>
              <text x={cx} y={cy+(dim?4:label?-2:4)*k} fontSize={(w<55*k?9.5:12)*k}
                fontWeight="700" textAnchor="middle"
                fill={dim?"#B0A89A":TINTA} opacity={dim?0.55:1}>{l.label}</text>
              {!dim&&label&&<text x={cx} y={cy+11*k} fontSize={8.5*k} textAnchor="middle" fill={TINTA} opacity={0.85}>{label}</text>}
            </g>
          )}
          {isH&&!mini&&(()=>{
            const txt=`${l.label}: ${label||"—"}`;
            const tw=txt.length*6.2*k+12*k;
            return <g style={{pointerEvents:"none"}}>
              <rect x={cx-tw/2} y={cy-26*k} width={tw} height={19*k} rx={3.5*k} fill="rgba(46,42,34,0.88)"/>
              <text x={cx} y={cy-13.5*k} fontSize={10.5*k} fill="#FFF" textAnchor="middle">{txt}</text>
            </g>;
          })()}
        </g>;
      })}
    </svg>
  );
}

// ── LEYENDA ──────────────────────────────────────────────────
function Leyenda({modo,sueloVar}){
  const tag={display:"flex",alignItems:"center",gap:5,fontSize:12};
  if(modo==="campaña"){
    const cvs=["MAIZ","SOJA","GIRASOL","CEBADA","TRIGO","AVENA","CENTENO","VERDEO","AGROPIRO","PASTURA"];
    return <div style={{marginTop:6}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
        {cvs.map(cv=><div key={cv} style={tag}><span style={{width:11,height:11,borderRadius:3,background:colorCv(cv),border:`1px solid ${TINTA}`,flexShrink:0}}/>{cv}</div>)}
        <div style={tag}><span style={{width:11,height:11,borderRadius:3,background:"#F0EDE5",border:"1px solid #C0B99A",flexShrink:0}}/>sin sembrar</div>
      </div>
      <div style={{...tag,marginTop:5,fontSize:11.5,opacity:0.75}}>
        <svg width="16" height="11" style={{flexShrink:0}}>
          <defs>
            <pattern id="lgd_stripe" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="3" height="6" fill="#C9B458"/>
              <rect x="3" width="3" height="6" fill="#43A047"/>
            </pattern>
          </defs>
          <rect width="16" height="11" fill="url(#lgd_stripe)" stroke="#2E2A22" strokeWidth="0.7"/>
        </svg>
        <span>rayado = doble cultivo (fina + gruesa)</span>
      </div>
    </div>;
  }
  if(modo==="rindes") return <GradBar min="0 qq" max="90 qq" c1="#FFF5CC" c2="#BF4000" label="Rinde 25-26"/>;
  if(modo==="margenes") return <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:6}}>
    <GradBar min="0" max="+US$1200" c1="#C8E6C9" c2="#1B5E20" label="MB s/alq positivo"/>
    <GradBar min="0" max="-US$600" c1="#FFCDD2" c2="#B71C1C" label="MB negativo"/>
  </div>;
  if(modo==="suelos"){
    if(sueloVar==="P") return <GradBar min="5 ppm" max="35 ppm" c1="#FFF9C4" c2="#E65100" label="Fósforo (P)"/>;
    if(sueloVar==="N") return <GradBar min="0 kg/ha" max="20 kg/ha" c1="#E3F2FD" c2="#0D47A1" label="Nitratos N 0-60cm"/>;
    if(sueloVar==="MO") return <GradBar min="0.3%" max="1.8%" c1="#FFF3E0" c2="#33691E" label="Materia Orgánica"/>;
  }
  return null;
}
function GradBar({min,max,c1,c2,label}){
  return <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6,fontSize:11.5}}>
    <span style={{opacity:0.7}}>{label}:</span>
    <span>{min}</span>
    <div style={{width:70,height:11,borderRadius:4,background:`linear-gradient(to right,${c1},${c2})`,border:"1px solid #C0B99A"}}/>
    <span>{max}</span>
  </div>;
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────

// ============================================================
// MOTOR DE DEDUCCIÓN — próximas acciones automáticas
// Toma un lote con cultivo, revisa aplicaciones+fertilizaciones
// realizadas, y deduce la próxima etapa del protocolo
// ============================================================

// Mapeo cultivo asignado → clave de PROTOCOLOS_DATA
const cultivoAProto = (cv) => {
  if(!cv) return null;
  const b = baseCv(cv);
  if(b === "TRIGO" || b === "CENTENO" || b === "AVENA") return "TRIGO";
  if(b === "CEBADA" || b === "FINA") return "CEBADA";
  if(b === "GIRASOL") return "GIRASOL";
  if(b === "SOJA") return "SOJA";
  if(b === "MAIZ") return "MAIZ";
  return null;
};

// Deduce el estado de un lote: qué etapas hizo, cuál toca ahora
function deducirEstadoLote(campoId, loteId, ha, cultivoAsignado, aplicaciones, fertilizaciones){
  const protoKey = cultivoAProto(cultivoAsignado);
  if(!protoKey || !PROTOCOLOS_DATA[protoKey]) return null;
  const proto = PROTOCOLOS_DATA[protoKey];

  // aplicaciones y fert de este lote (matching flexible: campo + lote incluye)
  const norm = s => (s||"").toString().toUpperCase().replace(/\s/g,"");
  const loteN = norm(loteId);
  const aplLote = aplicaciones.filter(a =>
    a.campo === campoId && (norm(a.lote) === loteN || norm(a.lote).includes(loteN) || loteN.includes(norm(a.lote)))
  ).sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
  const fertLote = fertilizaciones.filter(f =>
    f.campo === campoId && (norm(f.lote) === loteN || norm(f.lote).includes(loteN) || loteN.includes(norm(f.lote)))
  ).sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

  // Heurística: mapear cada aplicación/fert a una etapa del protocolo por palabras clave
  const etapaDe = (registro) => {
    const s = ((registro.cultivo||"") + " " + (registro.producto||"") + " " + (registro.notas||"") + " " + (registro.tipo||"")).toUpperCase();
    const prods = (registro.productos||[]).join(" ").toUpperCase();
    const all = s + " " + prods;

    // Heurísticas por cultivo
    if(protoKey === "TRIGO" || protoKey === "CEBADA"){
      if(all.includes("COSECHA")) return "cosecha";
      if(all.includes("FUNGICIDA") || all.includes("ELATUS") || all.includes("TEBUCONAZOLE")) return "fung";
      if(registro.tipo === "N tardía" || (all.includes("UREA") && !all.includes("AZUFRADA"))) return "fert2";
      if(registro.tipo === "N temprana" || all.includes("UREA AZUFRADA")) return "fert1";
      if(registro.tipo === "Arranque" || all.includes("MAP") || all.includes("NUTRIMAP")) return "siembra";
      if(all.includes("FLUROCLORIDONA") && !all.includes("BARBECHO")) return "presiembra";
      if(all.includes("SIEMBRA")) return "siembra";
      // Barbecho: si es glifosato + metsulfuron + 2-4D, sin fluro fuerte → barbecho_largo
      if(all.includes("GLIFOSATO") || all.includes("CONTROLMAX") || all.includes("2-4 D") || all.includes("2,4D")) return "barbecho_largo";
    }

    if(protoKey === "GIRASOL"){
      if(all.includes("COSECHA")) return "cosecha";
      if(all.includes("CLEARSOL") || all.includes("IMAZAPIR") || all.includes("FLUROXIPIR") || all.includes("DIFLUFENICAN")) return "post_emergencia";
      if(all.includes("UREA") || registro.tipo === "N") return "fert_n";
      if(all.includes("S-METOLACLORO") || all.includes("METOLACLORO")) return "pre_emergencia";
      if(all.includes("SIEMBRA") || registro.tipo === "Arranque") return "siembra";
      if(all.includes("CARFENTRAZONE") || all.includes("CLETODIM")) return "reseteo";
      if(all.includes("GLIFOSATO") || all.includes("ATRAZINA")) return "barbecho_largo";
    }

    if(protoKey === "SOJA"){
      if(all.includes("COSECHA")) return "cosecha";
      if(all.includes("AMPLIGO") || all.includes("INSECTICIDA")) return "post2";
      if(all.includes("CLETODIM") || all.includes("SULFENTRAZONE")) return "post1";
      if(all.includes("SIEMBRA") || all.includes("INOCULANTE")) return "siembra";
      if(all.includes("VORAXOR")) return "presiembra";
      if(all.includes("GLIFOSATO") || all.includes("2-4 D")) return "barbecho";
    }

    if(protoKey === "MAIZ"){
      if(all.includes("COSECHA")) return "cosecha";
      if(all.includes("ATRAZINA") && all.includes("POST")) return "post";
      if(all.includes("AMPLIGO") || all.includes("INSECTICIDA")) return "post";
      if(all.includes("SIEMBRA") || registro.tipo === "Arranque") return "siembra";
      if(all.includes("TERBUTILAZINA")) return "presiembra";
      if(all.includes("GLIFOSATO") || all.includes("ATRAZINA")) return "barbecho";
    }
    return null;
  };

  // Etapas completadas (por índice)
  const etapasCompletadas = new Set();
  [...aplLote, ...fertLote].forEach(r => {
    const e = etapaDe(r);
    if(e) etapasCompletadas.add(e);
  });

  // Encontrar la próxima etapa: primer etapa del protocolo que no esté en completadas
  const etapasOrden = proto.etapas.map(e => e.id);
  let proximaIdx = -1;
  for(let i = 0; i < etapasOrden.length; i++){
    if(!etapasCompletadas.has(etapasOrden[i])){
      proximaIdx = i;
      break;
    }
  }
  const proxima = proximaIdx >= 0 ? proto.etapas[proximaIdx] : null;

  // Fecha estimada: si hay siembra registrada, dds relativo. Si no, mes indicativo.
  let fechaEstimada = null;
  const siembraReg = [...aplLote, ...fertLote].find(r => {
    const e = etapaDe(r);
    return e === "siembra";
  });
  if(siembraReg && proxima && proxima.dds > 0){
    const base = new Date(siembraReg.fecha);
    base.setDate(base.getDate() + proxima.dds);
    fechaEstimada = base.toISOString().split("T")[0];
  }

  return {
    protoKey,
    proto,
    etapasCompletadas: [...etapasCompletadas],
    proximaEtapa: proxima,
    fechaEstimada,
    ultimaAplicacion: aplLote[aplLote.length - 1] || null,
    ultimaFertilizacion: fertLote[fertLote.length - 1] || null,
    aplTotal: aplLote.length,
    fertTotal: fertLote.length,
    ha
  };
}

// Genera lista completa de próximas acciones deducidas para todos los lotes
function generarProximasAcciones(CAMPOS_DATA, INV_26_DATA, PLAN_2627_DATA, APLICACIONES_DATA, FERT_DATA){
  const acciones = [];
  CAMPOS_DATA.forEach(campo => {
    campo.lotes.forEach(lote => {
      const key = campo.id + "|" + lote.id;
      const cvInvierno = INV_26_DATA[key];
      const cvPlan = PLAN_2627_DATA[key];
      const cultivo = cvInvierno || cvPlan;
      if(!cultivo) return;
      const estado = deducirEstadoLote(campo.id, lote.id, lote.ha, cultivo, APLICACIONES_DATA, FERT_DATA);
      if(!estado || !estado.proximaEtapa) return;
      acciones.push({
        campo: campo.id,
        campoNombre: campo.nombre,
        lote: lote.label || lote.id,
        loteId: lote.id,
        ha: lote.ha,
        cultivo,
        etapa: estado.proximaEtapa,
        fechaEstimada: estado.fechaEstimada,
        completadas: estado.etapasCompletadas.length,
        totalEtapas: estado.proto.etapas.length,
        protoKey: estado.protoKey,
        color: estado.proto.color,
      });
    });
  });
  return acciones;
}

// ============================================================
// MÓDULO PROTOCOLOS — integrar en GestionCamposSmix.jsx
// Agregarlo como nueva pestaña "📋 Protocolos"
// ============================================================

// ── DATOS DE PROTOCOLOS ─────────────────────────────────────

const PROTOCOLOS_DATA = {

  TRIGO: {
    nombre: "Trigo",
    color: "#D4AF37",
    etapas: [
      {
        id: "barbecho_largo", label: "Barbecho largo", mes: "Mar–Jun", dds: -90,
        descripcion: "Inicio barbecho. Mineralización activa con temperatura alta. Mantener lotes limpios desde cosecha del antecesor.",
        alertas: ["Evitar gramíneas (corta enfermedades: pietin, virosis, ácaros, pulgones)", "Revisar residuos ALS si antecesor fue girasol CL o soja con Spider"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Metsulfuron", dosis: "7 gr/ha", tipo: "HERBICIDA" },
              { nombre: "Glifosato", dosis: "1.5–2 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "600–800 cc/ha", tipo: "HERBICIDA" },
            ]
          },
          "Lote sucio / antecesor girasol": {
            productos: [
              { nombre: "Rolo (si hay RN seca)", dosis: "—", tipo: "LABOR" },
              { nombre: "Glifosato", dosis: "2 L/ha", tipo: "HERBICIDA" },
              { nombre: "Metsulfuron", dosis: "7 gr/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "1.2 L/ha", tipo: "HERBICIDA" },
            ]
          },



        }
      },
      {
        id: "presiembra", label: "Pre-siembra", mes: "May–Jun", dds: -20,
        descripcion: "Barbecho presiembra. Control crucíferas con triple resistencia si es necesario.",
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "600 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Metsulfuron", dosis: "7 gr/ha", tipo: "HERBICIDA" },
              { nombre: "Dicamba", dosis: "150 cc/ha", tipo: "HERBICIDA" },
            ]
          },

        }
      },
      {
        id: "siembra", label: "Siembra", mes: "Jun", dds: 0,
        descripcion: "Siembra con fertilización fosforada a la siembra.",
        alertas: ["Curasemilla recomendado", "Análisis de suelo y semilla previo"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Siembra fina", dosis: "1 pasada", tipo: "LABOR", costo: 40 },
              { nombre: "Semilla (B620 u otra)", dosis: "130 kg/ha", tipo: "SEMILLA", costo: 0.26 },
              { nombre: "Curasemilla Scenic", dosis: "195 cc/100kg", tipo: "CURASEMILLA", costo: 40.9 },
              { nombre: "Nutrimap (fert. arranque)", dosis: "130 kg/ha", tipo: "FERTILIZANTE", costo: 0.76 },
            ]
          },

        }
      },
      {
        id: "fert1", label: "Fertil. N temprana", mes: "Jul", dds: 30,
        descripcion: "Fertilización nitrogenada temprana. Macollaje. Dejar franja testigo (0N) y franja de suficiencia (2xN).",
        alertas: ["Inicio monitoreo malezas", "Dejar franja TESTIGO y franja SUFICIENCIA para diagnóstico N"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Fertilización sólida", dosis: "1 pasada", tipo: "LABOR", costo: 11 },
              { nombre: "Urea azufrada", dosis: "150 kg/ha", tipo: "FERTILIZANTE", costo: 0.58 },
            ]
          },
        }
      },
      {
        id: "post_herb", label: "Post-emergente", mes: "Jul–Ago", dds: 45,
        descripcion: "Control hoja ancha post-emergente. Hasta fin de macollaje para hormonales.",
        alertas: ["Finalización aplicación herbicidas hormonales: OCTUBRE", "No aplicar hormonales con heladas"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "2-4D Advance", dosis: "300 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Dicamba", dosis: "120 cc/ha", tipo: "HERBICIDA" },
            ]
          },


        }
      },
      {
        id: "fert2", label: "Fertil. N 2-nudos", mes: "Oct", dds: 100,
        descripcion: "Segunda fertilización nitrogenada en encañazón (Z31-Z32).",
        alertas: ["Recuento de plántulas antes", "Inicio monitoreo enfermedades"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Fertilización sólida", dosis: "1 pasada", tipo: "LABOR", costo: 11 },
              { nombre: "Urea", dosis: "100 kg/ha", tipo: "FERTILIZANTE", costo: 0.6 },
            ]
          },
        }
      },
      {
        id: "fung", label: "Fungicida + Insecticida", mes: "Nov", dds: 130,
        descripcion: "Aplicación fungicida en antesis (Z65). Monitoreo pulgón espiga, oruga militar y desgranadora.",
        alertas: ["Monitoreo pulgón espiga + oruga militar + oruga desgranadora"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Fumigación aérea", dosis: "1 pasada", tipo: "LABOR", costo: 11 },
              { nombre: "Elatus Ace", dosis: "0.5 L/ha", tipo: "FUNGICIDA", costo: 57 },
              { nombre: "Aceite agrícola", dosis: "250 cc/ha", tipo: "ADITIVO", costo: 3.2 },
              { nombre: "Fullcontrol", dosis: "5 cc/ha", tipo: "ADITIVO", costo: 25 },
            ]
          },
        }
      },
      {
        id: "cosecha", label: "Cosecha", mes: "Dic", dds: 180,
        descripcion: "Madurez fisiológica y cosecha.",
        alertas: [],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Cosecha trigo", dosis: "1 pasada", tipo: "COSECHA", costo: 65 },
            ]
          },
        }
      },
    ]
  },

  CEBADA: {
    nombre: "Cebada",
    color: "#C9B458",
    etapas: [
      {
        id: "barbecho_largo", label: "Barbecho largo", mes: "Mar–Jun", dds: -90,
        descripcion: "Igual que trigo. Sin antecedentes de WSMV en cebada. Más sensible a residuos ALS que el trigo.",
        alertas: ["Mayor sensibilidad a ALS que trigo", "Si hay gramíneas encañadas en lotes vecinos: cambiar a cebada o controlar"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Metsulfuron", dosis: "7 gr/ha", tipo: "HERBICIDA" },
              { nombre: "Glifosato", dosis: "1.5–2 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "600 cc/ha", tipo: "HERBICIDA" },
            ]
          },

        }
      },
      {
        id: "siembra", label: "Siembra", mes: "Jun", dds: 0,
        descripcion: "Siembra cebada. Análisis pureza y poder germinativo de semilla.",
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Siembra fina", dosis: "1 pasada", tipo: "LABOR", costo: 40 },
              { nombre: "Semilla certificada", dosis: "120–140 kg/ha", tipo: "SEMILLA" },
              { nombre: "Curasemilla", dosis: "según marbete", tipo: "CURASEMILLA" },
              { nombre: "Fertilizante arranque", dosis: "100–130 kg/ha MAP", tipo: "FERTILIZANTE" },
            ]
          },
        }
      },
      {
        id: "fert1", label: "Fertil. N temprana", mes: "Jul", dds: 30,
        descripcion: "Fertilización N en macollaje temprano.",
        alertas: ["Franja testigo y suficiencia obligatoria"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Urea azufrada", dosis: "150 kg/ha", tipo: "FERTILIZANTE", costo: 0.58 },
            ]
          },
        }
      },
      {
        id: "fert2", label: "Fertil. N 2-nudos", mes: "Ago–Sep", dds: 75,
        descripcion: "Segunda dosis de N en encañazón.",
        alertas: [],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Urea", dosis: "80–100 kg/ha", tipo: "FERTILIZANTE", costo: 0.6 },
            ]
          },
        }
      },
      {
        id: "fung", label: "Fungicida antesis", mes: "Oct", dds: 100,
        descripcion: "Tebuconazole en antesis. Cebada es más sensible a Fusarium que trigo.",
        alertas: ["No Hussar en cebada", "Axial y Merit funcionan en avena"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Fumigación aérea", dosis: "1 pasada", tipo: "LABOR", costo: 11 },
              { nombre: "Tebuconazole", dosis: "0.5 L/ha", tipo: "FUNGICIDA" },
              { nombre: "Insecticida", dosis: "según monitoreo", tipo: "INSECTICIDA" },
            ]
          },
        }
      },
      {
        id: "cosecha", label: "Cosecha", mes: "Nov–Dic", dds: 150,
        descripcion: "Madurez fisiológica. Cosecha cebada.",
        alertas: [],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Cosecha cebada", dosis: "1 pasada", tipo: "COSECHA", costo: 65 },
            ]
          },
        }
      },
    ]
  },

  GIRASOL: {
    nombre: "Girasol",
    color: "#D97B29",
    etapas: [
      {
        id: "barbecho_largo", label: "Barbecho largo", mes: "Mar–Jun", dds: -90,
        descripcion: "Barbecho largo. Control de malezas temprano. Reserva de híbridos.",
        alertas: ["Definir híbrido: Convencional vs CL (Clearfield)", "Reservar híbridos en Mar–Jun"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5–2 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D", dosis: "600 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Aceite metilado", dosis: "400 cc/ha", tipo: "ADITIVO" },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5–2 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D", dosis: "600 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Aceite metilado", dosis: "400 cc/ha", tipo: "ADITIVO" },
              { nombre: "Control RG (manchones): Cletodim", dosis: "500 cc/ha + aceite", tipo: "HERBICIDA" },
            ]
          },
        }
      },
      {
        id: "reseteo", label: "Reseteo crucíferas/RG", mes: "Ago–Sep", dds: -25,
        descripcion: "Segunda pasada de barbecho. Quemado de verdeo invernal si lo hay.",
        alertas: ["Monitoreo bicho bolita y babosa (30 días antes siembra)", "Análisis P y N (15 días antes siembra)"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D", dosis: "600 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Carfentrazone", dosis: "30 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Cletodim", dosis: "500 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Aceite metilado soja", dosis: "400 cc/ha", tipo: "ADITIVO" },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D", dosis: "600 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Carfentrazone", dosis: "30 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Cletodim", dosis: "500 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Aceite metilado soja", dosis: "400 cc/ha", tipo: "ADITIVO" },
            ]
          },
        }
      },
      {
        id: "siembra", label: "Siembra", mes: "Oct–Nov", dds: 0,
        descripcion: "Siembra girasol. Ventana óptima 25/10 al 10/11.",
        alertas: ["Contactar sembrador 45 días antes", "Control siembra y GPS del lote", "Asegurar cultivo granizo/viento en V2–V4"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "Siembra gruesa", dosis: "1 pasada", tipo: "LABOR", costo: 40 },
              { nombre: "Semilla convencional", dosis: "4–5 kg/ha", tipo: "SEMILLA" },
              { nombre: "Curasemilla (insecticida)", dosis: "según marbete", tipo: "CURASEMILLA" },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "Siembra gruesa", dosis: "1 pasada", tipo: "LABOR", costo: 40 },
              { nombre: "Semilla CL (syn 3970 / adv 5310)", dosis: "4–5 kg/ha", tipo: "SEMILLA" },
              { nombre: "Curasemilla (insecticida)", dosis: "según marbete", tipo: "CURASEMILLA" },
            ]
          },
        }
      },
      {
        id: "pre_emergencia", label: "Pre-emergencia", mes: "Nov", dds: 5,
        descripcion: "Control de malezas en pre-emergencia del cultivo.",
        alertas: ["Monitoreo de nacimientos en V2"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "S-metolacloro", dosis: "0.9 L/ha", tipo: "HERBICIDA", nota: "Residual gramíneas" },
              { nombre: "Diflufenican", dosis: "150–200 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Fluroxipir", dosis: "350–500 cc/ha", tipo: "HERBICIDA" },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "S-metolacloro", dosis: "0.9 L/ha", tipo: "HERBICIDA" },
              { nombre: "Diflufenican", dosis: "150–200 cc/ha", tipo: "HERBICIDA" },
            ]
          },
        }
      },
      {
        id: "fert_n", label: "Fertilización N", mes: "Nov", dds: 20,
        descripcion: "Fertilización nitrogenada a los 20 DDS (FASA). Recuento de plantas.",
        alertas: ["Recuento plantas en V2", "Estimación rinde en MF"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "Fertilización sólida", dosis: "1 pasada", tipo: "LABOR" },
              { nombre: "Urea", dosis: "80–120 kg/ha", tipo: "FERTILIZANTE" },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "Fertilización sólida", dosis: "1 pasada", tipo: "LABOR" },
              { nombre: "Urea", dosis: "80–120 kg/ha", tipo: "FERTILIZANTE" },
            ]
          },
        }
      },
      {
        id: "post_emergencia", label: "Post-emergente", mes: "Nov", dds: 25,
        descripcion: "Control post-emergente a los 25 DDS. El Clearsol SOLO para híbridos CL.",
        alertas: ["Clearsol (Imazapir) SOLO en CL Clearfield", "Monitoreo enfermedades R1–R3", "Monitoreo plagas tardías BF–R3"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "Fluroxipir 48", dosis: "350–500 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Diflufenican 50%", dosis: "150–200 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Aceite metilado", dosis: "400 cc/ha", tipo: "ADITIVO" },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "Clearsol (Imazapir)", dosis: "80 cc/ha", tipo: "HERBICIDA", nota: "SOLO en híbridos CL. Con aceite metilado" },
              { nombre: "Aceite metilado", dosis: "500 cc/ha", tipo: "ADITIVO" },
            ]
          },
        }
      },
      {
        id: "cosecha", label: "Cosecha", mes: "Feb–Mar", dds: 125,
        descripcion: "Monitoreo pre-cosecha. Control de cosecha.",
        alertas: ["Monitoreo pre-cosecha en MF"],
        malezas: {
          "Híbrido convencional": {
            productos: [
              { nombre: "Cosecha girasol", dosis: "1 pasada", tipo: "COSECHA", costo: 65 },
            ]
          },
          "Híbrido CL (Clearfield)": {
            productos: [
              { nombre: "Cosecha girasol", dosis: "1 pasada", tipo: "COSECHA", costo: 65 },
            ]
          },
        }
      },
    ]
  },

  SOJA: {
    nombre: "Soja",
    color: "#43A047",
    etapas: [
      {
        id: "barbecho", label: "Barbecho", mes: "Abr–Sep", dds: -90,
        descripcion: "Barbecho largo. Estrategia según maleza problema del lote.",
        alertas: ["No usar diclosulam si antecesor usó fomesafen (limita rotación a fina y maíz temprano)", "Fomesafen limita rotación a fina, maíz temprano y girasol el año siguiente"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5–2 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "800 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Dicamba", dosis: "150 cc (si hace falta)", tipo: "HERBICIDA" },
            ]
          },


          "Morenita (Gomphrena)": {
            productos: [
              { nombre: "Glifosato", dosis: "2 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "800 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Fluroxipir", dosis: "350 cc/ha", tipo: "HERBICIDA", nota: "7 días pre-siembra" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
            ]
          },
        }
      },
      {
        id: "presiembra", label: "Pre-siembra", mes: "Oct–Nov", dds: -7,
        descripcion: "Quemado presiembra con residual.",
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Glifosato", dosis: "1.3–1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "Sulfentrazone", dosis: "300–400 cc/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "500 cc/ha", tipo: "HERBICIDA" },
            ]
          },

        }
      },
      {
        id: "siembra", label: "Siembra", mes: "Oct–Nov", dds: 0,
        descripcion: "Siembra soja. Soja temprana hasta 20/10, tardía post 20/10.",
        alertas: ["Zona CREA: siembra 15/10 en hileras estrechas", "Lotes con escapes de YC: hileras estrechas o pasar a noviembre"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Siembra gruesa", dosis: "1 pasada", tipo: "LABOR", costo: 40 },
              { nombre: "Semilla (DM46i20 u otra)", dosis: "80–90 kg/ha", tipo: "SEMILLA", costo: 0.44 },
              { nombre: "Inoculante (Rizopack)", dosis: "0.03 pack/ha", tipo: "INOCULANTE", costo: 240 },
            ]
          },
        }
      },
      {
        id: "post1", label: "Post 1 (V2–V3)", mes: "Nov–Dic", dds: 15,
        descripcion: "Primera post-emergente. Glifosato + residual.",
        alertas: [],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Pulverización terrestre", dosis: "1 pasada", tipo: "LABOR", costo: 5.5 },
              { nombre: "Glifosato", dosis: "1.3 kg/ha", tipo: "HERBICIDA", costo: 6.7 },
              { nombre: "Sulfentrazone", dosis: "300 cc/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D Advance", dosis: "800 cc/ha", tipo: "HERBICIDA" },
            ]
          },
          "Gramíneas": {
            productos: [
              { nombre: "Glifosato", dosis: "1.3 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Cletodim", dosis: "500 cc/ha + aceite", tipo: "HERBICIDA" },
            ]
          },
        }
      },
      {
        id: "post2", label: "Post 2 (R1)", mes: "Ene", dds: 60,
        descripcion: "Segunda post con insecticida si hay oruga.",
        alertas: ["Ampligo si hay oruga / trips"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Pulverización terrestre", dosis: "1 pasada", tipo: "LABOR", costo: 5.5 },
              { nombre: "Glifosato", dosis: "1.3 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Ampligo (si hay oruga)", dosis: "45 cc/ha", tipo: "INSECTICIDA", costo: 130 },
            ]
          },
        }
      },
      {
        id: "cosecha", label: "Cosecha", mes: "Mar–Abr", dds: 130,
        descripcion: "Cosecha soja.",
        alertas: [],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Cosecha soja", dosis: "1 pasada", tipo: "COSECHA", costo: 70 },
            ]
          },
        }
      },
    ]
  },

  MAIZ: {
    nombre: "Maíz",
    color: "#E8B83E",
    etapas: [
      {
        id: "barbecho", label: "Barbecho", mes: "Abr–Sep", dds: -90,
        descripcion: "Barbecho con atrazina como base residual. Controlar gramíneas y crucíferas.",
        alertas: ["Atrazina es la base residual del sistema", "En maíz tardío (21N): agregar Terbutilazina en pre"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Glifosato granulado", dosis: "1.7 L/ha", tipo: "HERBICIDA" },
              { nombre: "2-4D 97%", dosis: "600 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Dicamba", dosis: "200 cc/ha", tipo: "HERBICIDA" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Aceite metilado", dosis: "400 cc/ha", tipo: "ADITIVO" },
              { nombre: "Ligier PH Bio", dosis: "400 cc/ha", tipo: "ADITIVO" },
            ]
          },
        }
      },
      {
        id: "presiembra", label: "Pre-siembra", mes: "Sep–Oct", dds: -15,
        descripcion: "Repaso con atrazina. Suelo limpio a la siembra.",
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
            ]
          },
          "Maíz tardío (doble cultivo)": {
            productos: [
              { nombre: "Glifosato", dosis: "1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "Terbutilazina", dosis: "1.5 L/ha", tipo: "HERBICIDA" },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
            ]
          },
        }
      },
      {
        id: "siembra", label: "Siembra", mes: "Oct–Nov", dds: 0,
        descripcion: "Siembra maíz temprano. Tardío (doble cultivo): Dic–Ene.",
        alertas: ["Fertilización N + fósforo a la siembra", "Semilla tratada con Concep si se usa atrazina post"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Siembra gruesa", dosis: "1 pasada", tipo: "LABOR", costo: 40 },
              { nombre: "Semilla maíz (DK/Dekalb u otra)", dosis: "80.000 sem/ha", tipo: "SEMILLA" },
              { nombre: "Fertilizante arranque (MAP)", dosis: "100–150 kg/ha", tipo: "FERTILIZANTE" },
              { nombre: "Inoculante (Nitrobiot FULL)", dosis: "según marbete", tipo: "INOCULANTE" },
            ]
          },
        }
      },
      {
        id: "post", label: "Post-emergente", mes: "Nov–Dic", dds: 25,
        descripcion: "Control post-emergente V3–V6. Atención arañuela.",
        alertas: ["Atención arañuela en estrés hídrico", "Ampligo (0.1 L) según monitoreo de oruga / trips"],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Pulverización terrestre", dosis: "1 pasada", tipo: "LABOR", costo: 5.5 },
              { nombre: "Atrazina 90%", dosis: "1 kg/ha", tipo: "HERBICIDA" },
              { nombre: "Ampligo (si hay plagas)", dosis: "100 cc/ha", tipo: "INSECTICIDA", costo: 130 },
            ]
          },
        }
      },
      {
        id: "cosecha", label: "Cosecha", mes: "Mar–Abr", dds: 150,
        descripcion: "Cosecha maíz.",
        alertas: [],
        malezas: {
          "Sin maleza problema": {
            productos: [
              { nombre: "Cosecha maíz", dosis: "1 pasada", tipo: "COSECHA", costo: 65 },
            ]
          },
        }
      },
    ]
  },
};

// Colores por tipo de producto
const TIPO_COLOR = {
  HERBICIDA: "#E08A2B",
  FUNGICIDA: "#9C6FD4",
  INSECTICIDA: "#C0392B",
  FERTILIZANTE: "#3B82C4",
  FERTILIZACION: "#3B82C4",
  ADITIVO: "#78909C",
  SEMILLA: "#43A047",
  CURASEMILLA: "#26A69A",
  INOCULANTE: "#26A69A",
  LABOR: "#2E2A22",
  COSECHA: "#795548",
};
const tipoBadge = tipo => TIPO_COLOR[tipo?.toUpperCase()] || "#B5AF9D";

// ── COMPONENTE PROTOCOLOS ────────────────────────────────────
function VistaProtocolos() {
  const [cultivo, setCultivo] = useState("TRIGO");
  const [malezaSel, setMalezaSel] = useState("Sin maleza problema");
  const [etapaAbierta, setEtapaAbierta] = useState(null);

  const proto = PROTOCOLOS_DATA[cultivo];
  if (!proto) return null;

  // Obtener todas las malezas únicas del protocolo
  const todasMalezas = [...new Set(
    proto.etapas.flatMap(e => Object.keys(e.malezas))
  )];

  // Si la maleza seleccionada no existe en el cultivo actual, resetear
  const malezaActual = todasMalezas.includes(malezaSel) ? malezaSel : todasMalezas[0];

  const TINTA = "#2E2A22";
  const CREMA = "#F8F5EC";
  const FONDO = "#EFEBDF";
  const caja = { background: CREMA, border: `1.5px solid ${TINTA}`, borderRadius: 12, padding: "14px 16px" };
  const chip = (a, color) => ({
    padding: "6px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", borderRadius: 20,
    border: `1.5px solid ${color || TINTA}`,
    background: a ? (color || TINTA) : "transparent",
    color: a ? "#fff" : (color || TINTA),
    fontFamily: "inherit", whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Selector cultivo */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.6, marginRight: 4 }}>Cultivo:</span>
        {Object.entries(PROTOCOLOS_DATA).map(([key, p]) => (
          <button key={key} style={chip(cultivo === key, p.color)} onClick={() => { setCultivo(key); setEtapaAbierta(null); }}>
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Selector maleza */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.6, marginRight: 4 }}>Situación:</span>
        {todasMalezas.map(m => (
          <button key={m} style={chip(malezaActual === m)} onClick={() => setMalezaSel(m)}>
            {m}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {proto.etapas.map((etapa, idx) => {
          const productos = etapa.malezas[malezaActual] || etapa.malezas[Object.keys(etapa.malezas)[0]];
          const abierta = etapaAbierta === etapa.id;
          const costoTotal = (productos?.productos || []).reduce((s, p) => s + (p.costo && p.dosis && !isNaN(parseFloat(p.dosis)) ? p.costo * parseFloat(p.dosis) : (p.costo || 0)), 0);

          return (
            <div key={etapa.id}>
              {/* Conector vertical */}
              {idx > 0 && (
                <div style={{ display: "flex", alignItems: "stretch", gap: 0, height: 24 }}>
                  <div style={{ width: 36, display: "flex", justifyContent: "center" }}>
                    <div style={{ width: 3, background: proto.color, opacity: 0.4, flex: 1 }} />
                  </div>
                </div>
              )}

              {/* Tarjeta etapa */}
              <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
                {/* Ícono timeline */}
                <div style={{ width: 36, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: proto.color, border: `3px solid ${CREMA}`, boxShadow: `0 0 0 2px ${proto.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                    {idx + 1}
                  </div>
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div onClick={() => setEtapaAbierta(abierta ? null : etapa.id)}
                    style={{ ...caja, cursor: "pointer", padding: "12px 14px", borderLeft: `5px solid ${proto.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{etapa.label}</span>
                          <span style={{ fontSize: 11.5, background: "#E5E0D0", borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>{etapa.mes}</span>
                          {etapa.dds !== undefined && (
                            <span style={{ fontSize: 11, opacity: 0.5 }}>DDS {etapa.dds >= 0 ? `+${etapa.dds}` : etapa.dds}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 3 }}>{etapa.descripcion}</div>
                      </div>
                      <span style={{ fontSize: 18, opacity: 0.4, flexShrink: 0 }}>{abierta ? "−" : "+"}</span>
                    </div>

                    {/* Alertas */}
                    {etapa.alertas?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {etapa.alertas.map((a, i) => (
                          <span key={i} style={{ fontSize: 11.5, background: "#FFF8E1", border: "1px solid #F9A825", borderRadius: 5, padding: "2px 8px", color: "#795548" }}>
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Detalle expandido */}
                  {abierta && (
                    <div style={{ background: "#FFFDF7", border: `1px solid #D8D2C0`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>
                        Productos — {malezaActual}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {(productos?.productos || []).map((p, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: "#fff", border: "1px solid #EEE9DC", borderRadius: 8 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: tipoBadge(p.tipo), borderRadius: 5, padding: "2px 7px", flexShrink: 0, marginTop: 1 }}>
                              {p.tipo}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.nombre}</div>
                              <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 1 }}>
                                <span style={{ fontWeight: 600 }}>{p.dosis}</span>
                                {p.nota && <span style={{ marginLeft: 8, fontStyle: "italic", opacity: 0.8 }}>· {p.nota}</span>}
                              </div>
                            </div>
                            {p.costo && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#3B82C4", flexShrink: 0 }}>
                                US$ {p.costo}/u
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 4 }}>
        Fuentes: Protocolo CREA Trigo/Cebada 2023 · Protocolo Girasol 2023 · Manejo malezas CREA. Dosis referenciales — ajustar según análisis de suelo y monitoreo.
      </div>
    </div>
  );
}
export default function App(){
  // ── DATOS DINÁMICOS: cargados desde /datos.json (pipeline automático) ──
  const [datosOK, setDatosOK] = useState(null); // null=cargando, true=cargado, false=falló
  const [datosRemotos, setDatosRemotos] = useState(null);
  const [fechaDatos, setFechaDatos] = useState(null);

  useEffect(() => {
    fetch("/datos.json")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then(d => {
        setDatosRemotos(d);
        setFechaDatos(d.generado);
        setDatosOK(true);
        console.log("✓ Datos cargados de /datos.json — generado:", d.generado);
      })
      .catch(err => {
        console.warn("⚠ No pude cargar /datos.json, usando datos hardcodeados. Error:", err.message);
        setDatosOK(false);
      });
  }, []);

  // Selectores: usan datos remotos si existen, sino fallback
  const INV_26 = datosRemotos?.INV_26 || INV_26_FALLBACK;
  const PLAN_2627 = datosRemotos?.PLAN_2627 || PLAN_2627_FALLBACK;
  const CULT_2526 = datosRemotos?.CULT_2526 || CULT_2526_FALLBACK;
  const RINDE_2526 = datosRemotos?.RINDE_2526 || RINDE_2526_FALLBACK;
  const HISTORICO_ROTACION = datosRemotos?.HISTORICO_ROTACION || HISTORICO_ROTACION_FALLBACK;
  const TEXTURA_LOTE = datosRemotos?.TEXTURA_LOTE || TEXTURA_LOTE_FALLBACK;
  const SUELOS = datosRemotos?.SUELOS || SUELOS_FALLBACK;
  const APLICACIONES = datosRemotos?.APLICACIONES ?
    datosRemotos.APLICACIONES.map((a,i)=>({...a,id:i,costoHa:a.ha?a.costo/a.ha:0})).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
    : APLICACIONES_FALLBACK;
  const FERTILIZACIONES = datosRemotos?.FERTILIZACIONES ?
    datosRemotos.FERTILIZACIONES.map((f,i)=>({...f,id:i})).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
    : FERTILIZACIONES_FALLBACK;

  const [vista,setVista]=useState("mapas");        // mapas | galeria | herbicidas | acciones | ordenes | margenes | protocolos
  const [campoSel,setCampoSel]=useState("L3H");
  const [capaModo,setCapaModo]=useState("campaña"); // campaña|rindes|margenes|suelos
  const [sueloVar,setSueloVar]=useState("P");
  const [campoFiltro,setCampoFiltro]=useState("TODOS");
  const [acciones,setAcciones]=useState(ACCIONES_INIT);
  const [nuevaAcc,setNuevaAcc]=useState({campo:"L3H",lote:"",accion:"",fecha:"2026-07-15",prioridad:"media"});
  const [showForm,setShowForm]=useState(false);
  const [pintura,setPintura]=useState({});
  const [brocha,setBrocha]=useState(0);
  const [etiquetas,setEtiquetas]=useState(["","","",""]);
  const [titulos,setTitulos]=useState({});
  const [loteAbierto,setLoteAbierto]=useState(null); // {campo, lote} para modal historial
  const [campSel,setCampSel]=useState("26-27");
  const svgRef=useRef(null);

  const abrirLote=(campo,lote)=>setLoteAbierto({campo,lote});
  const cerrarLote=()=>setLoteAbierto(null);

  const caja={background:CREMA,border:`1.5px solid ${TINTA}`,borderRadius:12,padding:"14px 16px"};
  const tab=(a)=>({padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:8,
    border:`1.5px solid ${TINTA}`,background:a?TINTA:"transparent",color:a?CREMA:TINTA,fontFamily:"inherit",whiteSpace:"nowrap"});
  const chip=(a)=>({padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer",borderRadius:20,
    border:`1.5px solid ${TINTA}`,background:a?TINTA:"transparent",color:a?CREMA:TINTA,fontFamily:"inherit"});

  const campo=CAMPOS.find(c=>c.id===campoSel);
  const haTotal=CAMPOS.reduce((s,c)=>s+haCampo(c),0);

  // órdenes helpers
  const clL=(ci,li)=>`${ci}|${li}`;
  const lotesDe=cid=>CAMPOS.find(c=>c.id===cid).lotes;
  const haCol=(cid,i)=>lotesDe(cid).filter(l=>pintura[clL(cid,l.id)]===i).reduce((s,l)=>s+(Number(l.ha)||0),0);
  const haPint=cid=>COLORES_APP.reduce((s,_,i)=>s+haCol(cid,i),0);
  const colEn=COLORES_APP.map((_,i)=>i).filter(i=>lotesDe(campoSel).some(l=>pintura[clL(campoSel,l.id)]===i));
  const tit=titulos[campoSel]??"Orden de aplicación";
  const campoOrd=CAMPOS.find(c=>c.id===campoSel);
  const pintarL=lid=>{const k2=clL(campoSel,lid);setPintura(p=>{const n={...p};if(n[k2]===brocha)delete n[k2];else n[k2]=brocha;return n;});};
  const limpiarOrd=()=>setPintura(p=>{const n={...p};lotesDe(campoSel).forEach(l=>delete n[clL(campoSel,l.id)]);return n;});
  const descargarPNG=()=>{
    const svg=svgRef.current;if(!svg)return;
    const vb=svg.getAttribute("viewBox").split(" ").map(Number);
    const escala=1500/vb[2],W=1500,H=Math.round(vb[3]*escala);
    const clon=svg.cloneNode(true);
    clon.setAttribute("xmlns","http://www.w3.org/2000/svg");
    clon.setAttribute("width",String(W));clon.setAttribute("height",String(H));
    const fondo=document.createElementNS("http://www.w3.org/2000/svg","rect");
    fondo.setAttribute("x",String(vb[0]));fondo.setAttribute("y",String(vb[1]));
    fondo.setAttribute("width",String(vb[2]));fondo.setAttribute("height",String(vb[3]));
    fondo.setAttribute("fill","#FFFFFF");clon.insertBefore(fondo,clon.firstChild);
    const blob=new Blob([new XMLSerializer().serializeToString(clon)],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      const cv=document.createElement("canvas");cv.width=W;cv.height=H;
      const ctx=cv.getContext("2d");ctx.fillStyle="#FFF";ctx.fillRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);
      const a=document.createElement("a");a.download=`aplicacion_${campoSel.replace(/\s/g,"_")}.png`;
      a.href=cv.toDataURL("image/png");a.click();URL.revokeObjectURL(url);
    };img.src=url;
  };

  // herbicidas
  const aplFilt=useMemo(()=>campoFiltro==="TODOS"?APLICACIONES:APLICACIONES.filter(a=>a.campo===campoFiltro),[campoFiltro]);
  const haApl=aplFilt.reduce((s,a)=>s+a.ha,0);
  const costoApl=aplFilt.reduce((s,a)=>s+a.costo,0);

  // acciones
  const toggleH=id=>setAcciones(p=>p.map(a=>a.id===id?{...a,hecha:!a.hecha}:a));
  const elimA=id=>setAcciones(p=>p.filter(a=>a.id!==id));
  const agregarA=()=>{
    if(!nuevaAcc.accion.trim())return;
    setAcciones(p=>[...p,{...nuevaAcc,id:Date.now(),hecha:false}]);
    setNuevaAcc({campo:"L3H",lote:"",accion:"",fecha:"2026-07-15",prioridad:"media"});
    setShowForm(false);
  };

  // suelos tabla
  const suelosTabla=Object.entries(SUELOS).map(([k,s])=>{
    const[ci,li]=k.split("|");return {...s,campo:ci,lote:li};
  }).sort((a,b)=>a.campo.localeCompare(b.campo));

  // margenes tabla
  const mbTabla=Object.entries(MB_LOTE).map(([k,m])=>{
    const[ci,li]=k.split("|");return {...m,campo:ci,lote:li};
  }).sort((a,b)=>b.mbsa-a.mbsa);

  const CAPAS=[
    {id:"campaña",lbl:"🌾 Campaña 26-27"},
    {id:"rindes",lbl:"📈 Rindes 25-26"},
    {id:"margenes",lbl:"💵 Márgenes 25-26"},
    {id:"suelos",lbl:"🔬 Análisis de suelo"},
  ];

  const inputB={width:"100%",boxSizing:"border-box",padding:"6px 8px",fontSize:13,border:"1px solid #C8C2B0",borderRadius:6,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"};

  return (
    <div style={{minHeight:"100vh",background:FONDO,padding:"20px 14px",fontFamily:"'Avenir Next','Segoe UI',system-ui,sans-serif",color:TINTA}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>

        {/* Header */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,letterSpacing:"0.25em",textTransform:"uppercase",opacity:0.5}}>SMIX · General Pico, La Pampa · campaña 26-27</div>
          <div style={{fontSize:10.5,opacity:0.55,marginTop:4,display:"flex",alignItems:"center",gap:6}}>
            {datosOK === null && <><span>⏳</span> Cargando datos…</>}
            {datosOK === true && fechaDatos && <><span style={{color:"#43A047"}}>●</span> Datos actualizados: {new Date(fechaDatos).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",dateStyle:"short",timeStyle:"short"})}</>}
            {datosOK === false && <><span style={{color:"#C0392B"}}>●</span> Sin conexión a datos actualizados (modo offline)</>}
          </div>
          <h1 style={{margin:"2px 0 4px",fontSize:26,fontWeight:700}}>Gestión integral de campos</h1>
          <div style={{fontSize:13,opacity:0.6}}>{CAMPOS.length} campos · {fmt(haTotal)} ha totales · {APLICACIONES.length} aplicaciones registradas</div>
        </div>

        {/* TABS PRINCIPALES */}
        <div style={{display:"flex",gap:7,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
          <button style={tab(vista==="mapas")} onClick={()=>setVista("mapas")}>🗺️ Mapa por campo</button>
          <button style={tab(vista==="galeria")} onClick={()=>setVista("galeria")}>🗂️ Todos los campos</button>
          <button style={tab(vista==="herbicidas")} onClick={()=>setVista("herbicidas")}>🧪 Herbicidas</button>
          <button style={tab(vista==="fertilizaciones")} onClick={()=>setVista("fertilizaciones")}>🌱 Fertilizaciones</button>
          <button style={tab(vista==="acciones")} onClick={()=>setVista("acciones")}>📅 Próximas acciones</button>
          <button style={tab(vista==="margenes")} onClick={()=>setVista("margenes")}>💵 Márgenes</button>
          <button style={tab(vista==="ordenes")} onClick={()=>setVista("ordenes")}>🖨️ Órdenes de aplicación</button>
          <button style={tab(vista==="protocolos")} onClick={()=>setVista("protocolos")}>📋 Protocolos</button>
        </div>

        {/* ══ MAPA POR CAMPO ══ */}
        {vista==="mapas"&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-start"}}>
            {/* controles */}
            <div style={{width:"100%",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <select value={campoSel} onChange={e=>setCampoSel(e.target.value)}
                style={{padding:"9px 13px",fontSize:15,fontWeight:600,border:`1.5px solid ${TINTA}`,borderRadius:8,background:CREMA,color:TINTA,fontFamily:"inherit",cursor:"pointer"}}>
                {CAMPOS.map(c=><option key={c.id} value={c.id}>{c.nombre} · {fmt(haCampo(c))} ha</option>)}
              </select>
              {CAPAS.map(c=><button key={c.id} style={chip(capaModo===c.id)} onClick={()=>setCapaModo(c.id)}>{c.lbl}</button>)}
            </div>
            {/* suelo sub-chips */}
            {capaModo==="suelos"&&(
              <div style={{display:"flex",gap:6}}>
                {[["P","🟠 Fósforo"],["N","🔵 Nitrógeno"],["MO","🟢 Mat. Orgánica"]].map(([v,l])=>(
                  <button key={v} style={chip(sueloVar===v)} onClick={()=>setSueloVar(v)}>{l}</button>
                ))}
              </div>
            )}
            {/* mapa */}
            <div style={{flex:"1 1 560px",background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:12,padding:10,boxShadow:"0 2px 10px rgba(46,42,34,.1)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6,paddingInline:4}}>
                <div style={{fontWeight:700,fontSize:15}}>{campo.nombre}</div>
                <div style={{fontSize:12,opacity:0.6}}>{PRODUCTOR[campo.id]} · {fmt(haCampo(campo))} ha</div>
              </div>
              <MapaCampo campo={campo} modo={capaModo} sueloVar={sueloVar} onLoteClick={abrirLote} datos={{INV_26,PLAN_2627,RINDE_2526,SUELOS}}/>
              <div style={{paddingInline:4}}><Leyenda modo={capaModo} sueloVar={sueloVar}/></div>
              {/* Resumen ha por cultivo — campaña 26-27 */}
              {capaModo==="campaña"&&(()=>{
                const acum={};
                campo.lotes.forEach(l=>{
                  const inv=INV_26[`${campo.id}|${l.id}`];
                  const plan=PLAN_2627[`${campo.id}|${l.id}`];
                  let fina=inv, gruesa=null;
                  if(plan){
                    if(plan.includes("-")){
                      const [f,g]=plan.split("-").map(s=>s.trim());
                      fina=fina||f; gruesa=g;
                    } else gruesa=plan;
                  }
                  if(fina&&gruesa&&baseCv(fina)===baseCv(gruesa)) gruesa=null;
                  // Separar 2da: gruesa que va sobre fina cosechada o sobre verdeo
                  // se etiqueta como "MAIZ 2" o "SOJA 2"
                  let etiquetaGruesa=gruesa;
                  if(gruesa&&fina){
                    const finaBase=baseCv(fina);
                    const gruesaBase=baseCv(gruesa);
                    // Si la fina es un cultivo cosechable (cebada, trigo, avena, centeno) o verdeo
                    // → la gruesa es de 2da
                    const finasCosechables=["CEBADA","TRIGO","AVENA","CENTENO","VERDEO"];
                    if(finasCosechables.includes(finaBase)){
                      if(gruesaBase==="MAIZ") etiquetaGruesa="MAIZ 2";
                      else if(gruesaBase==="SOJA") etiquetaGruesa="SOJA 2";
                      else if(gruesaBase==="GIRASOL") etiquetaGruesa="GIRASOL 2";
                    }
                  }
                  if(fina) acum[fina]=(acum[fina]||0)+l.ha;
                  if(etiquetaGruesa) acum[etiquetaGruesa]=(acum[etiquetaGruesa]||0)+l.ha;
                  if(!fina&&!gruesa) acum["sin sembrar"]=(acum["sin sembrar"]||0)+l.ha;
                });
                const rows=Object.entries(acum).sort((a,b)=>b[1]-a[1]);
                const total=rows.reduce((s,[_,ha])=>s+ha,0);
                return (
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1.5px dashed #D8D2C0",paddingInline:4}}>
                    <div style={{fontSize:11,letterSpacing:"0.18em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>Resumen ha por cultivo</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {rows.map(([cv,ha])=>{
                        const pct=(ha/total*100).toFixed(0);
                        const es2da=/\s2$/.test(cv);
                        return <div key={cv} style={{display:"flex",alignItems:"center",gap:7,background:"#FFFDF7",border:"1px solid #E5E0D0",borderRadius:8,padding:"6px 10px",fontSize:12.5}}>
                          <span style={{width:11,height:11,borderRadius:3,background:cv==="sin sembrar"?"#F0EDE5":colorCv(cv),border:`1px solid ${TINTA}`,flexShrink:0,opacity:es2da?0.7:1}}/>
                          <span style={{fontWeight:700}}>{cv}</span>
                          <span style={{opacity:0.6}}>·</span>
                          <span style={{fontWeight:600}}>{fmt(ha)} ha</span>
                          <span style={{opacity:0.55,fontSize:11}}>({pct}%)</span>
                        </div>;
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* panel suelos si aplica */}
            {capaModo==="suelos"&&(
              <div style={{flex:"1 1 300px",maxWidth:400,...caja}}>
                <div style={{fontSize:11,letterSpacing:"0.18em",textTransform:"uppercase",opacity:0.55,marginBottom:10}}>Análisis de suelo — {campo.nombre}</div>
                {suelosTabla.filter(s=>s.campo===campo.id).length===0
                  ?<div style={{fontSize:13,opacity:0.6}}>Sin análisis cargados para este campo. Por ahora hay datos de Las Tres Hermanas (2017-2025).</div>
                  :(
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                      <thead><tr style={{background:"#E5E0D0"}}>
                        {["Lote","Fecha","P ppm","N kg/ha","MO %","IMO"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:11,textTransform:"uppercase",opacity:0.7}}>{h}</th>)}
                      </tr></thead>
                      <tbody>{suelosTabla.filter(s=>s.campo===campo.id).map((s,i)=>(
                        <tr key={i} style={{borderTop:"1px solid #E5E0D0"}}>
                          <td style={{padding:"5px 8px",fontWeight:700}}>{s.lote}</td>
                          <td style={{padding:"5px 8px",opacity:0.7}}>{s.fecha}</td>
                          <td style={{padding:"5px 8px"}}>{s.P??"-"}</td>
                          <td style={{padding:"5px 8px"}}>{s.N??"-"}</td>
                          <td style={{padding:"5px 8px"}}>{s.MO??"-"}</td>
                          <td style={{padding:"5px 8px"}}>{s.IMO||"-"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
              </div>
            )}
          </div>
        )}

        {/* ══ GALERÍA TODOS LOS CAMPOS ══ */}
        {vista==="galeria"&&(
          <div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
              <span style={{fontSize:13,opacity:0.65}}>Capa:</span>
              {CAPAS.map(c=><button key={c.id} style={chip(capaModo===c.id)} onClick={()=>setCapaModo(c.id)}>{c.lbl}</button>)}
              {capaModo==="suelos"&&[["P","🟠 P"],["N","🔵 N"],["MO","🟢 MO"]].map(([v,l])=>(
                <button key={v} style={chip(sueloVar===v)} onClick={()=>setSueloVar(v)}>{l}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
              {CAMPOS.map(c=>(
                <div key={c.id} style={{background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:12,padding:10,boxShadow:"0 1px 6px rgba(46,42,34,.08)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                    <div style={{fontWeight:700,fontSize:14}}>{c.nombre}</div>
                    <div style={{fontSize:12,opacity:0.55}}>{PRODUCTOR[c.id]} · {fmt(haCampo(c))} ha</div>
                  </div>
                  <MapaCampo campo={c} modo={capaModo} sueloVar={sueloVar} mini={false} onLoteClick={abrirLote} datos={{INV_26,PLAN_2627,RINDE_2526,SUELOS}}/>
                  <div style={{marginTop:4}}><Leyenda modo={capaModo} sueloVar={sueloVar}/></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ HERBICIDAS ══ */}
        {vista==="herbicidas"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <select value={campoFiltro} onChange={e=>setCampoFiltro(e.target.value)}
                style={{padding:"9px 12px",fontSize:14,fontWeight:600,border:`1.5px solid ${TINTA}`,borderRadius:8,background:CREMA,color:TINTA,fontFamily:"inherit"}}>
                <option value="TODOS">Todos los campos</option>
                {[...new Set(APLICACIONES.map(a=>a.campo))].sort().map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{fontSize:12.5,opacity:0.6}}>Datos de la hoja "registro" de BH Pelayo.</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
              {[{l:"Aplicaciones",v:aplFilt.length},{l:"Ha aplicadas",v:`${fmt(haApl)} ha`},{l:"Costo total",v:`US$ ${fmt(costoApl)}`},{l:"Costo prom. /ha",v:`US$ ${fmt1(haApl?costoApl/haApl:0)}`}]
                .map((s,i)=><div key={i} style={{...caja,textAlign:"center"}}><div style={{fontSize:20,fontWeight:700}}>{s.v}</div><div style={{fontSize:11.5,opacity:0.65,marginTop:2}}>{s.l}</div></div>)}
            </div>
            <div style={{...caja,padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:700}}>
                  <thead><tr style={{background:"#E5E0D0"}}>
                    {["Fecha","Campo","Lote","Cultivo","Ha","Productos","Costo","$/ha"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"8px 11px",fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",opacity:0.7,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{aplFilt.map(a=>(
                    <tr key={a.id} style={{borderTop:"1px solid #E5E0D0"}}>
                      <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}>{fechaCorta(a.fecha)}</td>
                      <td style={{padding:"7px 11px",fontWeight:600,whiteSpace:"nowrap"}}>{a.campo}</td>
                      <td style={{padding:"7px 11px"}}>{a.lote}</td>
                      <td style={{padding:"7px 11px"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:colorCv(a.cultivo),flexShrink:0}}/>{a.cultivo}</span></td>
                      <td style={{padding:"7px 11px"}}>{a.ha}</td>
                      <td style={{padding:"7px 11px",fontSize:11.5,opacity:0.85,maxWidth:260}}>{a.productos.join(", ")}</td>
                      <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}>US$ {fmt(a.costo)}</td>
                      <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}>US$ {fmt1(a.costoHa)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ FERTILIZACIONES ══ */}
        {vista==="fertilizaciones"&&(()=>{
          const fertFilt = campoFiltro==="TODOS" ? FERTILIZACIONES : FERTILIZACIONES.filter(f=>f.campo===campoFiltro);
          const haFert = fertFilt.reduce((s,f)=>s+f.ha,0);
          const costoFert = fertFilt.reduce((s,f)=>s+f.ha*(f.costoHa||0),0);
          const camposFert = [...new Set(FERTILIZACIONES.map(f=>f.campo))].sort();
          return (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <select value={campoFiltro} onChange={e=>setCampoFiltro(e.target.value)}
                  style={{padding:"9px 12px",fontSize:14,fontWeight:600,border:`1.5px solid ${TINTA}`,borderRadius:8,background:CREMA,color:TINTA,fontFamily:"inherit"}}>
                  <option value="TODOS">Todos los campos</option>
                  {camposFert.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{fontSize:12.5,opacity:0.6}}>Registro de fertilizaciones — arranque, N temprana, N tardía.</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
                {[{l:"Aplicaciones",v:fertFilt.length},{l:"Ha fertilizadas",v:`${fmt(haFert)} ha`},{l:"Costo total",v:`US$ ${fmt(costoFert)}`},{l:"Costo prom. /ha",v:`US$ ${fmt1(haFert?costoFert/haFert:0)}`}]
                  .map((s,i)=><div key={i} style={{...caja,textAlign:"center"}}><div style={{fontSize:20,fontWeight:700}}>{s.v}</div><div style={{fontSize:11.5,opacity:0.65,marginTop:2}}>{s.l}</div></div>)}
              </div>
              <div style={{...caja,padding:0,overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:700}}>
                    <thead><tr style={{background:"#E5E0D0"}}>
                      {["Fecha","Campo","Lote","Cultivo","Ha","Tipo","Producto","Dosis","$/ha","Total"].map(h=>(
                        <th key={h} style={{textAlign:"left",padding:"8px 11px",fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",opacity:0.7,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{fertFilt.map(f=>(
                      <tr key={f.id} style={{borderTop:"1px solid #E5E0D0"}}>
                        <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}>{fechaCorta(f.fecha)}</td>
                        <td style={{padding:"7px 11px",fontWeight:600,whiteSpace:"nowrap"}}>{f.campo}</td>
                        <td style={{padding:"7px 11px"}}>{f.lote}</td>
                        <td style={{padding:"7px 11px"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:colorCv(f.cultivo)}}/>{f.cultivo}</span></td>
                        <td style={{padding:"7px 11px"}}>{f.ha}</td>
                        <td style={{padding:"7px 11px"}}><span style={{fontSize:11,background:"#E3F2FD",color:"#0D47A1",borderRadius:5,padding:"2px 7px",fontWeight:700}}>{f.tipo}</span></td>
                        <td style={{padding:"7px 11px",fontWeight:600}}>{f.producto}</td>
                        <td style={{padding:"7px 11px"}}>{f.dosis}</td>
                        <td style={{padding:"7px 11px",whiteSpace:"nowrap"}}>US$ {fmt1(f.costoHa||0)}</td>
                        <td style={{padding:"7px 11px",whiteSpace:"nowrap",fontWeight:600}}>US$ {fmt(f.ha*(f.costoHa||0))}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ ACCIONES (deducidas + manuales) ══ */}
        {vista==="acciones"&&(()=>{
          const accionesDeducidas = generarProximasAcciones(CAMPOS, INV_26, PLAN_2627, APLICACIONES, FERTILIZACIONES);
          // Agrupar por cultivo → etapa
          const porCultivo = {};
          accionesDeducidas.forEach(a=>{
            const cvBase = baseCv(a.cultivo);
            if(!porCultivo[cvBase]) porCultivo[cvBase] = { color: a.color, etapas: {} };
            const eKey = a.etapa.id;
            if(!porCultivo[cvBase].etapas[eKey]) porCultivo[cvBase].etapas[eKey] = { etapa: a.etapa, lotes: [], haTotal: 0 };
            porCultivo[cvBase].etapas[eKey].lotes.push(a);
            porCultivo[cvBase].etapas[eKey].haTotal += a.ha;
          });
          return (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{...caja,fontSize:13,opacity:0.85,lineHeight:1.5}}>
                <b>🤖 Acciones auto-deducidas</b> a partir del cultivo asignado, las aplicaciones realizadas y el protocolo. Los lotes se agrupan por cultivo y próxima etapa. Cada grupo indica los productos sugeridos del protocolo.
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,opacity:0.7}}>{accionesDeducidas.length} lotes con próxima acción · {acciones.filter(a=>!a.hecha).length} manuales pendientes</div>
                <button onClick={()=>setShowForm(v=>!v)} style={{padding:"9px 14px",fontSize:13.5,fontWeight:700,cursor:"pointer",borderRadius:9,border:`1.5px solid ${TINTA}`,background:showForm?"transparent":TINTA,color:showForm?TINTA:CREMA,fontFamily:"inherit"}}>{showForm?"Cancelar":"+ Acción manual"}</button>
              </div>
              {showForm&&(
                <div style={{...caja,display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
                  {[["Campo","select",[...CAMPOS.map(c=>c.id)],"campo"],["Lote(s)","text","ej: 5, 8B","lote"],["Acción","text","ej: Monitoreo","accion"],["Fecha","date","","fecha"]].map(([lbl,type,opts,key])=>(
                    <div key={key} style={{display:"flex",flexDirection:"column",gap:4,flex:type==="text"&&key==="accion"?"1 1 200px":"initial"}}>
                      <label style={{fontSize:11,opacity:0.6}}>{lbl}</label>
                      {type==="select"
                        ?<select value={nuevaAcc[key]} onChange={e=>setNuevaAcc(p=>({...p,[key]:e.target.value}))} style={{padding:"7px 9px",fontSize:13,border:"1px solid #C8C2B0",borderRadius:6,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"}}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>
                        :<input type={type} value={nuevaAcc[key]} placeholder={opts} onChange={e=>setNuevaAcc(p=>({...p,[key]:e.target.value}))} style={{...inputB,width:type==="date"?"auto":type==="text"&&key!=="accion"?"110px":"auto"}}/>}
                    </div>
                  ))}
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:11,opacity:0.6}}>Prioridad</label>
                    <select value={nuevaAcc.prioridad} onChange={e=>setNuevaAcc(p=>({...p,prioridad:e.target.value}))} style={{padding:"7px 9px",fontSize:13,border:"1px solid #C8C2B0",borderRadius:6,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"}}>
                      <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                    </select>
                  </div>
                  <button onClick={agregarA} style={{padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:7,border:"none",background:VERDE,color:"#fff",fontFamily:"inherit"}}>Guardar</button>
                </div>
              )}

              {/* Acciones auto-deducidas agrupadas */}
              {Object.entries(porCultivo).map(([cvBase, data])=>(
                <div key={cvBase} style={{...caja,borderLeft:`5px solid ${data.color}`,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{width:14,height:14,borderRadius:3,background:data.color}}/>
                    <span style={{fontWeight:700,fontSize:15}}>{cvBase}</span>
                    <span style={{fontSize:12,opacity:0.6}}>{Object.keys(data.etapas).length} etapa(s) pendiente(s)</span>
                  </div>
                  {Object.entries(data.etapas).map(([eKey,eData])=>{
                    // productos sugeridos: usar primera situación de la etapa (por defecto "Sin maleza problema" o similar)
                    const primeraSit = Object.keys(eData.etapa.malezas)[0];
                    const productos = eData.etapa.malezas[primeraSit]?.productos || [];
                    return (
                      <div key={eKey} style={{background:"#FFFDF7",border:"1px solid #E2DDCD",borderRadius:9,padding:"10px 12px",marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
                          <div style={{fontWeight:700,fontSize:14}}>➜ {eData.etapa.label}</div>
                          <div style={{fontSize:12,opacity:0.6}}>{eData.lotes.length} lotes · {fmt(eData.haTotal)} ha · {eData.etapa.mes}</div>
                        </div>
                        <div style={{fontSize:12,opacity:0.7,marginTop:3}}>{eData.etapa.descripcion}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                          {eData.lotes.sort((a,b)=>b.ha-a.ha).map((l,i)=>(
                            <span key={i} style={{fontSize:11.5,background:"#fff",border:"1px solid #D8D2C0",borderRadius:6,padding:"3px 8px"}} title={`${l.campoNombre} · ${l.cultivo} · ${l.completadas}/${l.totalEtapas} etapas`}>
                              {l.campo}-{l.lote} <span style={{opacity:0.5}}>· {l.ha} ha</span>
                            </span>
                          ))}
                        </div>
                        {productos.length>0&&(
                          <div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #D8D2C0"}}>
                            <div style={{fontSize:10.5,letterSpacing:"0.1em",textTransform:"uppercase",opacity:0.55,marginBottom:5}}>Sugerencia protocolo</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                              {productos.map((p,i)=>(
                                <span key={i} style={{fontSize:11,background:"#F3EFE3",borderRadius:5,padding:"2px 7px"}}>
                                  <b>{p.nombre}</b> · {p.dosis}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Acciones manuales */}
              {acciones.length>0&&(
                <div>
                  <div style={{fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",opacity:0.55,marginTop:6,marginBottom:8}}>Acciones manuales</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[...acciones].sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).map(a=>{
                      const dias=diasHasta(a.fecha);
                      const venc=dias<0&&!a.hecha;
                      const cp=a.prioridad==="alta"?ROJO:a.prioridad==="media"?NARANJA:AZUL;
                      return <div key={a.id} style={{...caja,display:"flex",alignItems:"center",gap:12,opacity:a.hecha?0.5:1,borderLeft:`5px solid ${venc?ROJO:cp}`}}>
                        <input type="checkbox" checked={a.hecha} onChange={()=>toggleH(a.id)} style={{width:18,height:18,cursor:"pointer",flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,textDecoration:a.hecha?"line-through":"none"}}>{a.accion}</div>
                          <div style={{fontSize:12.5,opacity:0.7,marginTop:1}}>
                            {a.campo} · lote {a.lote||"—"} · {fechaCorta(a.fecha)}
                            {!a.hecha&&(venc?<span style={{color:ROJO,fontWeight:700}}> · vencida</span>:dias<=7?<span style={{color:NARANJA,fontWeight:700}}> · en {dias} días</span>:` · en ${dias} días`)}
                          </div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:cp,textTransform:"uppercase",flexShrink:0}}>{a.prioridad}</span>
                        <button onClick={()=>elimA(a.id)} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,opacity:0.4,flexShrink:0}}>✕</button>
                      </div>;
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ══ MÁRGENES ══ */}
        {vista==="margenes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{...caja,fontSize:13,opacity:0.85,lineHeight:1.5}}>
              Márgenes 25-26 por lote. <b>MB s/alquiler</b> = resultado antes de descontar el alquiler. Los maíces sin rinde cargado muestran resultado provisorio negativo — se actualiza cuando cargues el rinde de cosecha.
            </div>
            <div style={{...caja,padding:0,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:680}}>
                  <thead><tr style={{background:"#E5E0D0"}}>
                    {["Campo","Lote","Cultivo","Ha","Costo dir. /ha","Rinde qq","MB /ha","MB s/alq /ha"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"8px 11px",fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",opacity:0.7,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{mbTabla.map((m,i)=>(
                    <tr key={i} style={{borderTop:"1px solid #E5E0D0"}}>
                      <td style={{padding:"7px 11px",fontWeight:600,whiteSpace:"nowrap"}}>{m.campo}</td>
                      <td style={{padding:"7px 11px"}}>{m.lote}</td>
                      <td style={{padding:"7px 11px"}}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:colorCv(m.cultivo)}}/>{m.cultivo}</span></td>
                      <td style={{padding:"7px 11px"}}>{m.ha}</td>
                      <td style={{padding:"7px 11px"}}>US$ {fmt(m.dir)}</td>
                      <td style={{padding:"7px 11px",opacity:m.rinde?1:0.4}}>{m.rinde||"s/d"}</td>
                      <td style={{padding:"7px 11px",fontWeight:700,color:m.mb>=0?VERDE:ROJO}}>{m.mb>=0?"+":""}{fmt(m.mb)}</td>
                      <td style={{padding:"7px 11px",fontWeight:700,color:m.mbsa>=0?VERDE:ROJO}}>{m.mbsa>=0?"+":""}{fmt(m.mbsa)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ ÓRDENES DE APLICACIÓN ══ */}
        {vista==="ordenes"&&(()=>{
          const [vx,vy,vw,vh]=campoOrd.vb;
          const k=vw/700;
          const banda=(62+Math.max(colEn.length,0)*21+14)*k;
          return (
            <div style={{display:"flex",flexWrap:"wrap",gap:18,alignItems:"flex-start"}}>
              <div style={{flex:"1 1 560px"}}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
                  <select value={campoSel} onChange={e=>setCampoSel(e.target.value)}
                    style={{padding:"9px 13px",fontSize:15,fontWeight:600,border:`1.5px solid ${TINTA}`,borderRadius:8,background:CREMA,color:TINTA,fontFamily:"inherit",cursor:"pointer"}}>
                    {CAMPOS.map(c=><option key={c.id} value={c.id}>{c.nombre}{haPint(c.id)?` ● ${fmt(haPint(c.id))} ha`:""}</option>)}
                  </select>
                  <div style={{fontSize:12.5,opacity:0.65}}>Pintá lotes → exportá PNG para WhatsApp</div>
                </div>
                <div style={{background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:12,padding:10,boxShadow:"0 2px 10px rgba(46,42,34,.12)"}}>
                  <svg ref={svgRef} viewBox={`${vx} ${vy-banda} ${vw} ${vh+banda}`} style={{width:"100%",height:"auto",display:"block"}}>
                    <text x={vx+12*k} y={vy-banda+26*k} fontSize={19*k} fontWeight="700" fill={TINTA}>{tit}</text>
                    <text x={vx+12*k} y={vy-banda+46*k} fontSize={12*k} fill="#8A8270">{campoOrd.nombre} · {fmt(haPint(campoSel))} ha a aplicar</text>
                    {colEn.map((i,fi)=>(
                      <g key={i} transform={`translate(${vx+12*k},${vy-banda+(58+fi*21)*k})`}>
                        <rect width={14*k} height={14*k} rx={3*k} fill={COLORES_APP[i]} stroke={TINTA} strokeWidth={k}/>
                        <text x={20*k} y={11.5*k} fontSize={12*k} fill={TINTA}>{etiquetas[i]||`Tratamiento ${i+1}`} · {fmt(haCol(campoSel,i))} ha</text>
                      </g>
                    ))}
                    {(campoOrd.refs||[]).map((r,j)=>(
                      <text key={j} x={r.x} y={r.y} fontSize={11*k} fontStyle="italic" fill="#8A8270" textAnchor="middle" transform={r.rot?`rotate(${r.rot} ${r.x} ${r.y})`:undefined}>{r.t}</text>
                    ))}
                    {(campoOrd.grises||[]).map((g,j)=>{
                      const[cx,cy]=centro(g.poly);
                      return <g key={j}>
                        <polygon points={g.poly.map(p=>p.join(",")).join(" ")} fill="#EDEBE3" stroke="#B5AF9D" strokeWidth={k}/>
                        {g.label&&<text x={cx} y={cy} fontSize={11*k} fontStyle="italic" textAnchor="middle" fill="#9A937E">{g.label}</text>}
                      </g>;
                    })}
                    {campoOrd.lotes.map(l=>{
                      const idx=pintura[clL(campoSel,l.id)];
                      const pint=idx!==undefined;
                      const [cx,cy]=centro(l.poly);
                      const w=anchoP(l.poly);
                      const mHa=Number(l.ha)>0&&w>=40*k;
                      return <g key={l.id} onClick={()=>pintarL(l.id)} style={{cursor:"pointer"}}>
                        <polygon points={l.poly.map(p=>p.join(",")).join(" ")} fill={pint?COLORES_APP[idx]:"#FFFFFF"} fillOpacity={pint?0.85:1} stroke={TINTA} strokeWidth={(pint?2.2:1.2)*k}/>
                        <g style={{pointerEvents:"none"}}>
                          <text x={cx} y={cy+(mHa?0:4*k)} fontSize={(w<55*k?11:14)*k} fontWeight="700" textAnchor="middle" fill={pint?"#FFF":TINTA} opacity={pint?1:0.5} style={pint?{paintOrder:"stroke",stroke:"rgba(0,0,0,0.25)",strokeWidth:2*k}:{}}>{l.label}</text>
                          {mHa&&<text x={cx} y={cy+13*k} fontSize={9.5*k} textAnchor="middle" fill={pint?"#FFF":TINTA} opacity={pint?0.95:0.45}>{l.ha} ha</text>}
                        </g>
                      </g>;
                    })}
                  </svg>
                </div>
              </div>
              <div style={{flex:"1 1 290px",maxWidth:380,display:"flex",flexDirection:"column",gap:12}}>
                <div style={caja}>
                  <div style={{fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>Título · {campoOrd.nombre}</div>
                  <input value={tit} onChange={e=>setTitulos(p=>({...p,[campoSel]:e.target.value}))} placeholder="Ej: Barbecho junio 2026" style={{...inputB,fontSize:14}}/>
                </div>
                <div style={caja}>
                  <div style={{fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",opacity:0.55,marginBottom:10}}>Tratamientos</div>
                  <div style={{fontSize:12.5,opacity:0.65,marginBottom:10}}>Elegí un color y tocá los lotes. Tocá de nuevo para despintar.</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {COLORES_APP.map((color,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                        <button onClick={()=>setBrocha(i)} style={{width:30,height:30,borderRadius:8,cursor:"pointer",background:color,flexShrink:0,border:brocha===i?`3px solid ${TINTA}`:"2px solid rgba(46,42,34,0.25)",boxShadow:brocha===i?"0 0 0 2px #F8F5EC inset":"none"}}/>
                        <input value={etiquetas[i]} placeholder={`Tratamiento ${i+1}`} onChange={e=>setEtiquetas(p=>p.map((t,j)=>j===i?e.target.value:t))} style={inputB}/>
                        <span style={{fontSize:13,fontWeight:600,minWidth:52,textAlign:"right"}}>{fmt(haCol(campoSel,i))} ha</span>
                      </div>
                    ))}
                  </div>
                  <div style={{borderTop:"1px solid #D8D2C0",marginTop:12,paddingTop:10,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700}}>
                    <span>Total {campoOrd.nombre}</span><span>{fmt(haPint(campoSel))} ha</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button onClick={descargarPNG} style={{flex:1,padding:"12px 14px",fontSize:15,fontWeight:700,cursor:"pointer",border:"none",borderRadius:10,background:TINTA,color:"#F3EFE3",fontFamily:"inherit"}}>⬇ PNG de {campoOrd.nombre}</button>
                  <button onClick={limpiarOrd} style={{padding:"12px 14px",fontSize:14,fontWeight:600,cursor:"pointer",border:`1.5px solid ${TINTA}`,borderRadius:10,background:"transparent",color:TINTA,fontFamily:"inherit"}}>Limpiar</button>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{fontSize:11,opacity:0.45,marginTop:20,textAlign:"center"}}>
          Invierno 26-27: sembrado al 30/6/2026. Análisis de suelo: L3H 2017-2025. Márgenes: 25-26 cosechado.
        </div>

        {/* ══ PROTOCOLOS ══ */}
        {vista==="protocolos"&&<VistaProtocolos/>}

        <div style={{fontSize:11,opacity:0.45,marginTop:20,textAlign:"center"}}>
        </div>
      </div>

      {/* MODAL HISTORIAL LOTE */}
      {loteAbierto&&<ModalHistorial loteInfo={loteAbierto} onClose={cerrarLote} campSel={campSel} setCampSel={setCampSel} historico={HISTORICO_ROTACION}/>}
    </div>
  );
}

// ============================================================
// MODAL HISTORIAL — muestra 8 campañas de un lote
// ============================================================
function ModalHistorial({loteInfo, onClose, campSel, setCampSel, historico}){
  const HISTORICO_ROTACION = historico || HISTORICO_ROTACION_FALLBACK;
  const {campo,lote}=loteInfo;
  const key=`${campo.id}|${lote.id}`;
  const hist=HISTORICO_ROTACION[key];
  const camps=["19-20","20-21","21-22","22-23","23-24","24-25","25-26","26-27"];
  const camp=hist&&hist[campSel]?campSel:(hist?camps.filter(c=>hist[c]).slice(-1)[0]:"26-27");
  const dato=hist?hist[camp]:null;
  const cv=dato?.cv||"Sin datos";
  const rF=dato?.rF;
  const rG=dato?.rG;

  // Estadísticas del lote
  const rindesFina=hist?Object.entries(hist).filter(([_,d])=>d.rF).map(([c,d])=>({c,r:d.rF})):[];
  const rindesGruesa=hist?Object.entries(hist).filter(([_,d])=>d.rG).map(([c,d])=>({c,r:d.rG})):[];

  const overlay={position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16};
  const modal={background:CREMA,borderRadius:14,maxWidth:640,width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`2px solid ${TINTA}`};

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${TINTA}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div>
            <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.6}}>{campo.nombre}</div>
            <div style={{fontSize:22,fontWeight:700,marginTop:2}}>Lote {lote.label||lote.id}</div>
            <div style={{fontSize:13,opacity:0.7,marginTop:2}}>{lote.ha} ha</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:26,cursor:"pointer",lineHeight:1,color:TINTA,padding:4}}>×</button>
        </div>

        {/* Selector de campaña */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #D8D2C0"}}>
          <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>Campaña</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {camps.map(c=>{
              const tieneDato=hist&&hist[c];
              const activa=c===camp;
              return <button key={c} onClick={()=>tieneDato&&setCampSel(c)}
                disabled={!tieneDato}
                style={{padding:"6px 11px",fontSize:12.5,fontWeight:700,cursor:tieneDato?"pointer":"not-allowed",borderRadius:18,border:`1.5px solid ${activa?TINTA:"#C8C2B0"}`,background:activa?TINTA:tieneDato?"transparent":"#F0EDE3",color:activa?"#fff":tieneDato?TINTA:"#B5AF9D",fontFamily:"inherit",opacity:tieneDato?1:0.5}}>
                {c}
              </button>;
            })}
          </div>
        </div>

        {/* Detalle de campaña seleccionada */}
        <div style={{padding:"18px 20px"}}>
          {dato?(
            <div>
              <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55}}>Campaña {camp}</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginTop:8}}>
                <span style={{width:22,height:22,borderRadius:5,background:colorCv(cv),border:`1.5px solid ${TINTA}`,flexShrink:0}}/>
                <span style={{fontSize:20,fontWeight:700}}>{cv}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
                <div style={{background:"#fff",border:"1px solid #E5E0D0",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:10.5,letterSpacing:"0.1em",textTransform:"uppercase",opacity:0.55}}>Rinde fina</div>
                  <div style={{fontSize:24,fontWeight:700,marginTop:3}}>{rF!=null?`${rF} qq/ha`:"—"}</div>
                </div>
                <div style={{background:"#fff",border:"1px solid #E5E0D0",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:10.5,letterSpacing:"0.1em",textTransform:"uppercase",opacity:0.55}}>Rinde gruesa</div>
                  <div style={{fontSize:24,fontWeight:700,marginTop:3}}>{rG!=null?`${rG} qq/ha`:"—"}</div>
                </div>
              </div>
            </div>
          ):(
            <div style={{opacity:0.55,fontStyle:"italic",fontSize:14}}>Sin datos históricos para este lote.</div>
          )}
        </div>

        {/* Tabla completa de 8 campañas */}
        {hist&&(
          <div style={{padding:"0 20px 18px"}}>
            <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>Historial completo</div>
            <div style={{background:"#fff",border:"1px solid #E5E0D0",borderRadius:8,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                <thead><tr style={{background:"#E5E0D0"}}>
                  {["Campaña","Cultivo","R. fina","R. gruesa"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"7px 10px",fontSize:10.5,textTransform:"uppercase",letterSpacing:"0.06em",opacity:0.7,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {camps.map(c=>{
                    const d=hist[c];
                    if(!d) return null;
                    return <tr key={c} style={{borderTop:"1px solid #EEE9DC",background:c===camp?"#F8F5EC":"transparent"}}>
                      <td style={{padding:"7px 10px",fontWeight:c===camp?700:500,whiteSpace:"nowrap"}}>{c}</td>
                      <td style={{padding:"7px 10px"}}>
                        {d.cv?<span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                          <span style={{width:9,height:9,borderRadius:2,background:colorCv(d.cv),flexShrink:0}}/>{d.cv}
                        </span>:<span style={{opacity:0.4}}>—</span>}
                      </td>
                      <td style={{padding:"7px 10px",fontWeight:600}}>{d.rF!=null?`${d.rF} qq`:<span style={{opacity:0.4}}>—</span>}</td>
                      <td style={{padding:"7px 10px",fontWeight:600}}>{d.rG!=null?`${d.rG} qq`:<span style={{opacity:0.4}}>—</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            {(rindesFina.length>0||rindesGruesa.length>0)&&(
              <div style={{display:"flex",gap:14,marginTop:12,flexWrap:"wrap",fontSize:12}}>
                {rindesFina.length>0&&<div style={{opacity:0.75}}>
                  <b>Promedio fina:</b> {(rindesFina.reduce((s,x)=>s+x.r,0)/rindesFina.length).toFixed(1)} qq ({rindesFina.length} camp)
                </div>}
                {rindesGruesa.length>0&&<div style={{opacity:0.75}}>
                  <b>Promedio gruesa:</b> {(rindesGruesa.reduce((s,x)=>s+x.r,0)/rindesGruesa.length).toFixed(1)} qq ({rindesGruesa.length} camp)
                </div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
