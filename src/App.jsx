import React, { useState, useMemo, useRef, useEffect } from "react";

// Clave de la app: va en cada llamada a /api (las funciones la piden cuando APP_CLAVE está cargada
// en Vercel). Si el servidor la rechaza, la app muestra el recuadro para ingresarla.
const CLAVE_KEY = "smix_clave_app";
const claveApp = () => { try { return window.localStorage.getItem(CLAVE_KEY) || ""; } catch { return ""; } };
if(typeof window !== "undefined" && !window.__smixFetchConClave){
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    if(!String(url).startsWith("/api/")) return fetchOriginal(url, opts);
    return fetchOriginal(url, {...opts, headers:{...(opts.headers || {}), "x-clave": claveApp()}})
      .then(r => { if(r.status === 401) window.dispatchEvent(new Event("smix-clave")); return r; });
  };
  window.__smixFetchConClave = true;
}

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

// Cultivos conocidos (para partir combinaciones tipo "CEBADA-SOJA" o "VERDEO MAIZ")
const CULTIVOS_CONOCIDOS = ["MAIZ","SOJA","GIRASOL","SORGO","MANI","TRIGO","CEBADA","CENTENO",
  "AVENA","AGROPIRO","VERDEO","PASTURA","LLORON","TREBOL","FINA"];

// Parte un valor de cultivo en sus componentes reales.
// "CEBADA-SOJA" -> ["CEBADA","SOJA"] | "VERDEO MAIZ" -> ["VERDEO","MAIZ"]
// "MAIZ 2" -> ["MAIZ"] | "SORGO FORR" -> ["SORGO"] | "CAMPO NATURAL" -> ["CAMPO NATURAL"]
const cvPartes = (valor) => {
  if (!valor) return [];
  const bruto = String(valor).toUpperCase().trim();
  // separadores explícitos
  let trozos = bruto.split(/\s*[-+/]\s*/);
  // separador por espacio: solo si TODOS los trozos son cultivos conocidos
  if (trozos.length === 1 && bruto.includes(" ")) {
    const porEspacio = bruto.split(/\s+/);
    if (porEspacio.length > 1 && porEspacio.every(p => CULTIVOS_CONOCIDOS.includes(p))) {
      trozos = porEspacio;
    }
  }
  const out = [];
  trozos.forEach(t => {
    const b = baseCv(t);
    if (!b) return;
    // "SORGO FORR" -> SORGO ; "MAIZ FORRAJERO" -> MAIZ
    const primera = b.split(/\s+/)[0];
    const val = CULTIVOS_CONOCIDOS.includes(primera) ? primera : b;
    if (!out.includes(val)) out.push(val);
  });
  return out;
};
// Parte fina (invierno) de un valor: el primer componente si es fina
const cvFina = (valor) => {
  const p = cvPartes(valor);
  return p.length ? p[0] : "";
};
const colorCv = c => COLOR_CV[baseCv(c)] || COLOR_CV[c?.toUpperCase?.()] || "#DEDBD3";

// ── helpers ─────────────────────────────────────────────────
// Las fechas vienen como "2026-06-11". new Date() las toma como UTC y en
// Argentina (UTC-3) se muestran un día antes. Las parseamos como fecha local.
const fechaLocal = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const t = String(s).trim();
  // ISO: 2026-09-06
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Argentino, día primero: 6/9/2026 · 06/09/26 · 6-9-2026
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += 2000;
    return new Date(y, Number(m[2]) - 1, Number(m[1]));
  }
  return null;   // no adivinamos: new Date("6/9/2026") lo leería como 9 de junio
};
const fmtFecha = (s, opts = {day:"2-digit", month:"short", year:"numeric"}) => {
  const d = fechaLocal(s);
  return d ? d.toLocaleDateString("es-AR", opts) : "";
};

const fmt  = n => Math.round(n).toLocaleString("es-AR");
const fmt1 = n => (Math.round(n*10)/10).toLocaleString("es-AR",{minimumFractionDigits:1});
// Cantidades de producto: los decimales se adaptan a la magnitud, para que
// no se pierdan las dosis chicas (0,5 kg de metsulfurón no puede salir "1").
const fmtCant = n => {
  if (n == null || isNaN(n)) return "";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a < 1)   return n.toLocaleString("es-AR", {minimumFractionDigits:3, maximumFractionDigits:3});
  if (a < 10)  return n.toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2});
  if (a < 100) return n.toLocaleString("es-AR", {minimumFractionDigits:1, maximumFractionDigits:1});
  return Math.round(n).toLocaleString("es-AR");
};
const fechaCorta = f => {
  const d = fechaLocal(f);
  if (!d) return String(f ?? "");
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}`;
};
const diasHasta  = f => Math.round((fechaLocal(f)-fechaLocal("2026-06-30"))/86400000);
// Centroide geométrico real (fórmula de área signada) — cae dentro del polígono
// para polígonos convexos y cerca del centro visual para irregulares
const centro = poly => {
  if(poly.length < 3) {
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
  }
  let cx=0, cy=0, area=0;
  for(let i=0; i<poly.length; i++){
    const [x0,y0]=poly[i];
    const [x1,y1]=poly[(i+1)%poly.length];
    const cross = x0*y1 - x1*y0;
    cx += (x0+x1)*cross;
    cy += (y0+y1)*cross;
    area += cross;
  }
  area *= 0.5;
  if(Math.abs(area) < 1e-6){
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
  }
  return [cx/(6*area), cy/(6*area)];
};
const anchoP = poly => Math.max(...poly.map(p=>p[0]))-Math.min(...poly.map(p=>p[0]));

// ── Geometría para dividir lotes ─────────────────────────────
const areaPoly = poly => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1,y1] = poly[i], [x2,y2] = poly[(i+1)%poly.length];
    a += x1*y2 - x2*y1;
  }
  return Math.abs(a)/2;
};

// Corta un polígono con la recta que pasa por a y b. Devuelve [polyA, polyB] o null.
const cortarPoligono = (poly, a, b) => {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  const lado = p => (p[0]-a[0])*dy - (p[1]-a[1])*dx;
  const A = [], B = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i+1)%poly.length];
    const lp = lado(p), lq = lado(q);
    if (lp >= 0) A.push(p);
    if (lp <= 0) B.push(p);
    if ((lp > 0 && lq < 0) || (lp < 0 && lq > 0)) {
      const t = lp/(lp-lq);
      const ip = [p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1])];
      A.push(ip); B.push(ip);
    }
  }
  if (A.length < 3 || B.length < 3) return null;
  return [A, B];
};

// Anillo perimetral (cabecera) + centro. fracArea = proporción de la cabecera (0..1)
const anilloPerimetral = (poly, fracArea) => {
  const [cx, cy] = centro(poly);
  const k = Math.sqrt(Math.max(0.02, 1 - fracArea));
  const dentro = poly.map(([x,y]) => [cx+(x-cx)*k, cy+(y-cy)*k]);
  return [poly, dentro];   // se dibuja el exterior y encima el interior
};

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
  "LOS ABUELOS|5A":"CENTENO","LOS ABUELOS|5B":"TRIGO","LOS ABUELOS|8B":"CENTENO",
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
  "LOS ABUELOS|8B":"CENTENO",
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
  "LOS ABUELOS|5A":{"26-27":{cv:"CENTENO",rF:null,rG:null}},
  "LOS ABUELOS|5B":{"26-27":{cv:"TRIGO",rF:null,rG:null}},
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
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5b (sur)",ha:40,cultivo:"TRIGO",costo:1181,productos:["CONTROLMAX","POWERSPRAY 2,4D 68%","Dicamba Duranor","Metsulfuron Metil","RizoSpray EXTREMO"]},
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
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5B (sur)",ha:40,cultivo:"TRIGO",costo:1181,productos:["CONTROLMAX","POWERSPRAY 2-4D 68%","DICAMBA","METSULFURON","RIZOSPRAY EXTREMO"]},
  {fecha:"2026-07-02",campo:"EL TORELLO",lote:"5",ha:52,cultivo:"CEBADA",costo:1243.7,productos:["GLIFOSATO LT BOX","2-4 D 97 SIGMA","LIGIER PH BIO","DICAMBA SIGMA","METSULFURON"]},
].map((a,i)=>({...a,id:i,costoHa:a.ha?a.costo/a.ha:0})).sort((a,b)=>fechaLocal(b.fecha)-fechaLocal(a.fecha));
// fertilizaciones realizadas (registro campaña 26-27 y 25-26 relevantes)
const FERTILIZACIONES_FALLBACK = [
  {fecha:"2026-06-25",campo:"L3H",lote:"13G",ha:142,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"90 kg/ha",costoHa:52.2,notas:"Fertilización a la siembra"},
  {fecha:"2026-06-25",campo:"L3H",lote:"10O",ha:30,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"90 kg/ha",costoHa:52.2,notas:"Fertilización a la siembra"},
  {fecha:"2026-06-25",campo:"L3H",lote:"13CH",ha:16,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"90 kg/ha",costoHa:52.2,notas:""},
  {fecha:"2026-05-18",campo:"EL ABUELO",lote:"2-4-5",ha:120,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"80 kg/ha",costoHa:46.4,notas:""},
  {fecha:"2026-04-26",campo:"LA CHOLITA",lote:"4",ha:50,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"85 kg/ha",costoHa:49.3,notas:""},
  {fecha:"2026-04-26",campo:"LA CHOLITA",lote:"5",ha:20,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"85 kg/ha",costoHa:49.3,notas:""},
  {fecha:"2026-06-14",campo:"DOÑA TERESA",lote:"6",ha:6,cultivo:"CEBADA",tipo:"Arranque",producto:"MAP",dosis:"85 kg/ha",costoHa:49.3,notas:""},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5A",ha:20,cultivo:"CENTENO",tipo:"Arranque",producto:"Nutrimap",dosis:"130 kg/ha",costoHa:98.8,notas:"Verdeo centeno"},
  {fecha:"2026-06-29",campo:"LOS ABUELOS",lote:"5B",ha:40,cultivo:"TRIGO",tipo:"Arranque",producto:"Nutrimap",dosis:"130 kg/ha",costoHa:98.8,notas:"Trigo B620"},
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
].map((f,i)=>({...f,id:i})).sort((a,b)=>fechaLocal(b.fecha)-fechaLocal(a.fecha));




const PRODUCTOR = {
  "L3H":"Sucesión/Haydee","LA CUCA":"Andrés","LOS ABUELOS":"Haydee","DOÑA TERESA":"Enrique",
  "DON ANTONIO":"Mariano","LA FLECHA":"Matías","LA CHOLITA":"Faroux M. Graciela","LA DORA":"Matean SAS",
  "LAS TIAS":"Lorenzo","LOS NIETOS":"Enrique/Andrés","EL TORELLO":"Mariano/Andrés",
  "EL CIPRES":"Mariano/Matías/Andrés","DON MARCELINO":"Enrique","EL ABUELO":"Enrique",
  "EL DESCANSO":"Mariano/Andrés","DON RAMON":"—","LA MARIA OLIVA":"—","EL 5":"—",
  "LA ADORACION":"—","LA CARLOTA":"—","LA ILUSION":"—",
};
const COLOR_PROV = { PELAYO:"#2E7D32", QUEMU:"#C0392B", PROPIO:"#1E5FA8" };
// Tipos de tratamiento y cultivos, para los desplegables de la orden
const TIPOS_TRATAMIENTO = ["Barbecho corto","Barbecho largo","Presiembra","Preemergente",
  "Postemergente","Insecticida","Fungicida"];
const CULTIVOS_ORDEN = ["MAIZ","SOJA","GIRASOL","SORGO","MANI","TRIGO","CEBADA","AVENA",
  "CENTENO","VERDEO","PASTURA","AGROPIRO","COBERTURA"];

const COLORES_APP = ["#E2574C","#3B82C4","#43A047","#F2B707","#7E57C2","#00897B"];

// ── RESTRICCIONES DE HERBICIDAS POR CULTIVO Y MOMENTO ───────────
// Códigos por momento [BL, BC, PS, PRE, POST]:
//   "1" = va · "0" = NO va (bloquea la orden) · "A" = depende de intervalo/condición (avisa)
// Las prohibiciones "0" son categóricas y bloquean. Los rangos de dosis son REFERENCIA
// (formulado/ha), no marbete: nunca bloquean, se marcan en rojo y la orden sigue.
// dosis: null = sin rango cargado (queda vacío hasta validar contra marbete).
const MOMENTOS_R = ["BL","BC","PS","PRE","POST"];
const MOMENTO_LABEL = {BL:"barbecho largo",BC:"barbecho corto",PS:"presiembra",PRE:"preemergencia",POST:"postemergencia"};
const MOMENTO_DE_TIPO = {"Barbecho largo":"BL","Barbecho corto":"BC","Presiembra":"PS","Preemergente":"PRE","Postemergente":"POST"};
const CULTIVOS_R = ["MAIZ","SOJA","GIRASOL","TRIGO","CEBADA","SORGO","CENTENO","AVENA"];
const GRAMINEAS_R = ["MAIZ","TRIGO","CEBADA","SORGO","CENTENO","AVENA"];
const fill = (cvs, cod) => Object.fromEntries(cvs.map(c => [c, cod]));

const RESTRICCIONES = [
  { pa:"Glifosato", re:/GLIFOSATO|CONTROLMAX|ROUNDUP|TOUCHDOWN/,
    m:{ ...fill(CULTIVOS_R,"11110"), MAIZ:"1111A", SOJA:"1111A" },
    notas:{ MAIZ:"Post solo en maíz RR.", SOJA:"Post solo en soja RR." },
    escala:[{re:/./, u:"L", f:1.5}],
    dosis:[{re:/./, u:"kg", min:0.8, max:3.0}, {re:/./, u:"L", min:1.2, max:4.0}] },
  { pa:"2,4-D colina (Enlist)", re:/ENLIST/,
    m:{ MAIZ:"111AA", SOJA:"1AA11", GIRASOL:"1AA00", SORGO:"11AAA",
        TRIGO:"11AA1", CEBADA:"11AA1", CENTENO:"11AA1", AVENA:"11AA1" },
    notas:{ SOJA:"Pre y post solo en soja Enlist E3." },
    dosis:[{re:/./, u:null, min:0.3, max:1.5}] },
  { pa:"2,4-D", re:/2[-, ]?4[ -]?D(?!B)|POWERSPRAY|POWERSRAY|HERBIFEN|VOLERIS/,
    m:{ MAIZ:"111AA", SOJA:"1AA00", GIRASOL:"1AA00", SORGO:"11AAA",
        TRIGO:"11AA1", CEBADA:"11AA1", CENTENO:"11AA1", AVENA:"11AA1" },
    notas:{ MAIZ:"Post temprano y dirigido, según marbete.",
      SOJA:"Presiembra: intervalo según formulación y dosis. En pre y post solo va 2,4-D colina en soja Enlist E3.",
      GIRASOL:"Girasol muy sensible: respetar intervalo largo a siembra.",
      TRIGO:"Post entre macollaje y antes de encañazón.", CEBADA:"Post entre macollaje y antes de encañazón.",
      SORGO:"Post en 4–6 hojas, según marbete." },
    dosis:[{re:/./, u:null, min:0.3, max:1.5}] },
  { pa:"Dicamba", re:/DICAMBA|BANVEL|DURANOR/,
    m:{ MAIZ:"111AA", SOJA:"1AA0A", GIRASOL:"1AA00", SORGO:"11AAA",
        TRIGO:"11AA1", CEBADA:"11AA1", CENTENO:"11AAA", AVENA:"11AAA" },
    escala:[{re:/70[.,]8|DURANOR/, f:1}, {re:/./, f:1.45}],
    notas:{ SOJA:"Presiembra con intervalo de marbete. Post solo soja tolerante a dicamba.",
      GIRASOL:"Girasol muy sensible: respetar intervalo largo a siembra.", MAIZ:"Post temprano, según marbete." },
    dosis:[{re:/70[.,]8|DURANOR/, u:null, min:0.06, max:0.18}, {re:/./, u:null, min:0.08, max:0.25}] },
  { pa:"Atrazina", re:/ATRAZINA|GESAPRIM/,
    m:{ ...fill(CULTIVOS_R,"00000"), MAIZ:"11111", SORGO:"11111" },
    notas:{ SOJA:"Sin lugar en soja: carryover en suelos arenosos.", GIRASOL:"Sin lugar en girasol: carryover." },
    carry:"Carryover a soja, girasol y fina siguientes.",
    dosis:[{re:/./, u:null, min:0.5, max:2.5}] },
  { pa:"Metsulfurón", re:/METSULFURON|\bALLY\b/,
    m:{ TRIGO:"111A1", CEBADA:"111A1", CENTENO:"111AA", AVENA:"111AA",
        MAIZ:"AA000", SOJA:"AA000", GIRASOL:"A0000", SORGO:"A0000" },
    notas:{ GIRASOL:"Solo barbecho largo con intervalo de marbete.", SOJA:"Intervalo a siembra según pH y lluvias." },
    carry:"Carryover a girasol, sorgo, maíz y soja (pH alto y pocas lluvias lo alargan).",
    dosis:[{re:/./, u:null, min:0.003, max:0.012}] },
  { pa:"S-metolaclor", re:/METOLACLOR|DUAL/,
    m:{ MAIZ:"A111A", SOJA:"A111A", GIRASOL:"A111A", SORGO:"A1AAA",
        ...fill(["TRIGO","CEBADA","CENTENO","AVENA"],"1A000") },
    notas:{ SORGO:"Solo con semilla tratada con protector." },
    dosis:[{re:/./, u:null, min:0.6, max:1.6}] },
  { pa:"Cletodim", re:/CLETODIM|\bSELECT\b/,
    m:{ ...fill(GRAMINEAS_R,"1A000"), SOJA:"11111", GIRASOL:"11111" },
    notas:{ MAIZ:"Graminicida: respetar intervalo a siembra de gramíneas." },
    dosis:[{re:/./, u:null, min:0.4, max:1.2}] },
  { pa:"Haloxifop", re:/HALOXIFOP|GALANT/,
    m:{ ...fill(GRAMINEAS_R,"1A000"), SOJA:"11111", GIRASOL:"11111" },
    notas:{ MAIZ:"Graminicida: respetar intervalo a siembra de gramíneas." },
    dosis:null },
  { pa:"Sulfentrazone", re:/SULFENTRAZON|CAPAZ|SHUTDOWN|AUTHORITY|ENELAN|MILENIAL/,
    m:{ SOJA:"A1110", GIRASOL:"A1110", MAIZ:"AAA00", SORGO:"AA000",
        ...fill(["TRIGO","CEBADA","CENTENO","AVENA"],"AA000") },
    notas:{ GIRASOL:"Dosis según textura: en arenosos usar la baja.", SOJA:"Dosis según textura: en arenosos usar la baja." },
    carry:"Carryover a maíz, sorgo y fina.",
    dosis:[{re:/./, u:null, min:0.15, max:0.6}] },
  { pa:"Adengo", re:/ADENGO|ISOXAFLUTOL/,
    m:{ MAIZ:"A111A", ...fill(["SOJA","TRIGO","CEBADA","CENTENO","AVENA"],"AA000"), GIRASOL:"A0000", SORGO:"A0000" },
    notas:{ MAIZ:"Post solo temprano, según marbete." },
    carry:"Carryover a soja, girasol y fina.",
    dosis:[{re:/./, u:null, min:0.15, max:0.45}] },
  { pa:"Flurocloridona", re:/FLUROCLORIDONA|FLUOROCLORIDONA|RAINBOW|RACER|TALIS/,
    m:{ GIRASOL:"11110", SOJA:"1AAA0", ...fill(["MAIZ","SORGO","TRIGO","CEBADA","CENTENO","AVENA"],"1AA00") },
    dosis:[{re:/./, u:null, min:0.4, max:2.5}] },
  { pa:"Diflufenican", re:/DIFLUFEN|PELICAN|TUKEN/,
    m:{ TRIGO:"1111A", CEBADA:"1111A", CENTENO:"11AAA", AVENA:"11AAA",
        GIRASOL:"111A0", SOJA:"11AA0", MAIZ:"1AA00", SORGO:"1AA00" },
    dosis:[{re:/./, u:null, min:0.1, max:0.35}] },
  { pa:"Fluroxipir", re:/FLUROXIPIR|STARANE/,
    m:{ TRIGO:"11AA1", CEBADA:"11AA1", CENTENO:"11AAA", AVENA:"11AAA",
        MAIZ:"11AAA", SORGO:"11AAA", SOJA:"1AA00", GIRASOL:"1AA00" },
    dosis:[{re:/48/, u:null, min:0.15, max:0.5}] },
  { pa:"Terbutilazina", re:/TERBUTILAZINA|TERBYNE|KORITSU/,
    m:{ ...fill(CULTIVOS_R,"A0000"), MAIZ:"11111", SORGO:"AAAAA" },
    notas:{ SORGO:"Verificar registro en sorgo." },
    carry:"Carryover a soja, girasol y fina siguientes.",
    dosis:[{re:/TERBUTILAZINA|KORITSU/, u:null, min:0.8, max:2.5}] },
  { pa:"Flumioxazin", re:/FLUMIOXAZIN|SUMISOYA|NYAMBI|FIERCE|ESPUELA|GEMMIT|FLOWZIN|OXALIS/,
    m:{ SOJA:"A1110", GIRASOL:"AAAA0", MAIZ:"AA000", SORGO:"AA000",
        TRIGO:"AAAA0", CEBADA:"AAAA0", CENTENO:"AAA00", AVENA:"AAA00" },
    notas:{ SOJA:"Pre: solo antes de emergencia." },
    dosis:[{re:/48/, u:null, min:0.06, max:0.2}] },
];


// Rangos de referencia por cultivo y momento (formulado/ha) — cargados girasol, soja y maíz.
// Orden: [BL, BC, PS, PRE, POST]. null = sin rango cargado para ese momento.
const DOSIS_CM = {
  "Glifosato": { ref:"kg formulado 72% granulado (×1,5 si es líquido)", cv:{
    MAIZ:[[1,2.5],[1,2.5],[1,2],[1,2],[0.8,1.5]],
    SOJA:[[1,2.5],[1,2.5],[1,2],[1,2],[0.8,1.5]],
    GIRASOL:[[1,2.5],[1,2.5],[1,2],[1,2],null],
  }},
  "2,4-D": { ref:"L de 2,4-D 97%", cv:{
    MAIZ:[[0.5,1.2],[0.5,1.0],[0.4,0.8],[0.3,0.5],[0.3,0.5]],
    SOJA:[[0.5,1.2],[0.5,1.0],[0.4,0.8],null,null],
    GIRASOL:[[0.5,1.2],[0.5,1.0],null,null,null],
  }},
  "2,4-D colina (Enlist)": { ref:"L de 2,4-D colina", cv:{
    SOJA:[[0.5,1.2],[0.5,1.0],[0.4,0.8],[1.0,1.5],[1.0,1.5]],
  }},
  "Dicamba": { ref:"L de dicamba 70,8% (×1,45 si es 48%)", cv:{
    MAIZ:[[0.1,0.3],[0.1,0.25],[0.08,0.2],[0.07,0.15],[0.07,0.15]],
    SOJA:[[0.1,0.3],[0.1,0.2],[0.07,0.1],null,null],
    GIRASOL:[[0.1,0.3],null,null,null,null],
  }},
  "Atrazina": { ref:"kg de atrazina 90%", cv:{
    MAIZ:[[0.8,2.0],[0.8,2.0],[0.8,2.0],[1.0,2.2],[0.8,1.5]],
  }},
  "S-metolaclor": { ref:"L de s-metolaclor 96%", cv:{
    MAIZ:[null,[0.8,1.4],[1.0,1.6],[1.0,1.6],null],
    SOJA:[null,[0.8,1.2],[0.8,1.4],[0.8,1.4],[0.8,1.0]],
    GIRASOL:[null,[0.8,1.2],[0.8,1.4],[0.8,1.4],null],
  }},
  "Cletodim": { ref:"L de cletodim 24%", cv:{
    MAIZ:[[0.4,0.8],null,null,null,null],
    SOJA:[[0.4,0.8],[0.4,0.8],[0.4,0.8],null,[0.5,1.0]],
    GIRASOL:[[0.4,0.8],[0.4,0.8],[0.4,0.8],null,[0.5,1.0]],
  }},
  "Haloxifop": { ref:"L de haloxifop 54%", cv:{
    MAIZ:[[0.1,0.15],null,null,null,null],
    SOJA:[[0.1,0.15],[0.1,0.15],[0.1,0.15],null,[0.1,0.15]],
    GIRASOL:[[0.1,0.15],[0.1,0.15],[0.1,0.15],null,[0.1,0.15]],
  }},
  "Sulfentrazone": { ref:"L de sulfentrazone 50%", cv:{
    MAIZ:[null,[0.04,0.2],null,null,null],
    SOJA:[null,[0.25,0.5],[0.25,0.5],[0.25,0.45],null],
    GIRASOL:[null,[0.2,0.4],[0.2,0.4],[0.2,0.35],null],
  }},
  "Adengo": { ref:"L de Adengo", cv:{
    MAIZ:[null,[0.25,0.4],[0.25,0.4],[0.25,0.4],[0.2,0.3]],
  }},
  "Flurocloridona": { ref:"L de flurocloridona 25%", cv:{
    MAIZ:[[0.4,0.8],null,null,null,null],
    SOJA:[[0.4,0.8],null,null,null,null],
    GIRASOL:[[0.4,0.8],[0.5,1.5],[1.0,2.0],[1.0,2.5],null],
  }},
  "Diflufenican": { ref:"L de diflufenican 50%", cv:{
    MAIZ:[[0.15,0.25],null,null,null,null],
    SOJA:[[0.15,0.25],[0.15,0.25],null,null,null],
    GIRASOL:[[0.15,0.25],[0.15,0.25],[0.15,0.25],[0.15,0.2],null],
  }},
  "Fluroxipir": { ref:"L de fluroxipir 48%", cv:{
    MAIZ:[[0.2,0.4],[0.2,0.35],null,null,[0.15,0.3]],
    SOJA:[[0.2,0.4],[0.2,0.35],null,null,null],
    GIRASOL:[[0.2,0.4],[0.2,0.35],null,null,null],
  }},
  "Terbutilazina": { ref:"L de terbutilazina 50%", cv:{
    MAIZ:[[1.0,2.0],[1.0,2.0],[1.0,2.0],[1.5,2.5],[1.0,1.5]],
  }},
  "Flumioxazin": { ref:"L de flumioxazin 48%", cv:{
    MAIZ:[null,[0.08,0.1],null,null,null],
    SOJA:[null,[0.08,0.12],[0.08,0.12],[0.08,0.12],null],
  }},
};

const normR = (s) => (s||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

// Evalúa un producto de un tratamiento. Devuelve lista de {nivel:"bloquea"|"aviso"|"info", texto}
const evaluarProducto = (nombre, dosis, unidad, cultivo, tipoTrat) => {
  const n = normR(nombre), cv = normR(cultivo);
  const regla = RESTRICCIONES.find(r => r.re.test(n));
  if (!regla) return [];
  const out = [];
  const cod = regla.m[cv];
  const mom = MOMENTO_DE_TIPO[tipoTrat];
  if (cod) {
    const nota = regla.notas?.[cv];
    if (mom) {
      const c = cod[MOMENTOS_R.indexOf(mom)];
      if (c === "0") out.push({nivel:"bloquea", texto:`${regla.pa} no va en ${cv} en ${MOMENTO_LABEL[mom]}.${nota?" "+nota:""}`});
      else if (c === "A") out.push({nivel:"aviso", texto:`${regla.pa} en ${cv} (${MOMENTO_LABEL[mom]}): ${nota || "depende de intervalo o condición, verificar marbete."}`});
    } else if (cod === "00000") {
      out.push({nivel:"bloquea", texto:`${regla.pa} no va en ${cv} en ningún momento.${nota?" "+nota:""}`});
    }
  }
  const d = Number(dosis) || 0;
  if (d > 0) {
    const u = (unidad||"").toLowerCase();
    let rg = null, refTxt = "";
    // 1º: rango cargado para ese cultivo y ese momento
    const tabla = DOSIS_CM[regla.pa];
    if (tabla && mom && tabla.cv[cv]) {
      const par = tabla.cv[cv][MOMENTOS_R.indexOf(mom)];
      if (par) {
        const es = (regla.escala||[]).find(x => x.re.test(n) && (!x.u || x.u.toLowerCase() === u));
        const f = es ? es.f : 1;
        rg = {min: +(par[0]*f).toFixed(3), max: +(par[1]*f).toFixed(3)};
        refTxt = ` en ${MOMENTO_LABEL[mom]} de ${cv}`;
      }
    }
    // 2º: rango general del producto
    if (!rg && regla.dosis) rg = regla.dosis.find(x => x.re.test(n) && (!x.u || x.u.toLowerCase() === u)) || null;
    if (rg) {
      const refTxt2 = refTxt;
      // La dosis nunca bloquea: marca en rojo y sigue.
      if (d > rg.max * 3) out.push({nivel:"alerta", texto:`${regla.pa}: ${d} por ha es más del triple del máximo de referencia${refTxt2} (${rg.min}–${rg.max}). ¿Error de unidad?`});
      else if (d > rg.max) out.push({nivel:"alerta", texto:`${regla.pa}: ${d} por ha supera el rango de referencia${refTxt2} (${rg.min}–${rg.max}). Validar contra marbete.`});
    }
  }
  if (regla.carry && cv && d > 0 && !out.some(x=>x.nivel==="bloquea")) out.push({nivel:"info", texto:`${regla.pa}: ${regla.carry}`});
  return out;
};

// Evalúa un tratamiento completo {etiqueta, cultivo, productos}
const evaluarTratamiento = (t) => {
  if (!t || !t.cultivo) return [];
  return (t.productos||[])
    .filter(p => p.n && p.d > 0)
    .flatMap(p => evaluarProducto(p.n, p.d, p.u, t.cultivo, t.etiqueta).map(x => ({...x, producto:p.n})));
};

// ── BASE DE PRODUCTOS Y PROVEEDORES ────────────────────────
// Precios USD/L o USD/kg. Categorías: HER (herbicida), INS (insecticida),
// FUN (fungicida), COAD (coadyuvante), FERT (fertilizante), SEM (semilla), SGR (curasemilla)
const PRODUCTOS_BASE = [
  // prov: PELAYO (verde) | QUEMU (rojo) | "" (labores, fertilizantes, semillas)
  // ── BH PELAYO ──
  {n:"2-4 D 89% VOLERIS ADVANCE x 20 LT", cat:"HER", u:"L", p:5.15, prov:"PELAYO"},
  {n:"2-4 D 97 SIGMA x 20 LT", cat:"HER", u:"L", p:5.35, prov:"PELAYO"},
  {n:"2-4 D 97% HERBIFEN ADVANCE x 20 LT", cat:"HER", u:"L", p:5.35, prov:"PELAYO"},
  {n:"2-4 D ENLIST x 20 LT", cat:"HER", u:"L", p:5.55, prov:"PELAYO"},
  {n:"2-4 D LV 89% SIGMA x 20 LT", cat:"HER", u:"L", p:5.0, prov:"PELAYO"},
  {n:"A35T - GOLD x 10 LT", cat:"COAD", u:"L", p:28.0, prov:"PELAYO"},
  {n:"A35T- BIO x 1 LT", cat:"COAD", u:"L", p:31.5, prov:"PELAYO"},
  {n:"ABSOLUT x 5 LT (aceite vegetal metilado)", cat:"COAD", u:"L", p:12.6, prov:"PELAYO"},
  {n:"ACEITE METILADO NANOMIC SIGMA x 5 LT", cat:"COAD", u:"L", p:22.0, prov:"PELAYO"},
  {n:"ACEITE METILADO ROCIO x 3 LT", cat:"COAD", u:"L", p:21.0, prov:"PELAYO"},
  {n:"ACEITE METILADO SOLY-OIL x 20 LT", cat:"COAD", u:"L", p:2.9, prov:"PELAYO"},
  {n:"ACEITE VEGETAL SOLY-OIL x 20 LT", cat:"COAD", u:"L", p:2.7, prov:"PELAYO"},
  {n:"ACURON UNO x 5 LT (biciclopirona)", cat:"HER", u:"L", p:42.75, prov:"PELAYO"},
  {n:"ADENGO X 5 LT", cat:"HER", u:"L", p:90.0, prov:"PELAYO"},
  {n:"AGNEO X 5 LT (TIAMETOXAM + LAMBDA)", cat:"INS", u:"L", p:13.8, prov:"PELAYO"},
  {n:"ALL - OK COAD. x 10 LT", cat:"COAD", u:"L", p:18.0, prov:"PELAYO"},
  {n:"AMPLIGO x LT", cat:"INS", u:"L", p:78.5, prov:"PELAYO"},
  {n:"ARANYA (Abamectina 3.6 %) x 5 LT", cat:"INS", u:"L", p:10.0, prov:"PELAYO"},
  {n:"ARANYA PLUS (Abamectina 8,4 %) x 1 L", cat:"INS", u:"L", p:22.35, prov:"PELAYO"},
  {n:"ARIETE FULL x 5 LT(tiametoxam+lambda)", cat:"INS", u:"L", p:15.0, prov:"PELAYO"},
  {n:"ATRAZINA GESAPRIM 90 x 10 KG", cat:"HER", u:"kg", p:7.0, prov:"PELAYO"},
  {n:"ATRAZINA GOTEN 90% x 10 KGS", cat:"HER", u:"kg", p:6.0, prov:"PELAYO"},
  {n:"ATRAZINA TRAC 90 x 10 KG", cat:"HER", u:"kg", p:6.1, prov:"PELAYO"},
  {n:"AXIAL PLUS x 5 LT", cat:"HER", u:"L", p:41.1, prov:"PELAYO"},
  {n:"AZOXICONAZOLE (AzoxI + Cipro) x 5 LT", cat:"FUN", u:"L", p:12.1, prov:"PELAYO"},
  {n:"BIFENTRIN 25 AGNEO x 5 LT", cat:"INS", u:"L", p:10.2, prov:"PELAYO"},
  {n:"BIFENTRIN 25 SIGMA x 5 LT", cat:"INS", u:"L", p:15.4, prov:"PELAYO"},
  {n:"BIFENTRIN 25% SIGMA x LT", cat:"INS", u:"L", p:15.4, prov:"PELAYO"},
  {n:"BIFENTRIN 25% SOKFORTE X 5LT", cat:"INS", u:"L", p:15.4, prov:"PELAYO"},
  {n:"BORJA x 5 LT (biciclopirona)", cat:"HER", u:"L", p:42.75, prov:"PELAYO"},
  {n:"BRUCIA x LT", cat:"HER", u:"L", p:231.0, prov:"PELAYO"},
  {n:"CLETODIM SIGMA x 20 LT", cat:"HER", u:"L", p:8.25, prov:"PELAYO"},
  {n:"COADYUVANTE ROCIO UN.", cat:"COAD", u:"L", p:40.6, prov:"PELAYO"},
  {n:"CONVEY x LT", cat:"HER", u:"L", p:305.0, prov:"PELAYO"},
  {n:"CRIPTON SC325 X 5 LT", cat:"FUN", u:"L", p:28.5, prov:"PELAYO"},
  {n:"DASEN x 10 LTS.", cat:"HER", u:"L", p:32.5, prov:"PELAYO"},
  {n:"DICAMBA DURANOR ADV x 10 LT", cat:"HER", u:"L", p:7.5, prov:"PELAYO"},
  {n:"DICAMBA SIGMA x 10 LT", cat:"HER", u:"L", p:7.5, prov:"PELAYO"},
  {n:"DICLOSULAM RIDOF x 200 GR", cat:"HER", u:"kg", p:175.0, prov:"PELAYO"},
  {n:"DINNO (dinotefuran 70%) x 1,7 Kg", cat:"INS", u:"kg", p:118.5, prov:"PELAYO"},
  {n:"DUAL GOLD x 5 Lts.", cat:"HER", u:"L", p:6.95, prov:"PELAYO"},
  {n:"EDDUS x 20 LT", cat:"HER", u:"L", p:9.0, prov:"PELAYO"},
  {n:"ENGEO (Tiametoxam + Lambda) x 5 LT", cat:"INS", u:"L", p:23.27, prov:"PELAYO"},
  {n:"ESE LACLORO 96% (S-Metolacloro) x 20 Lts", cat:"HER", u:"L", p:6.5, prov:"PELAYO"},
  {n:"FEROX ABAMECTINA 1,8 EC x 5 Lts - Atanor", cat:"INS", u:"L", p:4.5, prov:"PELAYO"},
  {n:"FIERCE RM x 5 LT", cat:"HER", u:"L", p:59.0, prov:"PELAYO"},
  {n:"FINESSE WG x 150 GRS", cat:"HER", u:"kg", p:294.0, prov:"PELAYO"},
  {n:"FLUMETSULAN ELEVATE X 5 LT", cat:"HER", u:"L", p:27.6, prov:"PELAYO"},
  {n:"FLUMETSULAN PREVISOR X 5 LT", cat:"HER", u:"L", p:20.2, prov:"PELAYO"},
  {n:"FLUMIOXAZIN AGROXAZIN 48% SC INSUAGRO x 5 Lts", cat:"HER", u:"L", p:15.5, prov:"PELAYO"},
  {n:"FLUMIOXAZIN ESPUELA x 5 LT 48%", cat:"HER", u:"L", p:15.5, prov:"PELAYO"},
  {n:"FLUMIOXAZIN FLOWZIN x 5 LT48%", cat:"HER", u:"L", p:18.22, prov:"PELAYO"},
  {n:"FLUMIOXAZIN GEMMIT TOP x 1LT", cat:"HER", u:"L", p:23.5, prov:"PELAYO"},
  {n:"FLUMIOXAZIN NYAMBI FLO x 5 LT", cat:"HER", u:"L", p:18.0, prov:"PELAYO"},
  {n:"FLUMIOXAZIN OXALIS x 5 LT", cat:"HER", u:"L", p:15.5, prov:"PELAYO"},
  {n:"FLUROCLORIDONA RAINBOW x 10 LT", cat:"HER", u:"L", p:12.0, prov:"PELAYO"},
  {n:"FLUROCLORIDONA TALIS x 20 LT", cat:"HER", u:"L", p:12.0, prov:"PELAYO"},
  {n:"FLUROXIPIR 48 SIGMA x 5 Lts", cat:"HER", u:"L", p:14.85, prov:"PELAYO"},
  {n:"FOMESAFEN ADOC x 10 LT", cat:"HER", u:"L", p:6.3, prov:"PELAYO"},
  {n:"FOMESAFEN SIGMA x 20 LT", cat:"HER", u:"L", p:7.1, prov:"PELAYO"},
  {n:"GLIFOSATO GOLD SIGMA x 20 LT", cat:"HER", u:"L", p:4.6, prov:"PELAYO"},
  {n:"GLIFOSATO GRANULADO 88.8 AGNEO x 10 KGS", cat:"HER", u:"kg", p:5.58, prov:"PELAYO"},
  {n:"GLIFOSATO GRANULADO LT BOX x 15 KG", cat:"HER", u:"kg", p:7.4, prov:"PELAYO"},
  {n:"GLIFOSATO GRANULADO MAX SIGMA x 15 Kg", cat:"HER", u:"kg", p:7.2, prov:"PELAYO"},
  {n:"GLIFOSATO PANZER GOLD x 20 LT", cat:"HER", u:"L", p:5.1, prov:"PELAYO"},
  {n:"GLIFOSATO TOUCHDOWN MAX x 10 KGS", cat:"HER", u:"kg", p:7.25, prov:"PELAYO"},
  {n:"Glufosinato Amonio 20% Sigma x 20 Lts", cat:"HER", u:"L", p:4.4, prov:"PELAYO"},
  {n:"HALOXIFOP 54 AGNEO x 5 LT", cat:"HER", u:"L", p:16.38, prov:"PELAYO"},
  {n:"HALOXIFOP 54 SIGMA x 10 LT", cat:"HER", u:"L", p:18.0, prov:"PELAYO"},
  {n:"HEAT x 350 GRS", cat:"HER", u:"kg", p:320.0, prov:"PELAYO"},
  {n:"HUCK x 5 LT", cat:"HER", u:"L", p:18.2, prov:"PELAYO"},
  {n:"IMAZETAPIR 10,6 SIGMA x 20 LT", cat:"HER", u:"L", p:4.0, prov:"PELAYO"},
  {n:"IMAZETAPIR INITIOS x 20 LT", cat:"HER", u:"L", p:4.0, prov:"PELAYO"},
  {n:"KEIGO x 10 LTS", cat:"COAD", u:"L", p:12.0, prov:"PELAYO"},
  {n:"KORITSU (TERBUTILAZINA 50%)", cat:"HER", u:"L", p:6.35, prov:"PELAYO"},
  {n:"LAMBDA 25 KARATE ZEON x 1 LT", cat:"INS", u:"L", p:42.0, prov:"PELAYO"},
  {n:"LAMBDA 25% CIALONTRIN x 5 LT", cat:"INS", u:"L", p:15.9, prov:"PELAYO"},
  {n:"LAMBDA 25% SIGMA x LT", cat:"INS", u:"L", p:17.0, prov:"PELAYO"},
  {n:"LAUDIS x 5 LTS", cat:"HER", u:"L", p:109.0, prov:"PELAYO"},
  {n:"LIGATE x KG", cat:"HER", u:"kg", p:165.0, prov:"PELAYO"},
  {n:"LIGIER GRASS BIO x 5 LT", cat:"COAD", u:"L", p:24.6, prov:"PELAYO"},
  {n:"LIGIER PH BIO x LT", cat:"COAD", u:"L", p:37.25, prov:"PELAYO"},
  {n:"LIGIER VERDE BIO x LT", cat:"COAD", u:"L", p:37.25, prov:"PELAYO"},
  {n:"LONTREL x 5 LT", cat:"HER", u:"L", p:35.0, prov:"PELAYO"},
  {n:"METSULFURON SIGMA x kg", cat:"HER", u:"kg", p:245.0, prov:"PELAYO"},
  {n:"MIRAVIS DUO x 5 LT", cat:"FUN", u:"L", p:37.1, prov:"PELAYO"},
  {n:"MIRAVIS TRIPLE PACK (1 UNI. x PACK)", cat:"FUN", u:"L", p:301.0, prov:"PELAYO"},
  {n:"MUSTANG EW x 5 LT (zetametrina 20%)", cat:"INS", u:"L", p:18.0, prov:"PELAYO"},
  {n:"PARAQUAT SIGMA x 20 LT", cat:"HER", u:"L", p:3.35, prov:"PELAYO"},
  {n:"PELICAN X 5 LTS (diflufenincan)", cat:"HER", u:"L", p:27.9, prov:"PELAYO"},
  {n:"PERCUTOR (1.800 GR)", cat:"HER", u:"kg", p:238.0, prov:"PELAYO"},
  {n:"PICLORAM SIGMA x 5 LT", cat:"HER", u:"L", p:7.2, prov:"PELAYO"},
  {n:"PIXXARO x 5 LTS", cat:"HER", u:"L", p:51.05, prov:"PELAYO"},
  {n:"SHARK (carfentrazone) x LT", cat:"HER", u:"L", p:100.8, prov:"PELAYO"},
  {n:"SHENZI x LT (clorantraniliprole 40%)", cat:"INS", u:"L", p:115.0, prov:"PELAYO"},
  {n:"SISTEMICO ROGOR PLUS x 5 LT", cat:"INS", u:"L", p:12.3, prov:"PELAYO"},
  {n:"S-METOLACLORO STRIM x 20 LT", cat:"HER", u:"L", p:6.5, prov:"PELAYO"},
  {n:"STAGGER x LT", cat:"HER", u:"L", p:33.9, prov:"PELAYO"},
  {n:"STARKLE x UN (envase 1,7 kg) (dinotefuran 70%)", cat:"INS", u:"kg", p:208.0, prov:"PELAYO"},
  {n:"SULFA-FIX x 20 LT (SULFATO AMONIO)", cat:"COAD", u:"L", p:1.25, prov:"PELAYO"},
  {n:"SULFASTER PLUS (Sulfato de Amonio) x LT", cat:"HER", u:"L", p:17.6, prov:"PELAYO"},
  {n:"SULFENTRAZONE CAPAZ x 10 LT", cat:"HER", u:"L", p:20.3, prov:"PELAYO"},
  {n:"SULFENTRAZONE CAPAZ x 20 LT", cat:"HER", u:"L", p:20.3, prov:"PELAYO"},
  {n:"SULFENTRAZONE ENELAN x 5 LT", cat:"HER", u:"L", p:20.5, prov:"PELAYO"},
  {n:"SULFENTRAZONE MILENIAL x 5LT", cat:"HER", u:"L", p:20.5, prov:"PELAYO"},
  {n:"SULFENTRAZONE SHUTDOWN x 5 Lts", cat:"HER", u:"L", p:20.3, prov:"PELAYO"},
  {n:"SULFOSATO TOUCHDOWN x 20 LTRS.", cat:"HER", u:"L", p:5.9, prov:"PELAYO"},
  {n:"TERBUTILAZINA SIGMA x 20 Lts", cat:"HER", u:"L", p:6.7, prov:"PELAYO"},
  {n:"TEXARO (4x0,215) x 860 GRS", cat:"HER", u:"kg", p:340.0, prov:"PELAYO"},
  {n:"TIALOXIN x 5 LT (tiametoxam+lambda)", cat:"INS", u:"L", p:14.6, prov:"PELAYO"},
  {n:"TUKEN (diflufenican) x 5 Lts", cat:"HER", u:"L", p:25.2, prov:"PELAYO"},
  {n:"VENCEWEED EXTRA x 20 LT (2-4 DB)", cat:"HER", u:"L", p:12.0, prov:"PELAYO"},
  {n:"VIRANTRA x 5 LTS", cat:"INS", u:"L", p:247.0, prov:"PELAYO"},
  {n:"VOLIAM TARGO x 1 LT", cat:"INS", u:"L", p:73.33, prov:"PELAYO"},
  {n:"WINGER 85% WG (PIROXASULFONE) x 2,5 KG", cat:"HER", u:"kg", p:110.0, prov:"PELAYO"},
  {n:"WR4 - BIO x LT", cat:"COAD", u:"L", p:29.0, prov:"PELAYO"},
  {n:"ATRAZINA GESAPRIM 90%", cat:"HER", u:"L", p:6.32, prov:"PELAYO"},
  {n:"GLIFOSATO GRANULADO 88.8 AGNEO", cat:"HER", u:"kg", p:5.46, prov:"PELAYO"},
  {n:"GLIFOSATO TOUCHDOWN MAX 68,8%", cat:"HER", u:"L", p:5.42, prov:"PELAYO"},
  {n:"GLIFOSATO POWER PLUS 54%", cat:"HER", u:"L", p:3.91, prov:"PELAYO"},
  {n:"SULFOSATO TOUCHDOWN 50,6%", cat:"HER", u:"L", p:3.91, prov:"PELAYO"},
  {n:"GLIFOSATO GRANULADO BOX 72%", cat:"HER", u:"kg", p:5.66, prov:"PELAYO"},
  {n:"GLIFOSATO GRANULADO MAX SIGMA 68,8%", cat:"HER", u:"kg", p:4.94, prov:"PELAYO"},
  {n:"GLIFOSATO FULL 11 SIGMA 54%", cat:"HER", u:"L", p:3.7, prov:"PELAYO"},
  {n:"FLUMIOXAZIN GEMMIT TOP 48%", cat:"HER", u:"L", p:23.1, prov:"PELAYO"},
  {n:"FLUMIOXAZIN ESPUELA 48%", cat:"HER", u:"L", p:19.94, prov:"PELAYO"},
  {n:"FLUMIOXAZIN NYAMBI FLO 48%", cat:"HER", u:"L", p:17.85, prov:"PELAYO"},
  {n:"TUKEN (diflufenican 50%", cat:"HER", u:"L", p:25.72, prov:"PELAYO"},
  {n:"INSUAGRO (diflufenican) 50%", cat:"HER", u:"L", p:28.36, prov:"PELAYO"},
  {n:"DIFLUFENICAN SIGMA 50%", cat:"HER", u:"L", p:27.48, prov:"PELAYO"},
  {n:"VIRANTRA", cat:"INS", u:"L", p:242.0, prov:"PELAYO"},
  {n:"ENROLL", cat:"FUN", u:"L", p:15.0, prov:"PELAYO"},
  // ── BH CEREALES QUEMÚ ──
  {n:"CONTROLMAX", cat:"HER", u:"L", p:7.17, prov:"QUEMU"},
  {n:"TOP", cat:"HER", u:"L", p:5.67, prov:"QUEMU"},
  {n:"FG", cat:"HER", u:"L", p:7.06, prov:"QUEMU"},
  {n:"ADENGO", cat:"HER", u:"L", p:107.0, prov:"QUEMU"},
  {n:"2,4 DB x 20 Lt", cat:"HER", u:"L", p:13.2, prov:"QUEMU"},
  {n:"2,4 D ENLIST x 20 Lt", cat:"HER", u:"L", p:5.42, prov:"QUEMU"},
  {n:"Atrazina 90 % solida x 15 kg", cat:"HER", u:"kg", p:5.6, prov:"QUEMU"},
  {n:"Carfentrazonex 1 Lt", cat:"HER", u:"L", p:106.0, prov:"QUEMU"},
  {n:"CLEARSOL DF P/ 12 HAS", cat:"HER", u:"L", p:145.0, prov:"QUEMU"},
  {n:"Herb. Cletodim 24 % x 20 Lt", cat:"HER", u:"L", p:8.9, prov:"QUEMU"},
  {n:"Herb. Clopyralid x 5 Lt", cat:"HER", u:"L", p:35.8, prov:"QUEMU"},
  {n:"Dicamba 70.8 % Duranor Avance x Lt", cat:"HER", u:"L", p:7.1, prov:"QUEMU"},
  {n:"Herb. FINESSE WG x KG", cat:"HER", u:"kg", p:333.5, prov:"QUEMU"},
  {n:"Flumetsulam x 5 Lt", cat:"HER", u:"L", p:25.5, prov:"QUEMU"},
  {n:"Herb. Flumioxazin 48% x 5 Lt", cat:"HER", u:"L", p:19.0, prov:"QUEMU"},
  {n:"Flurocloridona 25 %", cat:"HER", u:"L", p:14.0, prov:"QUEMU"},
  {n:"Fluroxipir 48%", cat:"HER", u:"L", p:28.5, prov:"QUEMU"},
  {n:"Glufosinato de Amonio 20% x 20 Lt", cat:"HER", u:"L", p:4.1, prov:"QUEMU"},
  {n:"Haloxifop 54% x 5 Lt", cat:"HER", u:"L", p:25.43, prov:"QUEMU"},
  {n:"Acetoclor HARNESS x 20 Lt", cat:"HER", u:"L", p:7.2, prov:"QUEMU"},
  {n:"Herb. IMATRON x 5 Lt", cat:"HER", u:"L", p:41.0, prov:"QUEMU"},
  {n:"Imazetapir 10.6 % x 20 Lt", cat:"HER", u:"L", p:5.5, prov:"QUEMU"},
  {n:"Herb. MAYORAL x 5 Lt", cat:"HER", u:"L", p:43.0, prov:"QUEMU"},
  {n:"Metsulfuron Metil 60 %", cat:"HER", u:"L", p:50.0, prov:"QUEMU"},
  {n:"Paraquat 27.6% x 20 Lt", cat:"HER", u:"L", p:2.95, prov:"QUEMU"},
  {n:"Picloram 27.7 % x 5 Lt", cat:"HER", u:"L", p:7.5, prov:"QUEMU"},
  {n:"Trifluralina 60% x 20 Its", cat:"HER", u:"L", p:17.83, prov:"QUEMU"},
  {n:"Safiufenacil HEAT x 350 g", cat:"HER", u:"L", p:313.0, prov:"QUEMU"},
  {n:"S-Metolaclor x Lt", cat:"HER", u:"L", p:6.5, prov:"QUEMU"},
  {n:"Sulfentrazone 50 % x 5 Lt", cat:"HER", u:"L", p:19.6, prov:"QUEMU"},
  {n:"LAUDIS", cat:"HER", u:"L", p:126.0, prov:"QUEMU"},
  {n:"MATENO PLUS", cat:"HER", u:"L", p:20.5, prov:"QUEMU"},
  {n:"EQUIP", cat:"HER", u:"L", p:235.0, prov:"QUEMU"},
  {n:"HUSSAR PLUS", cat:"HER", u:"L", p:377.5, prov:"QUEMU"},
  {n:"PUMA EXTRA", cat:"HER", u:"L", p:28.5, prov:"QUEMU"},
  {n:"LATIUM SUPER", cat:"HER", u:"L", p:13.5, prov:"QUEMU"},
  {n:"PERCUTOR", cat:"HER", u:"L", p:285.0, prov:"QUEMU"},
  {n:"BRODAL", cat:"HER", u:"L", p:35.0, prov:"QUEMU"},
  {n:"OPTIMIZER", cat:"HER", u:"L", p:4.6, prov:"QUEMU"},
  {n:"MERLIN", cat:"HER", u:"L", p:110.0, prov:"QUEMU"},
  {n:"FINISH", cat:"HER", u:"L", p:27.0, prov:"QUEMU"},
  {n:"PRODIGIO", cat:"HER", u:"L", p:29.0, prov:"QUEMU"},
  {n:"SENCOREX X10", cat:"HER", u:"L", p:21.0, prov:"QUEMU"},
  {n:"POWERSPRAY 2,4D 68%", cat:"HER", u:"L", p:6.0, prov:"QUEMU"},
  {n:"STAMPA", cat:"HER", u:"L", p:11.0, prov:"QUEMU"},
  {n:"SPRUCE", cat:"HER", u:"L", p:184.0, prov:"QUEMU"},
  {n:"CRIPTON", cat:"FUN", u:"L", p:33.0, prov:"QUEMU"},
  {n:"CRIPTON XPRO", cat:"FUN", u:"L", p:56.0, prov:"QUEMU"},
  {n:"SPHERE MAX", cat:"FUN", u:"L", p:77.0, prov:"QUEMU"},
  {n:"BLON", cat:"FUN", u:"L", p:61.0, prov:"QUEMU"},
  {n:"BELT", cat:"FUN", u:"L", p:115.0, prov:"QUEMU"},
  {n:"SOLOMON", cat:"INS", u:"L", p:30.0, prov:"QUEMU"},
  {n:"ALSYSTIN", cat:"INS", u:"L", p:89.0, prov:"QUEMU"},
  {n:"LARVIN", cat:"INS", u:"L", p:69.5, prov:"QUEMU"},
  {n:"DECIS FLOW", cat:"INS", u:"L", p:97.5, prov:"QUEMU"},
  {n:"DECIS FORTE", cat:"INS", u:"L", p:37.5, prov:"QUEMU"},
  {n:"MOVENTO PLUS", cat:"INS", u:"L", p:59.0, prov:"QUEMU"},
  {n:"OBERON", cat:"INS", u:"L", p:21.0, prov:"QUEMU"},
  {n:"Insect. Bifentrin 10% 4x5 Lt", cat:"INS", u:"L", p:8.8, prov:"QUEMU"},
  {n:"Insect. Abamectina (3.6%) x 5 Lt", cat:"INS", u:"L", p:12.5, prov:"QUEMU"},
  {n:"Insecticida Acefato", cat:"INS", u:"L", p:26.0, prov:"QUEMU"},
  {n:"Insect. Dimetoato x 20 Lt", cat:"INS", u:"L", p:12.5, prov:"QUEMU"},
  {n:"Imidacloprid 60% x Lt", cat:"INS", u:"L", p:31.8, prov:"QUEMU"},
  {n:"Actellic 50", cat:"INS", u:"L", p:60.0, prov:"QUEMU"},
  {n:"PhosGas 480", cat:"INS", u:"L", p:65.0, prov:"QUEMU"},
  {n:"SCENC", cat:"SGR", u:"L", p:34.0, prov:"QUEMU"},
  {n:"CHUCARO", cat:"SGR", u:"L", p:97.0, prov:"QUEMU"},
  {n:"PUCARA", cat:"SGR", u:"L", p:111.0, prov:"QUEMU"},
  {n:"ACCELERON CEREALES ESS.", cat:"SGR", u:"L", p:330.0, prov:"QUEMU"},
  {n:"EVERGOL ENERGYX20", cat:"SGR", u:"L", p:65.0, prov:"QUEMU"},
  {n:"EVERGOL ENERGY200", cat:"SGR", u:"L", p:65.0, prov:"QUEMU"},
  {n:"REGENT ET", cat:"SGR", u:"L", p:530.0, prov:"QUEMU"},
  {n:"CROPSTAR", cat:"SGR", u:"L", p:47.5, prov:"QUEMU"},
  {n:"ACCELERON SOJA BASIC", cat:"SGR", u:"L", p:190.0, prov:"QUEMU"},
  {n:"ACCELERON SOJA ESENCIAL", cat:"SGR", u:"L", p:265.0, prov:"QUEMU"},
  {n:"SUNATO", cat:"SGR", u:"L", p:67.0, prov:"QUEMU"},
  {n:"Aceite Metilado VERSION x 20 Lt", cat:"COAD", u:"L", p:2.9, prov:"QUEMU"},
  {n:"Aceite Vegetal EXET x 20 Lt", cat:"COAD", u:"L", p:2.83, prov:"QUEMU"},
  {n:"Aceite Mineral NOVAOIL x 20 Lt", cat:"COAD", u:"L", p:3.5, prov:"QUEMU"},
  {n:"Coady. Break-Thru MSO MAX x 10 Lt", cat:"COAD", u:"L", p:13.8, prov:"QUEMU"},
  {n:"Coady. Humectante Break-Thru x 1 Lt", cat:"COAD", u:"L", p:40.4, prov:"QUEMU"},
  {n:"Coady. Corrector TROP CS x 1 Lt", cat:"COAD", u:"L", p:28.3, prov:"QUEMU"},
  {n:"Sulfato de Amonio", cat:"COAD", u:"L", p:1.5, prov:"QUEMU"},
  {n:"Coady. Siliconado SILWET LAG x 1 Lt", cat:"COAD", u:"L", p:50.5, prov:"QUEMU"},
  {n:"Coady. RizoSpray EXTREMO x 10 Lt", cat:"COAD", u:"L", p:19.18, prov:"QUEMU"},
  {n:"Coady. RizoSpray Integrum x 10 Lt", cat:"COAD", u:"L", p:20.63, prov:"QUEMU"},
  {n:"Coady. RizoSpray Corrector Secuestrante x 1 Lt", cat:"COAD", u:"L", p:34.5, prov:"QUEMU"},
  {n:"Coady. RizoSpray ZEN x 5 Lts", cat:"COAD", u:"L", p:25.0, prov:"QUEMU"},
  {n:"Coady. VVI Biofilm", cat:"COAD", u:"L", p:14.4, prov:"QUEMU"},
  {n:"Corrector Biofilm", cat:"COAD", u:"L", p:27.9, prov:"QUEMU"},
  // ── Labores, fertilizantes y semillas ──
  {n:"PULVERIZADA TERRESTRE", cat:"LABOR", u:"ha", p:6.3},
  {n:"PULVERIZADA AEREA", cat:"LABOR", u:"ha", p:6.3},
  {n:"INCORPORADA", cat:"LABOR", u:"ha", p:31},
  {n:"VOLEADA", cat:"LABOR", u:"ha", p:10},
  {n:"PARATIL", cat:"LABOR", u:"ha", p:65},
  {n:"RASTRA", cat:"LABOR", u:"ha", p:45},
  {n:"ROLOS", cat:"LABOR", u:"ha", p:31.25},
  {n:"SG (siembra)", cat:"LABOR", u:"ha", p:48},
  {n:"Mz PP (siembra maiz)", cat:"LABOR", u:"ha", p:60},
  {n:"Sj PP (siembra soja)", cat:"LABOR", u:"ha", p:60},
  {n:"Gr PP (siembra girasol)", cat:"LABOR", u:"ha", p:58},
  {n:"Sj 2da (siembra soja de segunda)", cat:"LABOR", u:"ha", p:55},
  {n:"Mz Fert (siembra fertilizada maiz)", cat:"LABOR", u:"ha", p:55},
  {n:"Gr Fert (siembra fertilizada girasol)", cat:"LABOR", u:"ha", p:55},
  {n:"Sj FERT (siembra fertilizada soja)", cat:"LABOR", u:"ha", p:60},
  {n:"Fina fert (siembra fertilizada fina)", cat:"LABOR", u:"ha", p:57},
  {n:"UREA-S NUTRIEN", cat:"FERT", u:"kg", p:0.565},
  {n:"MAP LARTY", cat:"FERT", u:"kg", p:0.95},
  {n:"MAP AZURADO NUTRIEN", cat:"FERT", u:"kg", p:0.937},
  {n:"DAP-S NUTRIEN", cat:"FERT", u:"kg", p:0.919},
  {n:"NITROCOMPLEX", cat:"FERT", u:"kg", p:0.99},
  {n:"SJ NUTRIEN", cat:"FERT", u:"kg", p:0.716},
  {n:"Nutrimap", cat:"FERT", u:"kg", p:0.76},
  {n:"ADV 5505 CL B2", cat:"SEM", u:"bolsa", p:280},
  {n:"ADV 5407 CL B1", cat:"SEM", u:"bolsa", p:295},
  {n:"ADV 5310 CL B1", cat:"SEM", u:"bolsa", p:290},
  {n:"DK7210", cat:"SEM", u:"bolsa", p:160},
  {n:"DK7303", cat:"SEM", u:"bolsa", p:130},
  {n:"DK6962", cat:"SEM", u:"bolsa", p:195},
  {n:"syn 3970 cl", cat:"SEM", u:"bolsa", p:296},
  {n:"TRIGO PROPIO", cat:"SEM", u:"kg", p:0.278},
  {n:"CEBADA PROPIA", cat:"SEM", u:"kg", p:0.278},
  {n:"CENTENO PROPIO", cat:"SEM", u:"kg", p:0.411},
  {n:"AVENA PROPIA", cat:"SEM", u:"kg", p:0.411},
  {n:"SJ PROPIA", cat:"SEM", u:"kg", p:0.04},
];



const PRODUCTORES_BASE = ["ENRIQUE","ANDRES","ENRIQUE - ANDRES","MARIANO","MARIANO - ANDRES","MARIANO - MATIAS - ANDRES","HAYDEE","HAYDEE - MARIANO","MATIAS","LORENZO","FAROUX MARIA GRACIELA","MATEAN SAS","SUC"];

// Recetas plantilla (dosis/ha típicas)
const RECETAS_BASE = [
  {nombre:"Reseteo maíz y soja", productos:[
    {n:"GLIFOSATO GRANULADO BOX 72%", d:2.0},
    {n:"2-4 D 97 SIGMA x 20 LT", d:1.5},
    {n:"DICAMBA SIGMA x 10 LT", d:0.2},
    {n:"ACEITE METILADO ROCIO x 3 LT", d:0.1},
    {n:"LIGIER PH BIO x LT", d:0.05},
  ]},
  {nombre:"Barbecho largo girasol", productos:[
    {n:"GLIFOSATO GRANULADO BOX 72%", d:1.5},
    {n:"2-4 D 97 SIGMA x 20 LT", d:1.0},
    {n:"LIGIER PH BIO x LT", d:0.05},
    {n:"FLUROXIPIR 48 SIGMA x 5 Lts", d:0.3},
    {n:"DIFLUFENICAN SIGMA 50%", d:0.2},
  ]},
];

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
    {id:"1",label:"1",ha:65,poly:[[15,396],[122,396],[122,455],[210,456],[210,735],[18,522]]},
    {id:"8",label:"8",ha:42,poly:[[15,526],[225,762],[15,762]]},
    {id:"2N",label:"2 N",ha:70,poly:[[210,390],[405,390],[405,610],[210,610]]},
    {id:"2S",label:"2 S",ha:40,poly:[[210,610],[405,610],[405,735],[210,735]]},
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
    {id:"5A",label:"5A",ha:20,poly:[[516,205],[610,205],[610,303],[516,303]]},
    {id:"5B",label:"5B",ha:40,poly:[[516,303],[610,303],[610,400],[516,400]]},
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
  {id:"EL 5",nombre:"El 5",vb:[0,0,960,405],refs:[],
   grises:[
     {poly:[[743,249],[746,285],[760,286],[763,260],[750,248]],label:"isleta"},
   ],
   lotes:[
    {id:"7",label:"7",ha:250,poly:[[34,29],[46,196],[519,206],[513,44]]},   // monte NO
    {id:"8",label:"8",ha:245,poly:[[46,202],[47,366],[522,364],[520,212],[269,202]]},   // monte SO
    {id:"6",label:"6",ha:100,poly:[[526,213],[529,364],[738,368],[724,232],[717,230],[716,220]]},   // monte centro-sur
    {id:"5L",label:"5L",ha:26,poly:[[521,43],[524,83],[546,83],[671,120],[670,46]]},   // 5 limpio
    {id:"5M",label:"5M",ha:52,poly:[[522,85],[526,208],[678,215],[673,204],[671,169],[655,132],[656,116],[580,92],[548,85]]},   // 5 monte
    {id:"4",label:"4",ha:32,poly:[[672,47],[674,202],[690,216],[731,217],[731,50]]},
    {id:"1C",label:"1c",ha:42,poly:[[732,49],[732,127],[903,123],[907,54]]},
    {id:"1A",label:"1a",ha:28,poly:[[823,126],[733,128],[734,218],[742,219],[749,226],[820,229]]},
    {id:"1B",label:"1b",ha:20,poly:[[903,124],[824,126],[820,228],[839,229],[842,202],[902,203]]},
    {id:"2",label:"2",ha:32,poly:[[733,227],[902,230],[903,292],[734,295]]},   // 32 ha netas; la isleta va aparte
    {id:"3L",label:"3L",ha:10,poly:[[903,294],[737,296],[740,319],[811,318],[818,309],[902,309]]},   // 3 limpio
    {id:"3M",label:"3M",ha:28,poly:[[740,320],[743,367],[902,369],[902,310],[815,310],[807,320]]},   // 3 monte
   ]},
  {id:"LA FLECHA",nombre:"La Flecha",vb:[0,0,345,265],refs:[],
   lotes:[
    {id:"1",label:"1",ha:6,poly:[[15,15],[85,15],[85,100],[15,100]]},
    {id:"2",label:"2",ha:18,poly:[[85,15],[210,15],[210,120],[85,120]]},
    {id:"3",label:"3",ha:20,poly:[[210,15],[330,15],[330,120],[210,120]]},
    {id:"5",label:"5",ha:25,poly:[[15,100],[210,100],[210,250],[15,250]]},
    {id:"4",label:"4",ha:25,poly:[[210,120],[330,120],[330,250],[210,250]]},
   ]},
  {id:"DON ANTONIO",nombre:"Don Antonio",vb:[0,0,600,575],refs:[{x:594,y:290,t:"Ruta N° 7",rot:90}],
   grises:[
     // laguna dentro del lote 13, calcada de la imagen satelital (~24 ha de espejo)
     {poly:[[267,146],[257,139],[247,151],[226,150],[210,134],[196,95],[181,85],[151,90],[128,113],[121,138],[51,202],[38,228],[39,251],[129,257],[191,204],[247,174]],label:"laguna"},
   ],
   lotes:[
    // ── Fila superior ───────────────────────────────────
    {id:"12",label:"12",ha:21,poly:[[4,6],[323,5],[323,48],[295,38],[274,74],[206,74],[200,66],[177,41],[138,36],[41,77],[4,103]]},
    {id:"9",label:"9",ha:15,poly:[[323,5],[438,6],[438,122],[381,122],[358,122],[350,123],[350,111],[330,71],[323,48]]},
    // esquina NE: dos lotes rectangulares, 8a la franja angosta y 8 el bloque grande
    {id:"8A",label:"8a",ha:7.5,poly:[[438,6],[484,6],[484,134],[438,134]]},
    {id:"8",label:"8",ha:5,poly:[[484,6],[577,6],[577,134],[484,134]]},

    // ── Fila media ──────────────────────────────────────
    // 13: gran lote oeste con la laguna. Perdió 16 ha al abrirse los lotes 14 y 15
    {id:"13",label:"13",ha:66,poly:[[4,103],[41,77],[138,36],[177,41],[200,66],[206,74],[274,74],[295,38],[323,48],[330,71],[350,111],[350,123],[254,194],[133,281],[4,283],[2,268],[59,183],[150,108],[4,106]]},
    // 15: cuña al oeste, entre la línea de arriba y la diagonal
    {id:"15",label:"15",ha:8,poly:[[4,106],[150,108],[59,183],[2,268]]},
    // 14: triángulo contra el 11 y la línea del medio
    {id:"14",label:"14",ha:8,poly:[[253,190],[254,283],[133,281]]},
    {id:"11",label:"11",ha:21,poly:[[254,194],[350,123],[381,122],[381,283],[254,283]]},
    {id:"10",label:"10",ha:10,poly:[[381,122],[438,122],[439,248],[413,248],[410,268],[381,268]]},
    {id:"7",label:"7",ha:25,poly:[[439,134],[577,134],[577,278],[443,278],[443,248],[439,248]]},

    // ── Franja delgada 5 ────────────────────────────────
    {id:"5",label:"5",ha:5.3,poly:[[288,283],[381,283],[402,285],[402,319],[288,319]]},

    // ── Fila baja ───────────────────────────────────────
    {id:"4",label:"4",ha:20,poly:[[288,319],[443,319],[443,421],[288,421]]},
    {id:"3",label:"3",ha:20,poly:[[443,319],[581,319],[581,421],[443,421]]},

    // ── Fila inferior ───────────────────────────────────
    {id:"2",label:"2",ha:27,poly:[[288,421],[443,421],[443,565],[293,565],[288,558]]},
    {id:"1",label:"1",ha:25,poly:[[443,421],[581,421],[584,439],[584,565],[443,565]]},
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
    {id:"2",label:"2",ha:13,poly:[[15,250],[172,250],[172,360],[15,360]]},
    {id:"1",label:"1",ha:17,poly:[[15,360],[172,360],[172,475],[15,475]]},
    // 6 y 7 unificados: se sacó el alambre del medio
    {id:"6",label:"6",ha:10,poly:[[172,250],[280,250],[280,475],[172,475]]},
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
  {id:"LA ILUSION",nombre:"La Ilusión",vb:[0,0,375,530],refs:[],
   lotes:[
    {id:"1",label:"1",ha:50,poly:[[185,10],[272,10],[272,178],[185,178]]},
    {id:"2",label:"2",ha:50,poly:[[272,10],[357,10],[357,178],[272,178]]},
    {id:"3",label:"3",ha:42,poly:[[18,178],[185,178],[185,248],[18,248]]},
    // el 4 tiene un escalón abajo a la derecha, donde queda una franja entre el 4 y el 6
    {id:"4",label:"4",ha:42,poly:[[185,178],[357,178],[357,262],[292,262],[292,248],[185,248]]},
    {id:"5",label:"5",ha:55,poly:[[18,248],[185,248],[185,345],[18,345]]},
    {id:"6",label:"6",ha:50,poly:[[185,248],[272,248],[272,270],[357,266],[357,345],[185,345]]},
    {id:"7",label:"7",ha:48,poly:[[18,345],[185,345],[185,432],[18,432]]},
    {id:"8",label:"8",ha:50,poly:[[18,432],[185,432],[185,518],[18,518]]},
   ]},
];

// ── LÓGICA DE CAPAS ─────────────────────────────────────────
// modo = campaña | rindes | margenes | suelos
// modo = campaña | rindes | margenes | suelos
// suelo_var = P | N | MO
// datos = {INV_26, PLAN_2627, RINDE_2526, SUELOS}
// Devuelve fill primario, label. Si es doble cultivo devuelve fill2 (para rayado)
// Busca un valor en un diccionario tolerando distintos formatos de clave.
// La app usa "CAMPO|LOTE" (ej "L3H|9B"), pero el pipeline a veces escribe
// "CAMPO|CAMPO-LOTE" (ej "L3H|L3H-9B"). Probamos ambos.
// ── Matcheo de lotes entre la planilla de labores y los lotes del mapa ──
// En la planilla el lote viene escrito de muchas formas: "5 b (sur)", "8B (SUR)",
// "3OESTE", "2-4-5", "2,4 y 5", "13ch", "10 O", "1,0". Acá lo normalizamos.
const normLoteRef = (s) => {
  let t = String(s ?? "").toUpperCase();
  t = t.replace(/\([^)]*\)/g, " ");          // saca "(sur)", "(norte)", etc.
  t = t.replace(/\s+/g, "");                  // saca espacios
  t = t.replace(/,0$/, "");                   // "12,0" -> "12"
  // sufijos cardinales escritos completos
  t = t.replace(/OESTE$/, "O").replace(/ESTE$/, "E")
       .replace(/NORTE$/, "N").replace(/SUR$/, "S");
  return t;
};

// Devuelve los lotes individuales que menciona una referencia de la planilla.
// "2,4 y 5" -> ["2","4","5"] | "2-4-5" -> ["2","4","5"] | "5 b (sur)" -> ["5B"]
const lotesDeReferencia = (s) => {
  const base = normLoteRef(s);
  if (!base) return [];
  // separadores: coma, punto y coma, barra, Y, guión
  const trozos = base.split(/[,;/]|(?<=\d)-(?=\d)|(?<=[A-Z0-9])Y(?=\d)/)
    .map(x => x.trim()).filter(Boolean);
  const out = trozos.length ? trozos : [base];
  // devolvemos también la referencia entera, por si el lote se llama así
  if (!out.includes(base)) out.push(base);
  return out;
};

// ¿La referencia de la planilla apunta a este lote del mapa?
const refApuntaALote = (ref, loteId) => {
  const objetivo = normLoteRef(loteId);
  if (!objetivo) return false;
  return lotesDeReferencia(ref).includes(objetivo);
};

function buscarKey(dic, campoId, loteId){
  if(!dic) return undefined;
  const variantes = [
    `${campoId}|${loteId}`,
    `${campoId}|${campoId}-${loteId}`,
    `${campoId}|${campoId} ${loteId}`,
  ];
  for(const v of variantes){
    if(dic[v] !== undefined) return dic[v];
  }
  // Último intento: normalizar (sin espacios, mayúsculas) y comparar el sufijo del lote
  const objetivo = String(loteId).toUpperCase().replace(/\s+/g,"");
  for(const key of Object.keys(dic)){
    const [c, l] = key.split("|");
    if(!c || !l) continue;
    if(c.toUpperCase().replace(/\s+/g,"") !== String(campoId).toUpperCase().replace(/\s+/g,"")) continue;
    // el lote puede venir como "L3H-9B" o "9B"
    const soloLote = l.toUpperCase().replace(/\s+/g,"").replace(new RegExp(`^${campoId.toUpperCase().replace(/\s+/g,"")}-?`), "");
    if(soloLote === objetivo) return dic[key];
  }
  return undefined;
}

function getFill(campoId, loteId, modo, sueloVar, datos = {}) {
  const {INV_26 = INV_26_FALLBACK, PLAN_2627 = PLAN_2627_FALLBACK, RINDE_2526 = RINDE_2526_FALLBACK, SUELOS = SUELOS_FALLBACK} = datos;
  if(modo==="campaña"){
    const invRaw=buscarKey(INV_26, campoId, loteId);     // cultivo fina (invierno)
    const planRaw=buscarKey(PLAN_2627, campoId, loteId);  // gruesa, o doble cultivo "X-Y"
    // Normalizamos: el dato puede venir con el doble cultivo completo en cualquiera
    // de los dos campos (según cómo lo haya escrito el pipeline).
    const pInv = cvPartes(invRaw), pPlan = cvPartes(planRaw);
    let fina = null, gruesa = null;
    if(pPlan.length >= 2){          // "CEBADA-SOJA" en PLAN
      fina = pPlan[0]; gruesa = pPlan[1];
    } else if(pInv.length >= 2){    // "CEBADA-SOJA" en INV
      fina = pInv[0]; gruesa = pInv[1];
    } else {
      fina = pInv[0] || null;
      gruesa = pPlan[0] || null;
    }
    // Si fina y gruesa son lo mismo (ej PASTURA), no es doble cultivo
    if(fina&&gruesa&&fina===gruesa) gruesa=null;
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
    const r=buscarKey(RINDE_2526, campoId, loteId);
    if(r==null) return {fill:"#F0EDE5",label:"s/d",dim:true};
    return {fill:escalaColor(r,0,90,"#FFF5CC","#BF4000")||"#FFF5CC",label:`${r} qq/ha`,dim:false};
  }
  if(modo==="margenes"){
    const m=buscarKey(MB_LOTE, campoId, loteId);
    if(!m) return {fill:"#F0EDE5",label:"s/d",dim:true};
    const fill=m.mbsa>=0
      ? escalaColor(m.mbsa,0,1200,"#C8E6C9","#1B5E20")||"#C8E6C9"
      : escalaColor(Math.abs(m.mbsa),0,600,"#FFCDD2","#B71C1C")||"#FFCDD2";
    return {fill,label:`${m.mbsa>=0?"+":""}${fmt(m.mbsa)} US$/ha`,dim:false};
  }
  if(modo==="residuales"){
    const r=(datos.RESIDUALES||{})[`${campoId}|${loteId}`];
    if(!r) return {fill:"#F0EDE5",label:"",dim:true};
    const e=ESTADO_LOTE[r.estado]||ESTADO_LOTE.sinprot;
    return {fill:e.mapa,label:r.corto,label2:r.fecha,dim:r.estado==="sinprot"&&r.corto==="sin residual",tip:`${e.icono} ${r.tip}`};
  }
  if(modo==="suelos"){
    const s=buscarKey(SUELOS, campoId, loteId);
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
function MapaCampo({campo, modo, sueloVar, mini=false, onLoteClick, datos, cultivoFiltro=null, cultivosDeLote=null}){
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
        let {fill,fill2,label,label2,dim,doble,tip}=info;
        // Filtro por cultivo: si está activo y este lote no lo tiene, atenuar
        let apagadoPorFiltro=false;
        if(cultivoFiltro&&cultivosDeLote){
          const cvs=cultivosDeLote(campo.id,l.id);
          if(!cvs.includes(cultivoFiltro)){ apagadoPorFiltro=true; dim=true; }
        }
        const [cx,cy]=centro(l.poly);
        const w=anchoP(l.poly);
        const isH=hov===l.id;
        const patternId=`p_${campo.id.replace(/\s+/g,"")}_${l.id.replace(/\s+/g,"")}`.replace(/[^a-zA-Z0-9_]/g,"");
        return <g key={l.id} onMouseEnter={()=>!mini&&setHov(l.id)} onMouseLeave={()=>setHov(null)} onClick={onLoteClick?()=>onLoteClick(campo,l):undefined}>
          {doble&&!apagadoPorFiltro&&(
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width={12*k} height={12*k} patternTransform="rotate(45)">
                <rect width={6*k} height={12*k} fill={fill}/>
                <rect x={6*k} width={6*k} height={12*k} fill={fill2}/>
              </pattern>
            </defs>
          )}
          <polygon points={l.poly.map(p=>p.join(",")).join(" ")}
            fill={apagadoPorFiltro?"#EDEBE3":(doble?`url(#${patternId})`:fill)} stroke={isH?"#1A1610":TINTA}
            strokeWidth={(isH?2.5:dim?0.8:1.3)*k} opacity={apagadoPorFiltro?0.4:(dim?0.75:1)}/>
          {!mini&&w>=34*k&&(
            <g style={{pointerEvents:"none"}}>
              <text x={cx} y={cy+(dim?-2:label?-6:-2)*k} fontSize={(w<55*k?9.5:12)*k}
                fontWeight="700" textAnchor="middle"
                fill={dim?"#B0A89A":TINTA} opacity={dim?0.55:1}>{l.label}</text>
              {l.ha&&<text x={cx} y={cy+(dim?9:label?4:9)*k} fontSize={(w<55*k?7.5:9)*k} textAnchor="middle" fill={dim?"#B0A89A":TINTA} opacity={dim?0.5:0.65}>{l.ha} ha</text>}
              {!dim&&label&&(()=>{
                // la letra se achica para que el texto no se salga del lote
                const fs=Math.min(8.5*k,(w*0.9)/(Math.max(String(label).length,String(label2||"").length)*0.56));
                if(fs<4.5*k) return null;
                return <>
                  <text x={cx} y={cy+15*k} fontSize={fs} textAnchor="middle" fill={TINTA} opacity={0.85}>{label}</text>
                  {label2&&<text x={cx} y={cy+15*k+fs*1.15} fontSize={fs} textAnchor="middle" fill={TINTA} opacity={0.85}>{label2}</text>}
                </>;
              })()}
            </g>
          )}
          {isH&&!mini&&(()=>{
            const txt=`${l.label}: ${tip||label||"—"}`;
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
  if(modo==="residuales") return <div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",marginTop:6,alignItems:"center"}}>
    {["verde","amarillo","rojo","sinprot"].map(k=>[ESTADO_LOTE[k].mapa,ESTADO_LOTE[k].txt]).map(([c,t])=>
      <div key={t} style={tag}><span style={{width:11,height:11,borderRadius:3,background:c,border:`1px solid ${TINTA}`,flexShrink:0}}/>{t}</div>)}
    <span style={{fontSize:11.5,opacity:0.7}}>En cada lote: último residual y fecha. Al pasar el mouse: hasta cuándo cubre y qué sigue.</span>
  </div>;
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

// Pasa a minúsculas y saca tildes, para buscar sin que importen mayúsculas ni acentos
const normBusca = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

// Selector de producto con buscador: al escribir se filtra la lista ("glifo" → todos los glifosatos).
// Varias palabras se combinan: "glifo box" encuentra "GLIFOSATO GRANULADO LT BOX".
function BuscadorProducto({valor, lista, color, negrita, onElegir, onNuevo}){
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const [caja, setCaja] = useState(null);   // dónde está el campo en pantalla, para ubicar la lista
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const filtrados = useMemo(() => {
    const palabras = normBusca(texto).split(/\s+/).filter(Boolean);
    if(!palabras.length) return lista;
    return lista.filter(pd => { const n = normBusca(pd.n); return palabras.every(w => n.includes(w)); });
  }, [lista, texto]);
  const grupos = useMemo(() => ["PELAYO","QUEMU","PROPIO",""]
    .map(gr => ({gr, items: filtrados.filter(pd => (pd.prov||"") === gr)}))
    .filter(g => g.items.length), [filtrados]);
  const planas = useMemo(() => grupos.flatMap(g => g.items), [grupos]);

  const medir = () => {
    const r = inputRef.current && inputRef.current.getBoundingClientRect();
    if(!r) return;
    const ancho = Math.min(Math.max(r.width, 300), window.innerWidth - 16);
    const abajo = window.innerHeight - r.bottom - 8, arriba = r.top - 8;
    const sobre = abajo < 180 && arriba > abajo;   // casi sin lugar abajo (teclado): se abre hacia arriba
    setCaja({
      left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), ancho, sobre,
      top: sobre ? null : r.bottom + 2, bottom: sobre ? window.innerHeight - r.top + 2 : null,
      alto: Math.max(120, Math.min(300, sobre ? arriba : abajo)),
    });
  };
  useEffect(() => {
    if(!abierto) return;
    const alMover = e => { if(!(listaRef.current && listaRef.current.contains(e.target))) medir(); };
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", alMover, true); window.removeEventListener("resize", medir); };
  }, [abierto]);
  useEffect(() => {
    if(!abierto || !listaRef.current) return;
    const el = listaRef.current.querySelector(`[data-idx="${activo}"]`);
    if(el && el.scrollIntoView) el.scrollIntoView({block:"nearest"});
  }, [activo, abierto]);

  const cerrar = () => { setAbierto(false); setTexto(""); };
  const elegir = n => { onElegir(n); cerrar(); if(inputRef.current) inputRef.current.blur(); };
  const nuevo = () => { onNuevo(planas.length ? "" : texto.trim()); cerrar(); if(inputRef.current) inputRef.current.blur(); };
  const teclas = e => {
    if(e.key === "ArrowDown"){ e.preventDefault(); setActivo(i => Math.min(i+1, Math.max(planas.length-1, 0))); }
    else if(e.key === "ArrowUp"){ e.preventDefault(); setActivo(i => Math.max(i-1, 0)); }
    else if(e.key === "Enter"){ e.preventDefault(); if(planas[activo]) elegir(planas[activo].n); }
    else if(e.key === "Escape"){ cerrar(); if(inputRef.current) inputRef.current.blur(); }
  };
  // mouseDown con preventDefault: el campo no pierde el foco al tocar una opción
  const sinFoco = e => e.preventDefault();
  const etiqGrupo = gr => gr==="PELAYO" ? "🟢 BH PELAYO" : gr==="QUEMU" ? "🔴 BH CEREALES QUEMÚ" : gr==="PROPIO" ? "🔵 Míos" : "⚪ Otros";

  let idx = -1;
  return (
    <div style={{position:"relative",minWidth:0}}>
      <input ref={inputRef} type="text" value={abierto ? texto : valor}
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
        placeholder={abierto ? (valor || "Buscar producto…") : "— vacío —"}
        onFocus={() => { setAbierto(true); setTexto(""); setActivo(0); medir(); }}
        onBlur={cerrar}
        onChange={e => { setTexto(e.target.value); setActivo(0); }}
        onKeyDown={teclas}
        style={{padding:"5px 16px 5px 6px",fontSize:11.5,border:"none",background:"transparent",fontFamily:"inherit",
          color:color,fontWeight:negrita?600:400,width:"100%",minWidth:0,boxSizing:"border-box",textOverflow:"ellipsis"}}/>
      <span style={{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",fontSize:9,opacity:0.5,pointerEvents:"none"}}>▾</span>
      {abierto && caja && (
        <div ref={listaRef} style={{position:"fixed",left:caja.left,top:caja.top ?? "auto",bottom:caja.bottom ?? "auto",
          width:caja.ancho,maxHeight:caja.alto,overflowY:"auto",zIndex:1000,background:"#fff",border:`1.5px solid ${TINTA}`,
          borderRadius:8,boxShadow:"0 6px 18px rgba(0,0,0,0.18)"}}>
          {valor && !texto && (
            <div onMouseDown={sinFoco} onClick={() => elegir("")}
              style={{padding:"7px 10px",fontSize:12,cursor:"pointer",opacity:0.65,borderBottom:"1px solid #F1EDE0"}}>— vacío —</div>
          )}
          {grupos.map(g => (
            <div key={g.gr||"otros"}>
              <div style={{padding:"4px 10px",fontSize:10.5,fontWeight:700,background:"#F8F5EC",color:TINTA}}>{etiqGrupo(g.gr)}</div>
              {g.items.map(pd => {
                idx += 1; const mi = idx;
                return (
                  <div key={pd.n} data-idx={mi} onMouseDown={sinFoco} onClick={() => elegir(pd.n)} onMouseEnter={() => setActivo(mi)}
                    style={{padding:"7px 10px",fontSize:12,cursor:"pointer",borderBottom:"1px solid #F1EDE0",
                      background:mi===activo?"#EAF1DF":"transparent",color:pd.prov?COLOR_PROV[pd.prov]:TINTA,fontWeight:pd.n===valor?700:400}}>
                    {pd.n}
                  </div>
                );
              })}
            </div>
          ))}
          {!planas.length && <div style={{padding:"8px 10px",fontSize:12,opacity:0.6}}>Sin resultados para “{texto.trim()}”</div>}
          <div onMouseDown={sinFoco} onClick={nuevo}
            style={{padding:"8px 10px",fontSize:12,fontWeight:600,cursor:"pointer",color:"#1E5FA8",background:"#F4F8FD",position:"sticky",bottom:0}}>
            ➕ Agregar producto{!planas.length && texto.trim() ? ` “${texto.trim()}”` : "…"}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROTOCOLO DE RESIDUALES — editable desde la pestaña "Protocolo"
// Cada cultivo tiene pasos con ventana (dd/mm) y "clave": los activos que
// tienen que aparecer en la planilla para dar el paso por hecho.
// En la clave, "+" = y, "|" = o. Ej: "flurocloridona + metolacloro | paraquat + sulfentrazone"
// ============================================================
const PROTOCOLO_BASE = {
  version: 3,
  campania: "26-27",
  criterios: [
    "Suelo limpio: si hay malezas nacidas, el residual va con quemante (glifosato/ControlMax + 2,4-D, o paraquat 2 L).",
    "Coadyuvante: aceite sólo cuando la mezcla lleva un foliar; un residual solo no lo necesita.",
    "Activación: sin 10–15 mm dentro de los 10–15 días, el residual no carga; el siguiente se adelanta.",
    "Dosis: en L o kg de formulado por ha (sulfentrazone 50%, flurocloridona 25%, atrazina 90%, diflufenican 50%, flumioxazin 48%).",
  ].join("\n"),
  cultivos: [
    {id:"girasol", nombre:"Girasol", aplicaA:"GIRASOL, *-GIRASOL", siembraDesde:"05/10", siembraHasta:"15/11", pasos:[
      {id:"girasol-1", nombre:"Barbecho largo", desde:"10/06", hasta:"15/07", clave:"diflufenican",
        mezcla:"Glifosato 1,5 kg + 2,4-D 1,0 L + Fluroxipir 0,3 L + Diflufenican 0,2 L"},
      {id:"girasol-2", nombre:"Barbecho intermedio", desde:"01/09", hasta:"25/09", clave:"sulfentrazone",
        mezcla:"ControlMax 1,5 + 2,4-D 0,8–1,0 L + Fluroxipir 0,3 L + Sulfentrazone 0,3 L"},
      {id:"girasol-3", nombre:"Presiembra / preemergencia", desde:"05/10", hasta:"25/10", clave:"flurocloridona + metolacloro | paraquat + sulfentrazone",
        mezcla:"Paraquat 2 L (o glifosato 1,5) + Flurocloridona 0,5 L + S-metolacloro 0,65–0,9 L (+ Ampligo 0,1 L si hay isoca). Variante sin flurocloridona: Paraquat 2 L + Sulfentrazone 0,25 L.",
        nota:"Hasta 72 h post siembra. Si el lote no recibió el paso 2, sumar sulfentrazone 0,2 L."},
    ]},
    {id:"soja1", nombre:"Soja de primera", aplicaA:"SOJA", siembraDesde:"25/10", siembraHasta:"30/11", pasos:[
      {id:"soja1-1", nombre:"Barbecho intermedio", desde:"10/09", hasta:"10/10", clave:"clorimuron",
        mezcla:"ControlMax 2 + 2,4-D 1,5 L + Dicamba 0,1 L + Clorimuron 75% 10 g (o clorimuron 25% 40–50 g)"},
      {id:"soja1-2", nombre:"Preemergencia", desde:"25/10", hasta:"15/11", clave:"flumioxazin + metolacloro | fierce | texaro",
        mezcla:"Glifosato 1,5 + Flumioxazin 0,15 L + S-metolacloro 0,9 L + Sulfentrazone 0,35 L (+ 2,4-D 0,3 L si hay nacidas). Variantes: Fierce RM 0,4 L · Texaro 36 g + Sulfentrazone 0,2 L.",
        nota:"Sin atrazina en ningún paso."},
    ]},
    {id:"soja2", nombre:"Soja de segunda", aplicaA:"*-SOJA, SOJA 2", siembraDesde:"01/12", siembraHasta:"10/01", pasos:[
      {id:"soja2-1", nombre:"A la siembra", desde:"10/12", hasta:"20/12", clave:"sulfentrazone + metolacloro | heat + metolacloro",
        mezcla:"Glifosato 1,7 + 2,4-D 0,3 L + Sulfentrazone 0,3 L + S-metolacloro 0,8 L. Alternativa: Heat 35 g + S-metolacloro 0,9 L.", hastaSiembra:true},
    ]},
    {id:"maiz1", nombre:"Maíz temprano", aplicaA:"MAIZ T", siembraDesde:"01/10", siembraHasta:"15/10", pasos:[
      {id:"maiz1-1", nombre:"Barbecho con atrazina", desde:"10/06", hasta:"25/09", clave:"atrazina",
        mezcla:"Junio: Glifosato 1,5 + 2,4-D 1,0 L + Dicamba 0,2 L + Atrazina 1 kg. Si no entró en junio, en septiembre: ControlMax 1,5–2 + 2,4-D 0,8–1,2 L + Dicamba 0,1–0,13 L + Atrazina 1 kg."},
      {id:"maiz1-2", nombre:"Preemergencia", desde:"01/10", hasta:"15/10", clave:"metolacloro + sulfentrazone | terbutilazina",
        mezcla:"ControlMax 1,2 + S-metolacloro 0,8 L + Sulfentrazone 0,3 L (+ carfentrazone 75 cc en cabeceras). Variante: Terbutilazina 1 L.",
        nota:"A la siembra (1–15 oct).", hastaSiembra:true},
    ]},
    {id:"maiz2", nombre:"Maíz tardío", aplicaA:"MAIZ, MAIZ 2, *-MAIZ", siembraDesde:"01/12", siembraHasta:"20/12", pasos:[
      {id:"maiz2-1", nombre:"Barbecho", desde:"15/09", hasta:"20/10", clave:"atrazina",
        mezcla:"Glifosato 1,5–2 + 2,4-D 0,5–1 L + Dicamba 0,2 L + Atrazina 1 kg"},
      {id:"maiz2-2", nombre:"Barbecho intermedio", desde:"10/11", hasta:"25/11", clave:"atrazina | sulfentrazone",
        mezcla:"Glifosato 1,8–2,2 + 2,4-D 0,5–0,8 L + Atrazina 0,5 kg o Sulfentrazone 0,2 L (+ Haloxifop 0,08 L si hay gramíneas)"},
      {id:"maiz2-3", nombre:"Preemergencia", desde:"25/11", hasta:"15/12", clave:"metolacloro | adengo | terbutilazina",
        mezcla:"A: S-metolacloro 1 L + Atrazina 1 kg + Sulfentrazone 0,2 L · B: Adengo 0,3 L + Terbutilazina 1–1,5 L", hastaSiembra:true},
      {id:"maiz2-4", nombre:"Post temprano (V2–V4)", desde:"20/12", hasta:"15/01", clave:"atrazina | laudis | brucia",
        mezcla:"Glifosato 1,7–2 + 2,4-D 0,3–0,5 L + Atrazina 1–1,5 kg · variantes Laudis 0,3 L o Brucia 90 cc + Atrazina 1 kg",
        nota:"Tope: no más de 2 kg de atrazina por lote en la campaña si el lote puede ir a soja la siguiente."},
    ]},
    {id:"sorgo", nombre:"Sorgo", aplicaA:"SORGO, *-SORGO", siembraDesde:"15/11", siembraHasta:"15/12", pasos:[
      {id:"sorgo-1", nombre:"Barbecho", desde:"20/09", hasta:"20/10", clave:"atrazina",
        mezcla:"ControlMax 2 + 2,4-D 1,2–1,3 L + Dicamba 0,1–0,13 L + Atrazina 1 kg"},
      {id:"sorgo-2", nombre:"Preemergencia", desde:"15/11", hasta:"15/12", clave:"metolacloro",
        mezcla:"S-metolacloro 0,8 L + Atrazina 0,5 kg",
        nota:"A la siembra, sólo con semilla curada con protector (Concep).", hastaSiembra:true},
    ]},
    {id:"fina", nombre:"Fina (cebada / trigo)", aplicaA:"CEBADA, TRIGO, CEBADA-*, TRIGO-*", siembraDesde:"01/05", siembraHasta:"15/07", pasos:[
      {id:"fina-1", nombre:"Presiembra de otoño", desde:"15/05", hasta:"31/05", clave:"flurocloridona",
        mezcla:"Glifosato 1–2 + 2,4-D 0,5–0,8 L + Flurocloridona 1 L"},
    ]},
    {id:"cobertura", nombre:"Coberturas (vicia + triticale)", aplicaA:"", siembraDesde:"01/05", siembraHasta:"31/05", pasos:[
      {id:"cobertura-1", nombre:"Presiembra", desde:"20/04", hasta:"30/04", clave:"terbutilazina",
        mezcla:"Glifosato 1,5 + Terbutilazina 2 L"},
    ]},
    {id:"pastura", nombre:"Pasturas / alfalfa (implantación)", aplicaA:"", siembraDesde:"01/03", siembraHasta:"30/04", pasos:[
      {id:"pastura-1", nombre:"Presiembra", desde:"01/03", hasta:"30/04", clave:"flumetsulam",
        mezcla:"Glifosato 1,7–1,8 + 2,4-D 0,5 L + Flumetsulam 0,25–0,3 L"},
    ]},
  ],
};

// Nombres comerciales con los que cada activo aparece en la planilla
const SINONIMOS_ACTIVO = {
  "metolacloro": ["metolaclor", "dual"],
  "s-metolacloro": ["metolaclor", "dual"],
  "atrazina": ["atrazina", "gesaprim"],
  "diflufenican": ["diflufenican", "brodal"],
  "flurocloridona": ["flurocloridona", "rainbow", "racer"],
  "sulfentrazone": ["sulfentrazone", "capaz", "authority"],
  "flumioxazin": ["flumioxazin", "sumisoya", "flumyzin"],
  "clorimuron": ["clorimuron", "classic"],
  "terbutilazina": ["terbutilazina", "terbyne"],
  "paraquat": ["paraquat", "gramoxone"],
  "heat": ["heat", "saflufenacil"],
  "flumetsulam": ["flumetsulam", "flumetsulan"],
  "laudis": ["laudis", "tembotrione"],
  "carfentrazone": ["carfentrazone", "shark"],
  "acetoclor": ["acetoclor", "harness"],
  "imazetapir": ["imazetapir", "pivot"],
  "picloram": ["picloram", "tordon"],
};
// Activos que dejan residual en el suelo: son los que se listan en la ficha de cada lote.
// Se suman los activos clave del protocolo, menos los que son sólo de contacto o post.
const RESIDUALES = ["atrazina","terbutilazina","diflufenican","sulfentrazone","flurocloridona","metolacloro",
  "acetoclor","flumioxazin","clorimuron","metsulfuron","imazetapir","flumetsulam","picloram","adengo","fierce","texaro"];
const NO_RESIDUALES = ["paraquat","heat","carfentrazone","laudis","brucia","glifosato"];
const nombreActivo = t => t === "metolacloro" || t === "s-metolacloro" ? "S-metolacloro" : t.charAt(0).toUpperCase() + t.slice(1);
// Tipo de labor: siembra | fertilizacion | labranza | pulverizacion.
// Sale de la labor anotada; si no viene, de los productos (semilla = siembra, sólo fertilizante = fertilización).
const LABOR_SIEMBRA = /^(SIEMBRA|SG\b|MZ PP|SJ PP|GR PP|SJ 2DA|MZ FERT|GR FERT|SJ FERT|FINA FERT)/i;
const LABOR_FERTILIZACION = /^(VOLEADA|INCORPORADA)/i;
const LABOR_LABRANZA = /^(PARATIL|RASTRA|ROLOS)/i;
const catProducto = n => (PRODUCTOS_BASE.find(p => normBusca(p.n) === normBusca(n)) || {}).cat || null;
const clasificarLabor = (labor, productos = []) => {
  const l = String(labor || "");
  if(LABOR_SIEMBRA.test(l) || productos.some(n => catProducto(n) === "SEM")) return "siembra";
  if(LABOR_FERTILIZACION.test(l)) return "fertilizacion";
  if(LABOR_LABRANZA.test(l)) return "labranza";
  if(!l && productos.length && productos.every(n => catProducto(n) === "FERT")) return "fertilizacion";
  return "pulverizacion";
};
const esPulverizacion = a => clasificarLabor(a.labor, a.productos) === "pulverizacion";
const TIPO_LABOR = {
  siembra:       {txt:"Siembra",       color:"#7A4E12", fondo:"#F6EAD7"},
  pulverizacion: {txt:"Pulverización", color:"#2E7D32", fondo:"#EEF5E6"},
  fertilizacion: {txt:"Fertilización", color:"#0D47A1", fondo:"#E3F2FD"},
  labranza:      {txt:"Labranza",      color:"#5D4037", fondo:"#EFEBE9"},
};
const DIA_MS = 86400000;
// Días que dura cada residual en el suelo (aproximado; se ajusta en la pestaña Protocolo)
const DURACION_RESIDUAL = {atrazina:60, terbutilazina:60, diflufenican:80, sulfentrazone:75, flurocloridona:60, metolacloro:50,
  acetoclor:45, flumioxazin:40, clorimuron:45, metsulfuron:60, imazetapir:45, flumetsulam:60, picloram:90, adengo:60, fierce:60, texaro:60};
// Activación: el residual carga si llueven N mm dentro de los días siguientes a la aplicación
const ACTIVACION_BASE = {mm:10, dias:15};
// Tope de atrazina por lote en la campaña (protocolo: si el lote puede ir a soja la siguiente)
const TOPE_ATRAZINA_KG = 2;

// "flurocloridona + metolacloro | paraquat + sulfentrazone" → [["flurocloridona","metolacloro"],["paraquat","sulfentrazone"]]
const parseClave = clave => String(clave||"").split(/\||\bo\b/i)
  .map(alt => alt.split("+").map(t => normBusca(t).trim()).filter(Boolean))
  .filter(alt => alt.length);

const productoEs = (nombre, termino) => {
  const variantes = SINONIMOS_ACTIVO[termino] || [termino.replace(/^s-/, "")];
  const n = normBusca(nombre);
  return variantes.some(v => n.includes(v));
};
// Qué activos (de una lista) lleva una aplicación
const activosDe = (apl, terminos) => terminos.filter(t => (apl.productos||[]).some(p => productoEs(p, t)));

// Unidad de la dosis: la del catálogo si el producto está; si no, se deduce del nombre (o va sin unidad)
const unidadProducto = n => {
  const k = normBusca(n);
  const cat = PRODUCTOS_BASE.find(p => normBusca(p.n) === k);
  if(cat && cat.u) return cat.u;
  if(/\b(kg|kgs|grs?|granulad[oa]|solid[oa]|wg|wdg)\b/i.test(n)) return "kg";
  if(/\b(lt|lts|litros?)\b/i.test(n)) return "L";
  return "";
};
// Los residuales sólidos van en kg aunque el catálogo diga otra cosa
const UNIDAD_ACTIVO = {atrazina:"kg", clorimuron:"kg", metsulfuron:"kg", texaro:"kg"};
const fmtDosis = (d, n, activo) => {
  if(d == null) return "";
  let u = UNIDAD_ACTIVO[activo] || unidadProducto(n);
  // Las semillas propias figuran en kg en el catálogo pero en la planilla se cargan en toneladas (0,09 = 90 kg/ha)
  if(u === "kg" && d < 2 && catProducto(n) === "SEM") u = "tn";
  return `${Number(d).toLocaleString("es-AR",{maximumFractionDigits:3})}${u ? " " + u : ""}`;
};

// "26-27" + "10/06" → 10 jun 2026; enero y febrero caen en el segundo año
const fechaDelPaso = (ddmm, campania) => {
  const m = String(ddmm||"").match(/^(\d{1,2})\/(\d{1,2})$/);
  if(!m) return null;
  const y1 = 2000 + (parseInt(String(campania||"").split("-")[0], 10) || 26);
  const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10);
  return new Date(mes >= 3 ? y1 : y1 + 1, mes - 1, dia);
};

const normCultivo = cv => normBusca(cv).toUpperCase().replace(/\s+/g, " ").trim();
const cultivoCoincide = (aplicaA, cv) => {
  const c = normCultivo(cv);
  if(!c) return false;
  return String(aplicaA||"").split(",").map(p => normCultivo(p)).filter(Boolean).some(p => {
    const re = new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return re.test(c);
  });
};

// La planilla a veces anota una parte del lote: "26 sin cabecera", "24 SECTOR 2", "7 FRANJA MAIZ".
// Si no coincide tal cual, se prueba sin el agregado y se marca como parte del lote.
const sinAgregadoLote = ref => String(ref||"").replace(/\s+(SIN\s+CABECERAS?|CABECERAS?|SECTOR\b.*|FRANJA\b.*|PARC\w*\b.*)$/i, "").trim();
const loteDeAplicacion = (ref, loteId) => refApuntaALote(ref, loteId) ? "entero"
  : (sinAgregadoLote(ref) !== String(ref||"").trim() && refApuntaALote(sinAgregadoLote(ref), loteId)) ? "parte" : null;

const ddmm = d => d ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}` : "—";

// Cruza el protocolo con las labores de la planilla, lote por lote.
// Un paso está hecho cuando, entre las aplicaciones del lote cerca de su ventana, ya están todos
// los activos de alguna de sus alternativas (pueden venir en pasadas distintas).
// Estado de cada paso: hecho | parcial (menos del 80% de las ha) | ventana | atrasado (cerró hace
// 30 días o menos y no abrió el siguiente) | siembra (se hace a la siembra) | salteado | proximo
function evaluarProtocolo(protocolo, campos, cultivoDe, aplicaciones, hoy, incluirSinProtocolo = false, lluvias = []){
  const resultado = [];
  const porCampo = {};
  aplicaciones.forEach(a => { (porCampo[a.campo] = porCampo[a.campo] || []).push(a); });
  const lluviasPorCampo = {};
  lluvias.forEach(l => { const f = fechaLocal(l.fecha); if(f) (lluviasPorCampo[l.campo] = lluviasPorCampo[l.campo] || []).push({f, mm:Number(l.mm)||0}); });
  const dur = {...DURACION_RESIDUAL, ...(protocolo.duraciones || {})};
  const actP = protocolo.activacion || {};
  const act = {mm: Number(actP.mm) >= 0 && actP.mm !== "" ? Number(actP.mm) : ACTIVACION_BASE.mm, dias: Number(actP.dias) || ACTIVACION_BASE.dias};
  const iniCampania = fechaDelPaso("01/03", protocolo.campania);
  const terminosProtocolo = (protocolo.cultivos||[]).flatMap(c => (c.pasos||[]).flatMap(p => parseClave(p.clave).flat()));
  const residuales = [...new Set([...RESIDUALES, ...terminosProtocolo])].filter(t => !NO_RESIDUALES.includes(t));

  campos.forEach(campo => campo.lotes.forEach(lote => {
    const cv = cultivoDe(campo.id, lote.id);
    const protos = (protocolo.cultivos||[]).filter(p => cultivoCoincide(p.aplicaA, cv));
    if(!protos.length && !incluirSinProtocolo) return;
    const haLote = Number(lote.ha) || 0;
    const apls = (porCampo[campo.id] || []).map(a => ({a, m: loteDeAplicacion(a.lote, lote.id)}))
      .filter(x => x.m).map(x => x.m === "parte" ? {...x.a, parte:true} : x.a)
      .filter(a => { const f = fechaLocal(a.fecha); return f && (!iniCampania || f >= iniCampania); })
      .sort((x, y) => fechaLocal(y.fecha) - fechaLocal(x.fecha));

    const porDia = {};
    apls.forEach(a => (a.items || []).forEach(it => {
      if(it.d != null && productoEs(it.n, "atrazina")) porDia[a.fecha] = Math.max(porDia[a.fecha] || 0, it.d);
    }));
    const atrazinaKg = Object.values(porDia).reduce((s, d) => s + d, 0);
    const topeAtrazina = atrazinaKg >= TOPE_ATRAZINA_KG;

    const evals = protos.map(prot => {
      const pasos = (prot.pasos||[]).map(p => {
        const alts = parseClave(p.clave);
        return {...p, alts, terminos:[...new Set(alts.flat())],
          ini: fechaDelPaso(p.desde, protocolo.campania), fin: fechaDelPaso(p.hasta, protocolo.campania)};
      }).filter(p => p.ini && p.fin).sort((a,b) => a.ini - b.ini);
      // Siembra: la registrada cerca de la ventana de siembra del cultivo (protocolos guardados
      // antes de que existiera la ventana usan la del protocolo original)
      const orig = (PROTOCOLO_BASE.cultivos.find(c => c.id === prot.id) || {});
      const sDesde = prot.siembraDesde ?? orig.siembraDesde, sHasta = prot.siembraHasta ?? orig.siembraHasta;
      const sIni = fechaDelPaso(sDesde, protocolo.campania), sFin = fechaDelPaso(sHasta, protocolo.campania);
      let siembra = null;
      if(sIni && sFin){
        const hecha = apls.find(a => { const f = fechaLocal(a.fecha);
          return clasificarLabor(a.labor, a.productos) === "siembra" && f >= sIni - 45*DIA_MS && f <= sFin.getTime() + 60*DIA_MS; });
        siembra = hecha ? {estado:"hecho", apl:hecha, fecha:fechaLocal(hecha.fecha)}
          : hoy < sIni ? {estado:"proximo", dias:Math.ceil((sIni - hoy)/DIA_MS)}
          : hoy <= sFin ? {estado:"ventana", dias:Math.ceil((sFin - hoy)/DIA_MS)}
          : (hoy - sFin) <= 30*DIA_MS ? {estado:"atrasado", dias:Math.floor((hoy - sFin)/DIA_MS)}
          : {estado:"sinregistro"};   // ventana vieja: seguramente se sembró y no quedó en la planilla
        siembra.desde = sDesde; siembra.hasta = sHasta;
      }
      // Cada aplicación cuenta para el paso cuya ventana le queda más cerca (entre los que lleva algún activo)
      const asignadas = pasos.map(() => []);
      apls.forEach(a => {
        const f = fechaLocal(a.fecha);
        let mejor = Infinity, idxs = [];
        pasos.forEach((p, i) => {
          if(f < p.ini - 30*DIA_MS || f > p.fin.getTime() + 60*DIA_MS) return;
          if(!activosDe(a, p.terminos).length) return;
          const dist = f < p.ini ? p.ini - f : f > p.fin ? f - p.fin : 0;
          if(dist < mejor){ mejor = dist; idxs = [i]; } else if(dist === mejor) idxs.push(i);
        });
        idxs.forEach(i => asignadas[i].push(a));
      });
      const estados = pasos.map((p, i) => {
        const hechos = new Set(asignadas[i].flatMap(a => activosDe(a, p.terminos)));
        // Lo que falta: si ya se empezó alguna alternativa, la que tiene menos pendiente; si no, la principal.
        // Con el tope de atrazina alcanzado se descartan las alternativas que llevan atrazina (si hay otra).
        const faltaDe = alt => alt.filter(t => !hechos.has(t));
        let candidatas = p.alts;
        const sinAtrazina = candidatas.filter(alt => !alt.includes("atrazina"));
        const porTope = topeAtrazina && sinAtrazina.length > 0 && sinAtrazina.length < candidatas.length;
        if(porTope) candidatas = sinAtrazina;
        // (un quemante como el paraquat no cuenta como avance: no define con qué residual seguir)
        const conAvance = candidatas.filter(alt => alt.some(t => hechos.has(t) && !NO_RESIDUALES.includes(t)));
        const elegida = (conAvance.length ? conAvance : candidatas.slice(0, 1))
          .reduce((m, alt) => faltaDe(alt).length < faltaDe(m).length ? alt : m, (conAvance[0] || candidatas[0] || []));
        const completa = p.alts.find(alt => alt.length && !faltaDe(alt).length);
        // Si de esa alternativa sólo falta un quemante (ej. paraquat), lo que hay que aplicar es la mezcla principal
        const faltaResidual = faltaDe(elegida).some(t => !NO_RESIDUALES.includes(t));
        const faltan = completa ? [] : faltaResidual ? faltaDe(elegida) : faltaDe(candidatas[0] || []);
        const base = {paso:p, apls:asignadas[i], faltan, porTope};
        if(completa){
          const alt = completa;
          const haHecha = Math.min(...alt.map(t => asignadas[i].filter(a => activosDe(a, [t]).length)
            .reduce((s, a) => s + (Number(a.ha) || haLote), 0)));
          const parcial = haLote > 0 && haHecha < 0.8 * haLote;
          const vigente = hoy <= p.fin.getTime() + 30*DIA_MS || p.hastaSiembra;
          return {...base, estado: parcial && vigente ? "parcial" : "hecho", haHecha, alt};
        }
        // Lo que va a la siembra y no se hizo: si ya se sembró (hace más de 3 días), quedó atrasado
        if(p.hastaSiembra && siembra && siembra.estado === "hecho" && hoy - siembra.fecha > 3*DIA_MS)
          return {...base, estado:"atrasado", dias:Math.floor((hoy - siembra.fecha)/DIA_MS), postSiembra:siembra.fecha};
        if(hoy < p.ini) return {...base, estado:"proximo", dias:Math.ceil((p.ini - hoy)/DIA_MS)};
        if(hoy <= p.fin) return {...base, estado:"ventana", dias:Math.ceil((p.fin - hoy)/DIA_MS)};
        const dias = Math.floor((hoy - p.fin)/DIA_MS);
        const yaSiguio = pasos.slice(i+1).some((q, j) => hoy >= q.ini || asignadas[i+1+j].length);
        if(yaSiguio) return {...base, estado:"salteado", dias};
        if(p.hastaSiembra) return {...base, estado: dias <= 120 ? "siembra" : "salteado", dias};
        return {...base, estado: dias <= 30 ? "atrasado" : "salteado", dias};
      });
      // Lo que viene: pasos sin hacer cuya ventana no cerró (o que van a la siembra y el lote no se
      // sembró). Lo que ya pasó no se reclama: el protocolo se mira siempre para adelante.
      const sembrado = siembra && siembra.estado === "hecho";
      const proximo = estados.find(s => s.estado !== "hecho" && !s.postSiembra &&
        (s.paso.fin >= hoy || (s.paso.hastaSiembra && !sembrado))) || null;
      return {prot, estados, siembra, proximo};
    });

    // Residuales que ya recibió el lote en la campaña, con dosis y fecha (de la más vieja a la última)
    const aplicados = [];
    [...apls].reverse().forEach(a => (a.items || (a.productos||[]).map(n => ({n, d:null}))).forEach(it => {
      const act = residuales.find(t => productoEs(it.n, t));
      if(act) aplicados.push({activo:act, n:it.n, d:it.d, fecha:a.fecha, parte:a.parte, ref:a.lote, ha:a.ha});
    }));
    const ultima = apls.find(esPulverizacion) || null;
    const ultimaResiduales = ultima ? (ultima.items || (ultima.productos||[]).map(n => ({n, d:null})))
      .map(it => ({...it, activo: residuales.find(t => productoEs(it.n, t))})).filter(it => it.activo) : [];
    // ── Cobertura: cada pasada con residual cubre hasta fecha + duración del activo que más dura,
    // siempre que haya llovido para activarlo (si hay registro de lluvias de ese campo) ──
    const lluCampo = lluviasPorCampo[campo.id] || [];
    const desdeLluvias = lluCampo.length ? Math.min(...lluCampo.map(l => l.f.getTime())) : null;
    const pasadas = [];
    aplicados.forEach(r => {
      let g = pasadas.find(x => x.fecha === r.fecha);
      if(!g){ g = {fecha:r.fecha, f:fechaLocal(r.fecha), activos:[]}; pasadas.push(g); }
      if(!g.activos.includes(r.activo)) g.activos.push(r.activo);
    });
    pasadas.forEach(g => {
      g.hasta = new Date(Math.max(...g.activos.map(a => g.f.getTime() + (Number(dur[a]) || DURACION_RESIDUAL[a] || 45) * DIA_MS)));
      g.mm = lluCampo.filter(l => l.f >= g.f && l.f - g.f <= act.dias * DIA_MS).reduce((s, l) => s + l.mm, 0);
      g.activacion = desdeLluvias == null || g.f < desdeLluvias ? "sindato"
        : g.mm >= act.mm ? "activado" : (hoy - g.f) <= act.dias * DIA_MS ? "esperando" : "noactivado";
    });
    const vigentes = pasadas.filter(g => g.hasta >= hoy && g.activacion !== "noactivado");
    const cobertura = {hasta: vigentes.length ? new Date(Math.max(...vigentes.map(g => g.hasta))) : null,
      vigentes, ultima: pasadas[pasadas.length - 1] || null, esperandoLluvia: vigentes.some(g => g.activacion === "esperando")};

    // ── Estado mirando para adelante: ¿tiene residual hoy? ¿le toca el próximo? ──
    const proximos = evals.filter(ev => ev.proximo).map(ev => ({...ev.proximo, prot:ev.prot}));
    const cubierto = !!cobertura.hasta;
    const tocaYa = proximos.some(p => hoy >= p.paso.ini);
    const pronto = proximos.some(p => p.paso.ini - hoy <= 15 * DIA_MS);
    const estado = !evals.length ? "sinprot"
      : tocaYa && !cubierto ? "rojo"
      : tocaYa || cobertura.esperandoLluvia || (!cubierto && pronto) || (cubierto && proximos.length && cobertura.hasta - hoy <= 15 * DIA_MS) ? "amarillo"
      : "verde";
    resultado.push({campo, lote, cv, evals, aplicados, ultima, ultimaResiduales, atrazinaKg, topeAtrazina, cobertura, proximos, estado});
  }));
  return resultado;
}

// Estado del lote mirando para adelante
const ESTADO_LOTE = {
  rojo:     {txt:"Necesita residual",  icono:"🔴", color:"#C0392B", fondo:"#FBE3E0", mapa:"#E8857B"},
  amarillo: {txt:"Atención",           icono:"🟡", color:"#8A6200", fondo:"#FFF6DD", mapa:"#F2CF6B"},
  verde:    {txt:"Al día",             icono:"🟢", color:"#2E7D32", fondo:"#E8F5E9", mapa:"#9FD3A3"},
  sinprot:  {txt:"Sin protocolo",      icono:"⚪", color:"#8C8572", fondo:"#F1EEE6", mapa:"#F0EDE5"},
};
const ORDEN_LOTE = ["rojo","amarillo","verde","sinprot"];
const ABREV_ACTIVO = {atrazina:"Atrazina", metolacloro:"S-meto", "s-metolacloro":"S-meto", flurocloridona:"Fluroc.", sulfentrazone:"Sulfen.",
  diflufenican:"Diflu.", flumioxazin:"Flumiox.", clorimuron:"Clorim.", terbutilazina:"Terbu.", metsulfuron:"Metsulf.",
  imazetapir:"Imazet.", flumetsulam:"Flumets.", acetoclor:"Acetoc."};
const listaActivos = acts => acts.map(nombreActivo).join(" + ");
// Qué falta del próximo paso (si ya tiene parte, sólo lo que falta; si no, la mezcla principal)
const queAplicar = p => p.faltan.length ? p.faltan : (p.alt || p.paso.alts[0] || []);
// Texto de cuándo toca el próximo residual
const cuandoToca = (p, hoy) => hoy < p.paso.ini ? `desde el ${p.paso.desde} (en ${Math.ceil((p.paso.ini - hoy)/DIA_MS)} días)`
  : hoy <= p.paso.fin ? `ahora · hasta el ${p.paso.hasta} (quedan ${Math.ceil((p.paso.fin - hoy)/DIA_MS)} días)`
  : "a la siembra";
// Cartel corto del estado del lote
const cartelLote = (e, hoy) => {
  const c = e.cobertura.hasta, p = e.proximos[0];
  const enDias = p ? Math.ceil((p.paso.ini - hoy) / DIA_MS) : null;
  if(e.estado === "rojo") return "Sin residual · le toca ahora";
  if(e.estado === "amarillo") return c ? (p && enDias <= 0 ? `Cubierto hasta ${ddmm(c)} · toca el próximo` : e.cobertura.esperandoLluvia ? "Esperando lluvia" : `Vence ~${ddmm(c)}`)
    : p ? `Sin residual · el próximo en ${enDias} días` : "Atención";
  if(e.estado === "verde") return c ? `Cubierto hasta ${ddmm(c)}` : p ? `Sin residual · el próximo en ${enDias} días` : "Nada por aplicar";
  return ESTADO_LOTE[e.estado].txt;
};
// Texto de la cobertura actual
const textoCobertura = e => {
  const c = e.cobertura;
  const lluvia = g => g.activacion === "activado" ? ` · ${fmt(g.mm)} mm de lluvia` : g.activacion === "esperando" ? ` · esperando lluvia (${fmt(g.mm)} mm)` : "";
  if(c.hasta){
    const g = c.vigentes.reduce((m, x) => x.hasta > m.hasta ? x : m);
    return {ok:true, txt:`hasta ~${ddmm(c.hasta)} — ${listaActivos(g.activos)} del ${ddmm(g.f)}${lluvia(g)}`};
  }
  if(!c.ultima) return {ok:false, txt:"sin residual en la campaña"};
  const g = c.ultima;
  return {ok:false, txt:`sin residual activo — el último (${listaActivos(g.activos)} del ${ddmm(g.f)}) ${g.activacion === "noactivado" ? `no se activó: ${fmt(g.mm)} mm en ${ACTIVACION_BASE.dias} días` : `venció ~${ddmm(g.hasta)}`}`};
};

// Para la capa "Residuales" del mapa: estado del lote y último residual
function residualesParaMapa(protocolo, campos, cultivoDe, aplicaciones, hoy, lluvias){
  const out = {};
  evaluarProtocolo(protocolo, campos, cultivoDe, aplicaciones, hoy, true, lluvias).forEach(e => {
    const ult = e.aplicados.length ? e.aplicados[e.aplicados.length - 1].fecha : null;
    const activos = ult ? [...new Set(e.aplicados.filter(r => r.fecha === ult).map(r => r.activo))] : [];
    const cob = textoCobertura(e);
    const prox = e.proximos[0];
    out[`${e.campo.id}|${e.lote.id}`] = {
      estado: e.estado,
      corto: activos.length ? activos.map(a => ABREV_ACTIVO[a] || nombreActivo(a)).join(" + ") : "sin residual",
      fecha: ult ? ddmm(fechaLocal(ult)) : "",
      tip: `${cob.ok ? "Cubierto " : ""}${cob.txt}${prox ? ` · próximo: ${listaActivos(queAplicar(prox))} ${cuandoToca(prox, hoy)}` : ""}`,
    };
  });
  return out;
}

const cajaV = {background:CREMA,border:`1.5px solid ${TINTA}`,borderRadius:12,padding:"14px 16px"};
const chipV = a => ({padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer",borderRadius:20,
  border:`1.5px solid ${TINTA}`,background:a?TINTA:"transparent",color:a?CREMA:TINTA,fontFamily:"inherit"});
const selectV = {padding:"8px 11px",fontSize:13.5,fontWeight:600,border:`1.5px solid ${TINTA}`,borderRadius:8,background:CREMA,color:TINTA,fontFamily:"inherit"};
const nombreCampo = id => (CAMPOS.find(c => c.id === id) || {}).nombre || id;


// Producto y dosis sugeridos para un activo (para "Armar orden"): el producto que más se usó en la planilla
// (si nunca se usó, el primero del catálogo con ese activo) y la dosis de la mezcla del protocolo para ese paso
// (si la mezcla no la dice, la última que se usó de ese producto).
function sugerirProducto(activo, mezcla, registro, catalogo){
  const usos = {};
  (registro || []).forEach(a => (a.items || []).forEach(it => {
    if(!productoEs(it.n, activo)) return;
    const u = usos[it.n] = usos[it.n] || {n:it.n, veces:0, d:null, fecha:""};
    u.veces++;
    if(it.d != null && String(a.fecha) >= u.fecha){ u.d = it.d; u.fecha = String(a.fecha); }
  }));
  const usado = Object.values(usos).sort((a, b) => b.veces - a.veces)[0];
  const cat = usado ? catalogo.find(p => normBusca(p.n) === normBusca(usado.n)) : catalogo.find(p => p.cat === "HER" && productoEs(p.n, activo));
  let d = null;
  {
    // dosis de la mezcla: el primer número después del activo que no sea un porcentaje ("Clorimuron 75% 10 g" → 10 g)
    const variantes = SINONIMOS_ACTIVO[activo] || [activo];
    const texto = normBusca(mezcla);
    for(const v of variantes){
      const m = texto.match(new RegExp(`${v}[^0-9]*(?:\\d+(?:[.,]\\d+)?\\s*%\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(l|kg|g|cc)?\\b`));
      if(m){ d = parseFloat(m[1].replace(",", ".")); if(m[2] === "g" || m[2] === "cc") d = d / 1000; break; }
    }
  }
  if(d == null && usado) d = usado.d;
  const n = usado ? usado.n : cat ? cat.n : nombreActivo(activo);
  return {n, d, u: cat?.u || unidadProducto(n) || UNIDAD_ACTIVO[activo] || "L", p: cat?.p || 0, prov: cat?.prov || "", activo, enCatalogo: !!cat};
}

// ============================================================
// LABORES PENDIENTES — por lote y para adelante: ¿tiene residual hoy? ¿con qué tengo que ir?
// ============================================================
function VistaPendientes({protocolo, cultivoDe, aplicaciones, conDosis, fechaDatos, onEditar, monitoreos, lluvias, catalogo, onArmarOrden}){
  const [campoF, setCampoF] = useState("TODOS");
  const [protF, setProtF] = useState("TODOS");
  const [estadoF, setEstadoF] = useState("TODOS");
  const hoy = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const fichas = useMemo(() => evaluarProtocolo(protocolo, CAMPOS, cultivoDe, aplicaciones, hoy, false, lluvias),
    [protocolo, aplicaciones, cultivoDe, hoy, lluvias]);
  const paraSembrar = f => f.evals.some(ev => ev.siembra && ["ventana","atrasado"].includes(ev.siembra.estado));
  const base = fichas.filter(f => (campoF === "TODOS" || f.campo.id === campoF) && (protF === "TODOS" || f.evals.some(ev => ev.prot.id === protF)));
  const filtradas = base.filter(f => estadoF === "TODOS" || (estadoF === "sembrar" ? paraSembrar(f) : f.estado === estadoF))
    .sort((a, b) => ORDEN_LOTE.indexOf(a.estado) - ORDEN_LOTE.indexOf(b.estado)
      || a.campo.nombre.localeCompare(b.campo.nombre) || String(a.lote.id).localeCompare(String(b.lote.id), "es", {numeric:true}));
  const tiles = [
    {est:"rojo", txt:"Sin residual y le toca ahora"},
    {est:"amarillo", txt:"Atención: toca o vence pronto"},
    {est:"verde", txt:"Cubiertos o nada por aplicar"},
    {est:"sembrar", txt:"🌱 Falta sembrar", color:"#7A4E12", fondo:"#F6EAD7"},
  ].map(t => ({...ESTADO_LOTE[t.est], ...t, lotes: t.est === "sembrar" ? base.filter(paraSembrar) : base.filter(f => f.estado === t.est)}));
  const camposCon = [...new Set(fichas.map(e => e.campo.id))];
  const fFecha = s => { const d = fechaLocal(s); return d ? ddmm(d) : s; };
  const linkBtn = {border:"none",background:"none",padding:0,color:"#1E5FA8",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <select value={campoF} onChange={e=>setCampoF(e.target.value)} style={selectV}>
          <option value="TODOS">Todos los campos</option>
          {camposCon.map(c => <option key={c} value={c}>{nombreCampo(c)}</option>)}
        </select>
        <select value={protF} onChange={e=>setProtF(e.target.value)} style={selectV}>
          <option value="TODOS">Todos los cultivos</option>
          {(protocolo.cultivos||[]).filter(p => fichas.some(e => e.evals.some(ev => ev.prot.id === p.id))).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <div style={{fontSize:12,opacity:0.65,flex:"1 1 260px"}}>
          Labores de la planilla{fechaDatos ? ` al ${fechaDatos}` : ""}. Hoy: {ddmm(hoy)}. Se mira para adelante: lo que ya pasó no se reclama.
          {!conDosis && " Las dosis aparecen cuando el pipeline publique el registro de labores."}{" "}
          <button onClick={onEditar} style={linkBtn}>Editar protocolo</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        {tiles.map(t => { const activo = estadoF === t.est; return (
          <button key={t.est} onClick={()=>setEstadoF(activo ? "TODOS" : t.est)}
            style={{...cajaV,textAlign:"center",borderColor:t.color,background:t.fondo,cursor:"pointer",fontFamily:"inherit",color:TINTA,
              boxShadow:activo?`inset 0 0 0 2px ${t.color}`:"none",padding:"10px 8px"}}>
            <div style={{fontSize:21,fontWeight:700,color:t.color}}>{t.lotes.length} <span style={{fontSize:12.5}}>lotes</span></div>
            <div style={{fontSize:11.5,opacity:0.8,marginTop:2}}>{t.icono && t.est !== "sembrar" ? `${t.icono} ` : ""}{t.txt} · {fmt(t.lotes.reduce((s,f)=>s+(Number(f.lote.ha)||0),0))} ha</div>
          </button>
        );})}
      </div>
      {estadoF !== "TODOS" && <div style={{fontSize:12,opacity:0.7}}>Filtrado por "{tiles.find(t => t.est === estadoF)?.txt}". <button onClick={()=>setEstadoF("TODOS")} style={linkBtn}>Ver todos</button></div>}

      {!filtradas.length && <div style={{...cajaV,textAlign:"center",opacity:0.7}}>No hay lotes con estos filtros.</div>}
      {filtradas.map(f => {
        const st = ESTADO_LOTE[f.estado];
        const cob = textoCobertura(f);
        const porActivo = [];
        f.aplicados.forEach(r => {
          let g = porActivo.find(x => x.activo === r.activo);
          if(!g){ g = {activo:r.activo, items:[]}; porActivo.push(g); }
          const mismoDia = g.items.find(x => x.fecha === r.fecha);
          if(mismoDia){ if(r.d != null && (mismoDia.d == null || r.d > mismoDia.d)) mismoDia.d = r.d; mismoDia.parte = mismoDia.parte && r.parte; mismoDia.ref += ` + ${r.ref}`; }
          else g.items.push({...r});
        });
        const m = ultimoMonitoreo(monitoreos, f.campo.id, f.lote.id);
        return (
          <div key={`${f.campo.id}|${f.lote.id}`} style={{...cajaV,borderLeft:`6px solid ${st.color}`,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <span style={{fontSize:15.5,fontWeight:700}}>{f.campo.nombre} · Lote {f.lote.label||f.lote.id}</span>
                <span style={{fontSize:12,opacity:0.7}}>{fmt(Number(f.lote.ha)||0)} ha</span>
                <span style={{fontSize:11.5,display:"inline-flex",alignItems:"center",gap:4,border:"1px solid #C8C2B0",borderRadius:6,padding:"1px 7px",background:"#fff"}}>
                  <span style={{width:8,height:8,borderRadius:2,background:colorCv(f.cv)}}/>{f.cv}
                </span>
                <span style={{fontSize:11.5,opacity:0.6}}>{f.evals.map(ev => ev.prot.nombre).join(" + ")}</span>
              </div>
              <span style={{fontSize:10.5,fontWeight:700,color:st.color,background:st.fondo,border:`1px solid ${st.color}55`,borderRadius:5,padding:"2px 8px",textTransform:"uppercase"}}>{st.icono} {cartelLote(f, hoy)}</span>
            </div>

            <div style={{fontSize:13,marginTop:8}}>
              <b>🛡 Residual hoy:</b> <span style={{color:cob.ok?"#2E7D32":"#C0392B",fontWeight:600}}>{cob.ok ? "cubierto " : ""}{cob.txt}</span>
            </div>

            <div style={{fontSize:13,marginTop:6}}>
              <b>➡️ Próximo residual:</b>{" "}
              {!f.proximos.length && <span style={{opacity:0.7}}>nada previsto en el protocolo</span>}
              {f.proximos.map(p => {
                const toca = hoy >= p.paso.ini;
                return (
                  <div key={p.prot.id + p.paso.id} style={{marginTop:3,paddingLeft:8}}>
                    <span style={{fontWeight:700,color:toca?(f.cobertura.hasta?"#8A6200":"#C0392B"):TINTA}}>{listaActivos(queAplicar(p))}</span>
                    <span style={{opacity:0.8}}> · {cuandoToca(p, hoy)}</span>
                    <span style={{fontSize:11.5,opacity:0.55}}> · {f.evals.length > 1 ? `${p.prot.nombre}, ` : ""}{p.paso.nombre.toLowerCase()}</span>
                    {p.porTope && <span style={{fontSize:11.5,color:"#C0392B",fontWeight:600}}> · sin más atrazina: ya lleva {fmtDosis(f.atrazinaKg, "", "atrazina")} (tope {TOPE_ATRAZINA_KG} kg)</span>}
                    {p.estado === "parcial" && <span style={{fontSize:11.5,color:"#6D5BA8",fontWeight:600}}> · hecho en {fmt(p.haHecha)} de {fmt(Number(f.lote.ha)||0)} ha, completar</span>}
                    {p.paso.mezcla && <div style={{fontSize:11.5,opacity:0.7}}>Mezcla: {p.paso.mezcla}</div>}
                    {onArmarOrden && <button onClick={()=>onArmarOrden(f, p)} style={{...linkBtn,marginTop:3}}>🚜 Armar orden con este lote</button>}
                  </div>
                );
              })}
            </div>

            {f.evals.filter(ev => ev.siembra).map(ev => {
              const sb = ev.siembra;
              const items = sb.apl ? (sb.apl.items || (sb.apl.productos||[]).map(n => ({n, d:null}))) : [];
              const color = sb.estado==="hecho" ? "#2E7D32" : sb.estado==="ventana" ? "#8A6200" : sb.estado==="atrasado" ? "#C0392B" : sb.estado==="sinregistro" ? "#8C8572" : "#5B6B7A";
              return (
                <div key={ev.prot.id} style={{fontSize:12.5,marginTop:6}}>
                  <b>🌱 Siembra{f.evals.length > 1 ? ` (${ev.prot.nombre.toLowerCase()})` : ""}:</b>{" "}
                  <span style={{color,fontWeight:600}}>
                    {sb.estado==="hecho" ? `sembrado el ${fFecha(sb.apl.fecha)}${sb.apl.parte ? ` (${sb.apl.lote})` : ""}`
                      : sb.estado==="ventana" ? `falta sembrar · ventana hasta el ${sb.hasta} (quedan ${sb.dias} días)`
                      : sb.estado==="atrasado" ? `sin siembra registrada · la ventana cerró el ${sb.hasta}`
                      : sb.estado==="sinregistro" ? "sin siembra registrada en la planilla"
                      : `desde el ${sb.desde} (en ${sb.dias} días)`}
                  </span>
                  {items.length > 0 && <span style={{opacity:0.75}}> — {items.map(it => `${it.n}${it.d!=null ? " " + fmtDosis(it.d, it.n) : ""}`).join(" · ")}</span>}
                </div>
              );
            })}

            {m && (() => { const n = NIVEL_MONITOREO[m.nivel] || NIVEL_MONITOREO.ok; return (
              <div style={{fontSize:12.5,marginTop:6}}>
                <b>🔍 Último monitoreo:</b> {fFecha(m.fecha)} · <span style={{color:n.color,fontWeight:600}}>{n.icono} {n.txt}</span>
                {[m.estado, m.malezas && `malezas: ${m.malezas}`, m.plagas && `plagas: ${m.plagas}`, m.accion && `acción: ${m.accion}`].filter(Boolean).map(t => <span key={t} style={{opacity:0.8}}> · {t}</span>)}
              </div>
            );})()}

            <div style={{fontSize:12.5,marginTop:6}}>
              <b>Última aplicación:</b>{" "}
              {f.ultima ? <>
                {fFecha(f.ultima.fecha)}{f.ultima.parte ? ` (${f.ultima.lote})` : ""} ·{" "}
                {f.ultimaResiduales.length
                  ? <span style={{color:"#2E7D32",fontWeight:600}}>con residual: {f.ultimaResiduales.map(it => `${it.n}${it.d!=null ? " " + fmtDosis(it.d, it.n, it.activo) : ""}`).join(", ")}</span>
                  : <span style={{color:"#8A6200",fontWeight:600}}>sin residual</span>}
                <span style={{opacity:0.6}}> — {(f.ultima.productos||[]).join(", ")}</span>
              </> : <span style={{opacity:0.6}}>sin pulverizaciones en la campaña</span>}
            </div>

            {porActivo.length > 0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6,alignItems:"center"}}>
                <b style={{fontSize:12.5}}>Residuales de la campaña:</b>
                {porActivo.map(g => {
                  const total = g.items.length > 1 && g.items.every(r => r.d != null) ? g.items.reduce((s, r) => s + r.d, 0) : null;
                  return (
                    <span key={g.activo} style={{fontSize:12,border:"1px solid #A5D6A7",background:"#F1F8F1",borderRadius:7,padding:"3px 8px"}}>
                      <b>{nombreActivo(g.activo)}</b>{" "}
                      {g.items.map((r, i) => <span key={i} title={`${r.n}${r.parte ? ` — ${r.ref}` : ""}`}>{i>0?" + ":""}{r.d!=null ? fmtDosis(r.d, r.n, g.activo) + " " : ""}<span style={{opacity:0.7}}>{fFecha(r.fecha)}{r.parte?"*":""}</span></span>)}
                      {total != null && <b> = {fmtDosis(total, g.items[0].n, g.activo)}</b>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {filtradas.some(f => f.aplicados.some(r => r.parte)) && <div style={{fontSize:11.5,opacity:0.6}}>* aplicado en una parte del lote (ej. "sin cabecera"); el detalle está al pasar el mouse.</div>}
    </div>
  );
}

// ============================================================
// LABORES REALIZADAS — por lote, campo o cultivo
// ============================================================
function VistaRealizadas({aplicaciones, fertilizaciones, registro}){
  const [campoF, setCampoF] = useState("TODOS");
  const [loteF, setLoteF] = useState("TODOS");
  const [cultivoF, setCultivoF] = useState("TODOS");
  const [tipoF, setTipoF] = useState("todas");
  const [busca, setBusca] = useState("");
  const [agrupar, setAgrupar] = useState("lote");

  const capital = t => t ? t.charAt(0) + t.slice(1).toLowerCase() : "";
  // Con el registro del pipeline se ven todas las labores (siembra incluida) con dosis y costo
  const registros = useMemo(() => registro ? registro.map(r => {
    const tipo = clasificarLabor(r.labor, r.productos);
    return {key:r.id, fecha:r.fecha, campo:r.campo, lote:String(r.lote), cultivo:r.cultivo||"", ha:Number(r.ha)||0, tipo,
      labor: capital(r.labor) || TIPO_LABOR[tipo].txt,
      detalle:(r.items||[]).map(it => `${it.n}${it.d!=null ? " " + fmtDosis(it.d, it.n) : ""}`).join(" · "), costo:Number(r.costo)||0};
  }).sort((a,b) => fechaLocal(b.fecha) - fechaLocal(a.fecha)) : [
    ...aplicaciones.map(a => { const tipo = clasificarLabor(a.labor, a.productos); return {key:`a${a.id}`, fecha:a.fecha, campo:a.campo, lote:String(a.lote), cultivo:a.cultivo||"", ha:Number(a.ha)||0,
      tipo, labor: capital(a.labor) || TIPO_LABOR[tipo].txt, detalle:(a.productos||[]).join(" · "), costo:Number(a.costo)||0}; }),
    ...fertilizaciones.map(f => ({key:`f${f.id}`, fecha:f.fecha, campo:f.campo, lote:String(f.lote), cultivo:f.cultivo||"", ha:Number(f.ha)||0,
      tipo:"fertilizacion", labor:f.tipo||"Fertilización", detalle:[f.producto, f.dosis].filter(Boolean).join(" · "), costo:(Number(f.ha)||0)*(Number(f.costoHa)||0)})),
  ].sort((a,b) => fechaLocal(b.fecha) - fechaLocal(a.fecha)), [aplicaciones, fertilizaciones, registro]);

  const campos = [...new Set(registros.map(r => r.campo))].sort((a,b)=>nombreCampo(a).localeCompare(nombreCampo(b)));
  const lotes = campoF === "TODOS" ? [] : [...new Set(registros.filter(r => r.campo === campoF).map(r => r.lote))].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  const cultivos = [...new Set(registros.map(r => baseCv(r.cultivo)).filter(Boolean))].sort();
  const palabras = normBusca(busca).split(/\s+/).filter(Boolean);
  const filtrados = registros.filter(r =>
    (campoF === "TODOS" || r.campo === campoF) && (loteF === "TODOS" || r.lote === loteF) &&
    (cultivoF === "TODOS" || baseCv(r.cultivo) === cultivoF) && (tipoF === "todas" || r.tipo === tipoF) &&
    (!palabras.length || palabras.every(w => normBusca(r.detalle + " " + r.labor).includes(w))));

  const claveGrupo = r => agrupar === "lote" ? `${r.campo}|${r.lote}` : agrupar === "campo" ? r.campo : agrupar === "cultivo" ? (baseCv(r.cultivo) || "SIN CULTIVO") : r.fecha.slice(0,7);
  const tituloGrupo = (k, r) => agrupar === "lote" ? `${nombreCampo(r.campo)} · Lote ${r.lote}` : agrupar === "campo" ? nombreCampo(k)
    : agrupar === "cultivo" ? k : (fechaLocal(r.fecha) || new Date()).toLocaleDateString("es-AR",{month:"long",year:"numeric"});
  const grupos = [];
  const idx = {};
  filtrados.forEach(r => { const k = claveGrupo(r); if(idx[k] === undefined){ idx[k] = grupos.length; grupos.push({k, titulo:tituloGrupo(k, r), cultivo:r.cultivo, filas:[]}); } grupos[idx[k]].filas.push(r); });
  const total = {n:filtrados.length, ha:filtrados.reduce((s,r)=>s+r.ha,0), costo:filtrados.reduce((s,r)=>s+r.costo,0),
    lotes:new Set(filtrados.map(r=>`${r.campo}|${r.lote}`)).size};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <select value={campoF} onChange={e=>{setCampoF(e.target.value); setLoteF("TODOS");}} style={selectV}>
          <option value="TODOS">Todos los campos</option>
          {campos.map(c => <option key={c} value={c}>{nombreCampo(c)}</option>)}
        </select>
        {campoF !== "TODOS" && (
          <select value={loteF} onChange={e=>setLoteF(e.target.value)} style={selectV}>
            <option value="TODOS">Todos los lotes</option>
            {lotes.map(l => <option key={l} value={l}>Lote {l}</option>)}
          </select>
        )}
        <select value={cultivoF} onChange={e=>setCultivoF(e.target.value)} style={selectV}>
          <option value="TODOS">Todos los cultivos</option>
          {cultivos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tipoF} onChange={e=>setTipoF(e.target.value)} style={selectV}>
          <option value="todas">Todas las labores</option>
          <option value="siembra">Sólo siembras</option>
          <option value="pulverizacion">Sólo pulverizaciones</option>
          <option value="fertilizacion">Sólo fertilizaciones</option>
          {registros.some(r => r.tipo === "labranza") && <option value="labranza">Sólo labranzas</option>}
        </select>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar producto (ej: atrazina)"
          style={{...selectV,fontWeight:400,flex:"1 1 180px",minWidth:0}}/>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,opacity:0.6,fontWeight:600}}>Agrupar por:</span>
        {[["lote","Lote"],["campo","Campo"],["cultivo","Cultivo"],["mes","Mes"]].map(([k,l]) =>
          <button key={k} onClick={()=>setAgrupar(k)} style={chipV(agrupar===k)}>{l}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {[{l:"Labores",v:total.n},{l:"Lotes trabajados",v:total.lotes},{l:"Ha trabajadas",v:`${fmt(total.ha)} ha`},{l:"Costo total",v:`US$ ${fmt(total.costo)}`}]
          .map(s => <div key={s.l} style={{...cajaV,textAlign:"center"}}><div style={{fontSize:20,fontWeight:700}}>{s.v}</div><div style={{fontSize:11.5,opacity:0.65,marginTop:2}}>{s.l}</div></div>)}
      </div>
      {!grupos.length && <div style={{...cajaV,textAlign:"center",opacity:0.7}}>No hay labores con estos filtros.</div>}
      {grupos.map(g => {
        const haG = g.filas.reduce((s,r)=>s+r.ha,0), costoG = g.filas.reduce((s,r)=>s+r.costo,0);
        return (
          <div key={g.k} style={{...cajaV,padding:0,overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",padding:"10px 14px",background:"#EEE9DC",borderBottom:`1.5px solid ${TINTA}`}}>
              <div style={{fontWeight:700,fontSize:14.5,display:"flex",alignItems:"center",gap:7}}>
                {agrupar==="lote" && <span style={{width:10,height:10,borderRadius:2,background:colorCv(g.cultivo)}}/>}
                {g.titulo}{agrupar==="lote" && g.cultivo ? <span style={{fontWeight:500,fontSize:12,opacity:0.7}}>{g.cultivo}</span> : null}
              </div>
              <div style={{fontSize:12,opacity:0.75}}>{g.filas.length} labores · {fmt(haG)} ha · US$ {fmt(costoG)}</div>
            </div>
            {g.filas.map(r => (
              <div key={r.key} style={{display:"grid",gridTemplateColumns:"64px minmax(0,1fr) auto",gap:10,padding:"8px 14px",borderTop:"1px solid #E5E0D0",fontSize:12.5,alignItems:"baseline"}}>
                <div style={{fontWeight:700,whiteSpace:"nowrap"}}>{fechaCorta(r.fecha)}</div>
                <div style={{minWidth:0}}>
                  <span style={{fontSize:10.5,fontWeight:700,borderRadius:5,padding:"1px 6px",marginRight:6,
                    background:(TIPO_LABOR[r.tipo]||TIPO_LABOR.pulverizacion).fondo,color:(TIPO_LABOR[r.tipo]||TIPO_LABOR.pulverizacion).color}}>{r.labor}</span>
                  {agrupar!=="lote" && <b>{nombreCampo(r.campo)} {r.lote} · </b>}
                  {agrupar!=="cultivo" && agrupar!=="lote" && r.cultivo && <span style={{opacity:0.7}}>{r.cultivo} · </span>}
                  <span style={{opacity:0.85}}>{r.detalle || "—"}</span>
                </div>
                <div style={{whiteSpace:"nowrap",textAlign:"right",fontSize:12}}>{fmt(r.ha)} ha{r.costo ? <span style={{opacity:0.65}}> · US$ {fmt(r.costo)}</span> : null}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DOCUMENTOS COMPARTIDOS — protocolo y precios, guardados en la planilla
// (api/compartido.js) con copia local por si no hay señal
// ============================================================
function useDocCompartido(doc, base, valido, autor){
  const KEY = `smix_${doc}_v1`;
  const [datos, setDatos] = useState(() => {
    try { const d = JSON.parse(window.localStorage.getItem(KEY)); if(valido(d)) return d; } catch {}
    return base;
  });
  const [sync, setSync] = useState({estado:"cargando"});
  useEffect(() => {
    fetch(`/api/compartido?doc=${doc}`).then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then(d => {
        // La planilla manda: si nadie guardó todavía, vale el original
        const remoto = valido(d.datos) ? d.datos : base;
        setDatos(remoto);
        try { if(valido(d.datos)) window.localStorage.setItem(KEY, JSON.stringify(d.datos)); else window.localStorage.removeItem(KEY); } catch {}
        setSync({estado:"ok", actualizado:d.actualizado, autor:d.autor});
      })
      .catch(e => setSync({estado:"error", txt:e.message}));
  }, []);
  const guardar = async (nuevo) => {
    setDatos(nuevo);
    try { window.localStorage.setItem(KEY, JSON.stringify(nuevo)); } catch {}
    setSync({estado:"guardando"});
    try {
      const r = await fetch(`/api/compartido?doc=${doc}`, {method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({datos:nuevo, autor})});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error || "error");
      setSync({estado:"ok", actualizado:d.actualizado, autor});
    } catch(e) {
      setSync({estado:"error", txt:e.message});
    }
  };
  return [datos, guardar, sync];
}
const textoSync = (sync, sinCambios) => sync.estado === "guardando" ? "Guardando…" : sync.estado === "cargando" ? "Cargando la versión compartida…"
  : sync.estado === "error" ? `No se pudo sincronizar${sync.txt ? `: ${sync.txt}` : ""}. Queda guardado en este equipo.`
  : sync.actualizado ? `Guardado para todos el ${new Date(sync.actualizado).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"})}${sync.autor ? ` por ${sync.autor}` : ""}` : sinCambios;

// ============================================================
// PRECIOS — editar el precio de semillas, fertilizantes y agroquímicos
// Es el precio que toma "Nueva labor" al elegir el producto (y el que se escribe en la planilla).
// ============================================================
const PRECIOS_BASE = {version:1, precios:{}};
const CATEGORIAS_PRECIO = [["SEM","Semillas"],["FERT","Fertilizantes"],["SGR","Curasemillas"],["HER","Herbicidas"],
  ["INS","Insecticidas"],["FUN","Fungicidas"],["COAD","Coadyuvantes"]];

function VistaPrecios({productos, precios, sync, onGuardar}){
  const original = useMemo(() => Object.fromEntries(productos.map(p => [p.n, p.p || 0])), [productos]);
  const aTexto = obj => Object.fromEntries(Object.entries(obj||{}).map(([n, v]) => [n, String(v).replace(".", ",")]));
  const [editados, setEditados] = useState(() => aTexto(precios.precios));
  useEffect(() => { setEditados(aTexto(precios.precios)); }, [precios]);
  const [cat, setCat] = useState("SEM");
  const [busca, setBusca] = useState("");

  const num = t => { const x = parseFloat(String(t).replace(/\./g, "").replace(",", ".")); return isNaN(x) ? null : x; };
  // Lo que se guarda: sólo los precios que difieren del original
  const final = {};
  Object.entries(editados).forEach(([n, t]) => { const v = num(t); if(v != null && v !== original[n]) final[n] = v; });
  const cambiado = JSON.stringify(final) !== JSON.stringify(precios.precios || {});
  const invalidos = Object.entries(editados).filter(([, t]) => String(t).trim() !== "" && num(t) == null).map(([n]) => n);

  const palabras = normBusca(busca).split(/\s+/).filter(Boolean);
  const lista = productos.filter(p => p.cat !== "LABOR" && (cat === "TODAS" || p.cat === cat || (cat === "EDITADOS" && precios.precios?.[p.n] != null))
    && (!palabras.length || palabras.every(w => normBusca(p.n).includes(w))));
  const btn = (fondo, color) => ({padding:"7px 13px",fontSize:12.5,fontWeight:700,borderRadius:8,border:`1.5px solid ${TINTA}`,background:fondo,color,cursor:"pointer",fontFamily:"inherit"});
  const nEditados = Object.keys(precios.precios || {}).length;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{...cajaV,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:5}}>
        <div>
          <div style={{fontSize:15,fontWeight:700}}>Precios de productos (USD)</div>
          <div style={{fontSize:11.5,opacity:0.7,marginTop:2,color:sync.estado==="error"?"#C0392B":TINTA}}>
            {textoSync(sync, "Precios originales del catálogo (sin cambios guardados)")}{nEditados ? ` · ${nEditados} precio(s) editado(s)` : ""}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button disabled={!cambiado} onClick={()=>setEditados(aTexto(precios.precios))} style={{...btn("transparent",TINTA),opacity:cambiado?1:0.4}}>Descartar cambios</button>
          <button disabled={!cambiado || invalidos.length>0} onClick={()=>onGuardar({...precios, version:1, precios:final})}
            style={{...btn(cambiado&&!invalidos.length?"#2E7D32":"#B5AF9D","#fff"),border:"none"}}>💾 Guardar precios</button>
        </div>
        {invalidos.length>0 && <div style={{width:"100%",fontSize:12,color:"#C0392B"}}>Revisá el número en: {invalidos.join(", ")}</div>}
      </div>
      <div style={{fontSize:12,opacity:0.7}}>
        Es el precio que toma <b>Nueva labor</b> al elegir el producto y el que se escribe en la planilla al guardar la labor.
        Las labores ya guardadas no cambian. El precio de las labores (pulverización, siembra…) no se edita acá.
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {[...CATEGORIAS_PRECIO, ["TODAS","Todas"], ["EDITADOS",`Editados (${nEditados})`]].map(([k, l]) =>
          <button key={k} onClick={()=>setCat(k)} style={chipV(cat===k)}>{l}</button>)}
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar producto"
          style={{...selectV,fontWeight:400,flex:"1 1 180px",minWidth:0,padding:"6px 10px",fontSize:13}}/>
      </div>
      <div style={{...cajaV,padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 96px 30px",gap:8,padding:"8px 12px",background:"#E5E0D0",
          fontSize:10.5,fontWeight:700,textTransform:"uppercase",opacity:0.75}}>
          <div>Producto</div><div style={{textAlign:"right"}}>Precio USD</div><div/>
        </div>
        {!lista.length && <div style={{padding:12,fontSize:12.5,opacity:0.6}}>No hay productos con estos filtros.</div>}
        {lista.map(p => {
          const t = editados[p.n];
          const valor = t !== undefined ? t : String(original[p.n] ?? "").replace(".", ",");
          const v = num(valor);
          const distinto = v != null && v !== original[p.n];
          return (
            <div key={p.n} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 96px 30px",gap:8,padding:"6px 12px",alignItems:"center",
              borderTop:"1px solid #E5E0D0",background:distinto?"#FFF8E6":"transparent",fontSize:12.5}}>
              <div style={{minWidth:0,overflowWrap:"anywhere"}} title={p.n}>
                {p.n}{p.prov==="PROPIO" && <span style={{fontSize:10.5,color:"#1E5FA8",marginLeft:5}}>mío</span>}
                <div style={{fontSize:11,opacity:0.6}}>por {p.u || "unidad"} · original {original[p.n] ? fmtCant(original[p.n]) : "sin precio"}</div>
              </div>
              <input inputMode="decimal" value={valor} onChange={e=>setEditados(x=>({...x,[p.n]:e.target.value}))}
                style={{width:"100%",boxSizing:"border-box",padding:"5px 7px",fontSize:12.5,textAlign:"right",borderRadius:6,fontFamily:"inherit",
                  border:`1px solid ${v==null && String(valor).trim()!=="" ? "#C0392B" : distinto ? "#C9A227" : "#C8C2B0"}`,background:"#FFFDF7",color:TINTA,fontWeight:distinto?700:400}}/>
              <button title="Volver al precio original" disabled={!distinto} onClick={()=>setEditados(x=>{ const n={...x}; delete n[p.n]; return n; })}
                style={{border:"none",background:"none",cursor:distinto?"pointer":"default",opacity:distinto?0.8:0.2,fontSize:14,padding:0,color:TINTA}}>↺</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// EDITOR DEL PROTOCOLO — se guarda compartido en la planilla
// ============================================================
function VistaProtocoloEditor({protocolo, sync, onGuardar}){
  const [borrador, setBorrador] = useState(protocolo);
  const [abierto, setAbierto] = useState(null);
  useEffect(() => { setBorrador(protocolo); }, [protocolo]);
  const cambiado = JSON.stringify(borrador) !== JSON.stringify(protocolo);
  const fechaOK = s => /^\d{1,2}\/\d{1,2}$/.test(String(s||"").trim());
  const errores = (borrador.cultivos||[]).flatMap(c => [
    ...((c.siembraDesde && !fechaOK(c.siembraDesde)) || (c.siembraHasta && !fechaOK(c.siembraHasta)) ? [`${c.nombre} · siembra`] : []),
    ...(c.pasos||[]).filter(p => !fechaOK(p.desde) || !fechaOK(p.hasta)).map(p => `${c.nombre} · ${p.nombre||"paso sin nombre"}`)]);

  const setCultivo = (ci, cambios) => setBorrador(b => ({...b, cultivos: b.cultivos.map((c,i) => i===ci ? {...c, ...cambios} : c)}));
  const setPaso = (ci, pi, cambios) => setCultivo(ci, {pasos: borrador.cultivos[ci].pasos.map((p,i) => i===pi ? {...p, ...cambios} : p)});
  const nuevoId = () => `p${Date.now().toString(36)}`;
  const campoTxt = {width:"100%",boxSizing:"border-box",padding:"6px 8px",fontSize:12.5,border:"1px solid #C8C2B0",borderRadius:6,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"};
  const etiqueta = t => <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",opacity:0.6,marginBottom:3}}>{t}</div>;
  const btn = (fondo, color) => ({padding:"7px 13px",fontSize:12.5,fontWeight:700,borderRadius:8,border:`1.5px solid ${TINTA}`,background:fondo,color,cursor:"pointer",fontFamily:"inherit"});

  const estadoSync = textoSync(sync, "Protocolo original (sin cambios guardados)");

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{...cajaV,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:5}}>
        <div>
          <div style={{fontSize:15,fontWeight:700}}>Protocolo de residuales · campaña {borrador.campania}</div>
          <div style={{fontSize:11.5,opacity:0.7,marginTop:2,color:sync.estado==="error"?"#C0392B":TINTA}}>{estadoSync}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>{ if(window.confirm("¿Volver al protocolo original del PDF? Se pierden los cambios guardados.")) onGuardar(PROTOCOLO_BASE); }} style={btn("transparent",TINTA)}>Restaurar original</button>
          <button disabled={!cambiado} onClick={()=>setBorrador(protocolo)} style={{...btn("transparent",TINTA),opacity:cambiado?1:0.4}}>Descartar cambios</button>
          <button disabled={!cambiado || errores.length>0} onClick={()=>onGuardar(borrador)}
            style={{...btn(cambiado&&!errores.length?"#2E7D32":"#B5AF9D","#fff"),border:"none"}}>💾 Guardar protocolo</button>
        </div>
        {errores.length>0 && <div style={{width:"100%",fontSize:12,color:"#C0392B"}}>Revisá las fechas (formato dd/mm) en: {errores.join("; ")}</div>}
      </div>

      <div style={cajaV}>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:10,alignItems:"start"}}>
          <div>{etiqueta("Campaña")}<input value={borrador.campania} onChange={e=>setBorrador(b=>({...b,campania:e.target.value}))} style={campoTxt}/></div>
          <div>{etiqueta("Base y criterios")}<textarea value={borrador.criterios} rows={4} onChange={e=>setBorrador(b=>({...b,criterios:e.target.value}))} style={{...campoTxt,resize:"vertical"}}/></div>
        </div>
        <div style={{fontSize:11.5,opacity:0.7,marginTop:8,lineHeight:1.5}}>
          <b>Cómo se detecta si un paso se hizo:</b> en "Activos clave" van los residuales que tienen que figurar en la planilla para ese lote dentro de la ventana.
          Usá <b>+</b> para "y" y <b>|</b> para "o". Ej: <i>flurocloridona + metolacloro | paraquat + sulfentrazone</i>. Se reconocen también nombres comerciales (Gesaprim, Brodal, Rainbow, Terbyne…).
          En "Se aplica a" van los cultivos de la planilla 26-27, separados por coma; <b>*</b> es comodín (<i>*-SOJA</i> = soja de segunda después de cualquier fina). Si queda vacío, no genera pendientes.
        </div>
      </div>

      <div style={cajaV}>
        <div style={{fontSize:14,fontWeight:700}}>Duración de los residuales y activación</div>
        <div style={{fontSize:11.5,opacity:0.7,margin:"3px 0 10px"}}>
          Con esto se calcula hasta cuándo un lote está cubierto: fecha de aplicación + días del activo que más dura.
          Si hay lluvias cargadas para ese campo y no llovieron los mm en los días indicados, el residual cuenta como no activado.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:"8px 18px"}}>
          {Object.keys(DURACION_RESIDUAL).map(a => (
            <label key={a} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,fontSize:12.5,whiteSpace:"nowrap"}}>
              <span>{nombreActivo(a)}</span>
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <input inputMode="numeric" value={(borrador.duraciones||{})[a] ?? DURACION_RESIDUAL[a]}
                  onChange={e=>{ const v = parseInt(e.target.value, 10); setBorrador(b=>({...b, duraciones:{...(b.duraciones||{}), [a]: isNaN(v) ? "" : v}})); }}
                  style={{...campoTxt,width:56,textAlign:"right",padding:"4px 6px"}}/>días
              </span>
            </label>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:12,fontSize:12.5}}>
          <span>Se activa con</span>
          <input inputMode="numeric" value={(borrador.activacion||{}).mm ?? ACTIVACION_BASE.mm} onChange={e=>{ const v = parseInt(e.target.value, 10); setBorrador(b=>({...b, activacion:{...ACTIVACION_BASE, ...(b.activacion||{}), mm: isNaN(v) ? "" : v}})); }}
            style={{...campoTxt,width:56,textAlign:"right",padding:"4px 6px"}}/>
          <span>mm de lluvia dentro de los</span>
          <input inputMode="numeric" value={(borrador.activacion||{}).dias ?? ACTIVACION_BASE.dias} onChange={e=>{ const v = parseInt(e.target.value, 10); setBorrador(b=>({...b, activacion:{...ACTIVACION_BASE, ...(b.activacion||{}), dias: isNaN(v) ? "" : v}})); }}
            style={{...campoTxt,width:56,textAlign:"right",padding:"4px 6px"}}/>
          <span>días de aplicado.</span>
        </div>
      </div>

      {(borrador.cultivos||[]).map((c, ci) => (
        <div key={c.id} style={cajaV}>
          <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
            <button onClick={()=>setAbierto(abierto===c.id?null:c.id)} style={{border:"none",background:"none",padding:0,cursor:"pointer",fontFamily:"inherit",color:TINTA,textAlign:"left"}}>
              <span style={{fontSize:16,fontWeight:700}}>{abierto===c.id?"▾":"▸"} {c.nombre}</span>
              <span style={{fontSize:12,opacity:0.65,marginLeft:8}}>{c.pasos.length} pasos · {c.aplicaA || "sin cultivos asignados"}{c.siembraDesde ? ` · siembra ${c.siembraDesde}–${c.siembraHasta||"?"}` : ""}</span>
            </button>
            {abierto===c.id && <button onClick={()=>{ if(window.confirm(`¿Borrar ${c.nombre} del protocolo?`)) setBorrador(b=>({...b,cultivos:b.cultivos.filter((_,i)=>i!==ci)})); }}
              style={{...btn("transparent","#C0392B"),borderColor:"#C0392B",padding:"4px 10px",fontSize:11.5}}>Borrar cultivo</button>}
          </div>
          {abierto!==c.id && (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
              {c.pasos.map(p => <span key={p.id} style={{fontSize:11.5,background:"#fff",border:"1px solid #C8C2B0",borderRadius:6,padding:"2px 8px"}}>{p.nombre} · {p.desde}–{p.hasta}</span>)}
            </div>
          )}
          {abierto===c.id && (
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:10}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
                <div>{etiqueta("Nombre")}<input value={c.nombre} onChange={e=>setCultivo(ci,{nombre:e.target.value})} style={campoTxt}/></div>
                <div>{etiqueta("Se aplica a (cultivos de la planilla)")}<input value={c.aplicaA} onChange={e=>setCultivo(ci,{aplicaA:e.target.value})} placeholder="ej: SOJA, *-SOJA" style={campoTxt}/></div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>{etiqueta("Siembra desde")}<input value={c.siembraDesde||""} placeholder="dd/mm" onChange={e=>setCultivo(ci,{siembraDesde:e.target.value})} style={{...campoTxt,borderColor:!c.siembraDesde||fechaOK(c.siembraDesde)?"#C8C2B0":"#C0392B"}}/></div>
                  <div style={{flex:1}}>{etiqueta("Siembra hasta")}<input value={c.siembraHasta||""} placeholder="dd/mm" onChange={e=>setCultivo(ci,{siembraHasta:e.target.value})} style={{...campoTxt,borderColor:!c.siembraHasta||fechaOK(c.siembraHasta)?"#C8C2B0":"#C0392B"}}/></div>
                </div>
              </div>
              {c.pasos.map((p, pi) => (
                <div key={p.id} style={{border:"1px solid #C8C2B0",borderRadius:9,padding:10,background:"#FFFDF7"}}>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(160px,2fr) 80px 80px minmax(180px,2fr)",gap:8}}>
                    <div>{etiqueta(`Paso ${pi+1}`)}<input value={p.nombre} onChange={e=>setPaso(ci,pi,{nombre:e.target.value})} style={campoTxt}/></div>
                    <div>{etiqueta("Desde")}<input value={p.desde} placeholder="dd/mm" onChange={e=>setPaso(ci,pi,{desde:e.target.value})} style={{...campoTxt,borderColor:fechaOK(p.desde)?"#C8C2B0":"#C0392B"}}/></div>
                    <div>{etiqueta("Hasta")}<input value={p.hasta} placeholder="dd/mm" onChange={e=>setPaso(ci,pi,{hasta:e.target.value})} style={{...campoTxt,borderColor:fechaOK(p.hasta)?"#C8C2B0":"#C0392B"}}/></div>
                    <div>{etiqueta("Activos clave")}<input value={p.clave} onChange={e=>setPaso(ci,pi,{clave:e.target.value})} style={campoTxt}/></div>
                  </div>
                  <div style={{marginTop:8}}>{etiqueta("Mezcla (por ha)")}<textarea value={p.mezcla} rows={2} onChange={e=>setPaso(ci,pi,{mezcla:e.target.value})} style={{...campoTxt,resize:"vertical"}}/></div>
                  <div style={{marginTop:8,display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                    <label style={{fontSize:12,display:"flex",gap:5,alignItems:"center",paddingBottom:6}}>
                      <input type="checkbox" checked={!!p.hastaSiembra} onChange={e=>setPaso(ci,pi,{hastaSiembra:e.target.checked})}/>
                      Se hace a la siembra (si vence, queda "antes de sembrar")
                    </label>
                    <div style={{flex:"1 1 200px"}}>{etiqueta("Nota")}<input value={p.nota||""} onChange={e=>setPaso(ci,pi,{nota:e.target.value})} style={campoTxt}/></div>
                    <button onClick={()=>setCultivo(ci,{pasos:c.pasos.filter((_,i)=>i!==pi)})} style={{...btn("transparent","#C0392B"),borderColor:"#C0392B",padding:"5px 10px",fontSize:11.5}}>Borrar paso</button>
                  </div>
                </div>
              ))}
              <button onClick={()=>setCultivo(ci,{pasos:[...c.pasos,{id:nuevoId(),nombre:"Nuevo paso",desde:"01/09",hasta:"30/09",clave:"",mezcla:""}]})}
                style={{...btn("transparent",TINTA),alignSelf:"flex-start"}}>+ Agregar paso</button>
            </div>
          )}
        </div>
      ))}
      <button onClick={()=>{ const id = nuevoId(); setBorrador(b=>({...b,cultivos:[...b.cultivos,{id,nombre:"Nuevo cultivo",aplicaA:"",pasos:[]}]})); setAbierto(id); }}
        style={{...btn("transparent",TINTA),alignSelf:"flex-start"}}>+ Agregar cultivo</button>
    </div>
  );
}

// ============================================================
// MONITOREO — recorridas a campo, guardadas en la hoja "monitoreo" de la planilla (api/monitoreo.js).
// Si no hay señal, quedan en el equipo y se suben solas cuando vuelve.
// ============================================================
const NIVEL_MONITOREO = {
  ok:      {txt:"Sin problemas", icono:"🟢", color:"#2E7D32", fondo:"#E8F5E9"},
  atencion:{txt:"Atención",      icono:"🟡", color:"#8A6200", fondo:"#FFF6DD"},
  urgente: {txt:"Urgente",       icono:"🔴", color:"#C0392B", fondo:"#FBE3E0"},
};
const SUGERENCIAS_MONITOREO = {
  malezas: ["Rama negra","Yuyo colorado","Gramón","Sorgo de Alepo","Capín","Pata de ganso","Chloris","Gramíneas anuales","Cardo ruso","Quínoa",
    "Bowlesia","Ortiga mansa","Nabo / mostacilla","Raigrás","Avena guacha","Cebadilla","Verdolaga","Chamico","Malva","Peludilla","Viola"],
  plagas: ["Isoca","Chinche","Trips","Arañuela","Pulgón","Tucura","Cogollero","Bolillera","Babosa","Gusano blanco","Gusano cortador","Oruga militar"],
  enfermedades: ["Mancha amarilla","Roya","Tizón","Esclerotinia","Mildiu","Carbón","Mancha en red","Ramularia","Cercospora","Phoma"],
};
const DENSIDAD_MALEZAS = ["","Aisladas","Baja","Media","Alta","En manchones"];
const TAMANO_MALEZAS = ["","Plántula / roseta","Menos de 5 cm","5 a 15 cm","Más de 15 cm","Rebrote / tolerante"];
const ACCIONES_MONITOREO = ["Aplicar residual","Aplicar quemante / barbecho","Control de malezas en cultivo","Control de plagas","Fungicida",
  "Resembrar","Fertilizar","Volver a monitorear en 7 días","Sin acción por ahora"];
const HUMEDAD_SUELO = ["","Seco","Humedad justa","Buena humedad","Encharcado"];
// Antes del cultivo (sirven para cualquier lote)
const ESTADOS_SIN_CULTIVO = [["Pre-siembra","Pre-siembra (barbecho)"],["Sembrado sin emerger","Sembrado, sin emerger"],["Rastrojo","Rastrojo / poscosecha"]];
// Escalas fenológicas por cultivo: [código, descripción]
const ZADOKS = {nombre:"Zadoks", estadios:[["Z10","Emergencia (1ª hoja)"],["Z12","2 hojas"],["Z13","3 hojas"],["Z21","Inicio de macollaje"],
  ["Z23","3 macollos"],["Z25","5 macollos"],["Z30","Inicio de encañazón (espiga a 1 cm)"],["Z31","1er nudo"],["Z32","2º nudo"],["Z37","Hoja bandera visible"],
  ["Z39","Lígula de la hoja bandera"],["Z45","Bota (vaina engrosada)"],["Z49","Aristas visibles"],["Z55","Espigazón (media espiga)"],["Z65","Antesis / floración"],
  ["Z71","Grano acuoso"],["Z75","Grano lechoso"],["Z85","Grano pastoso"],["Z92","Madurez de cosecha"]]};
const ESCALAS_FENOLOGICAS = {
  SOJA: {nombre:"Fehr y Caviness", estadios:[["VE","Emergencia"],["VC","Cotiledones, hojas unifoliadas abiertas"],["V1","1ª hoja trifoliada"],["V2","2ª trifoliada"],
    ["V3","3ª trifoliada"],["V4","4ª trifoliada"],["V5","5ª trifoliada"],["V6","6ª trifoliada"],["V7+","7 o más trifoliadas"],["R1","Inicio de floración"],
    ["R2","Floración plena"],["R3","Inicio de formación de vainas"],["R4","Vainas desarrolladas"],["R5","Inicio de llenado de granos"],
    ["R6","Granos desarrollados"],["R7","Madurez fisiológica"],["R8","Madurez de cosecha"]]},
  MAIZ: {nombre:"Ritchie y Hanway", estadios:[["VE","Emergencia"],["V1","1 hoja con lígula"],["V2","2 hojas"],["V3","3 hojas"],["V4","4 hojas"],["V5","5 hojas"],
    ["V6","6 hojas"],["V8","8 hojas"],["V10","10 hojas"],["V12","12 hojas"],["V14","14 hojas"],["V16+","16 o más hojas"],["VT","Panojamiento"],
    ["R1","Emergencia de estigmas (sedas)"],["R2","Ampolla"],["R3","Grano lechoso"],["R4","Grano pastoso"],["R5","Grano dentado"],["R6","Madurez fisiológica"]]},
  GIRASOL: {nombre:"Schneiter y Miller", estadios:[["VE","Emergencia"],["V2","2 hojas verdaderas"],["V4","4 hojas"],["V6","6 hojas"],["V8","8 hojas"],
    ["V10","10 hojas"],["V12","12 hojas"],["V14+","14 o más hojas"],["R1","Botón floral visible (estrella)"],["R2","Botón a menos de 2 cm de la última hoja"],
    ["R3","Botón a más de 2 cm"],["R4","Inflorescencia empieza a abrir"],["R5","Floración (R5.1 a R5.9)"],["R6","Fin de floración"],
    ["R7","Dorso del capítulo amarillo pálido"],["R8","Dorso amarillo, brácteas verdes"],["R9","Madurez fisiológica"]]},
  SORGO: {nombre:"Vanderlip y Reeves", estadios:[["E0","Emergencia"],["E1","3 hojas"],["E2","5 hojas"],["E3","Diferenciación del punto de crecimiento"],
    ["E4","Hoja bandera visible"],["E5","Bota"],["E6","Floración (50%)"],["E7","Grano pastoso blando"],["E8","Grano pastoso duro"],["E9","Madurez fisiológica"]]},
  MANI: {nombre:"Boote", estadios:[["VE","Emergencia"],["V2","2 nudos"],["V4","4 nudos"],["V6+","6 o más nudos"],["R1","Inicio de floración"],["R2","Clavo"],
    ["R3","Inicio de formación de vainas"],["R4","Vaina completa"],["R5","Inicio de semilla"],["R6","Semilla completa"],["R7","Inicio de madurez"],["R8","Madurez de cosecha"]]},
  TRIGO: ZADOKS, CEBADA: ZADOKS, AVENA: ZADOKS, CENTENO: ZADOKS, VERDEO: ZADOKS, FINA: ZADOKS,
};
const ESCALA_PASTURA = {nombre:"Pastura", estadios:[["Implantación","Implantación"],["Vegetativo","Vegetativo"],["Listo para pastoreo","Listo para pastoreo"],
  ["Pastoreado","Recién pastoreado"],["Floración","Floración"],["Semillazón","Semillazón"]]};
const escalaDe = cv => ESCALAS_FENOLOGICAS[baseCv(cv)] || ESCALA_PASTURA;
const CULTIVOS_FINOS = ["TRIGO","CEBADA","AVENA","CENTENO","VERDEO","FINA"];
const CULTIVOS_MONITOREO = ["SOJA","MAIZ","GIRASOL","SORGO","MANI","TRIGO","CEBADA","AVENA","CENTENO","VERDEO","PASTURA"];
// Estadios en los que tiene sentido contar plantas nacidas
const ESTADIOS_NACIMIENTO = ["Sembrado sin emerger","VE","VC","V1","V2","V3","V4","Z10","Z12","Z13","Z21","E0","E1","Implantación"];
const SEMILLAS_POR_BOLSA = {MAIZ:80000, GIRASOL:150000, SORGO:200000};
const SURCOS = [0.175,0.19,0.21,0.35,0.42,0.52,0.525,0.70];
const SEMBRADAS_SUGERIDAS = {MAIZ:[60000,65000,70000,75000,80000], GIRASOL:[40000,45000,50000,55000,60000], SOJA:[250000,300000,350000,400000],
  SORGO:[150000,200000,250000], MANI:[150000,180000,200000]};
const CAUSAS_FALLA = ["Falta de humedad","Planchado / encostrado","Profundidad despareja","Babosa","Gusano blanco","Otras plagas de suelo",
  "Exceso de agua","Mucho rastrojo","Calidad de semilla","Falla de sembradora"];
// Cultivo que hay hoy en el lote: si hay siembra registrada reciente, ese; si es doble cultivo, la fina hasta noviembre
const cultivoEnLote = (cv, siembra, fechaISO) => {
  const partes = cvPartes(cv);
  const f = fechaLocal(fechaISO) || new Date();
  const fs = siembra && fechaLocal(siembra.fecha);
  if(fs && (f - fs) / 86400000 < 200 && (f - fs) >= 0 && cvPartes(siembra.cultivo)[0]) return cvPartes(siembra.cultivo)[0];
  if(partes.length > 1){ const mes = f.getMonth() + 1; return CULTIVOS_FINOS.includes(partes[0]) && mes >= 4 && mes <= 11 ? partes[0] : partes[partes.length-1]; }
  return partes[0] || "";
};
// Semillas/ha según la siembra registrada (sólo cuando la semilla va en bolsas de cantidad conocida)
const sembradasSegunRegistro = (siembra, cultivo) => {
  if(!siembra) return null;
  const sem = (siembra.productos||[]).find(p => catProducto(p.n) === "SEM") || (siembra.productos||[]).find(p => Number(p.d) > 0 && Number(p.d) < 3 && catProducto(p.n) !== "FERT");
  const porBolsa = SEMILLAS_POR_BOLSA[baseCv(cultivo)];
  if(!sem || !porBolsa || !(Number(sem.d) > 0) || Number(sem.d) > 5) return sem ? {sem, valor:null} : null;
  return {sem, valor: Math.round(Number(sem.d) * porBolsa / 100) * 100};
};
const fmtMiles = n => n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("es-AR");
// Lista compartida en una hoja de la planilla (monitoreos, lluvias), con cola local de lo que
// no se pudo subir por falta de señal: se ve igual (marcado) y se sube solo cuando vuelve.
function useListaCompartida({url, cuerpo, colaKey, campo}){
  const leerCola = () => { try { return JSON.parse(window.localStorage.getItem(colaKey)) || []; } catch { return []; } };
  const escribirCola = c => { try { window.localStorage.setItem(colaKey, JSON.stringify(c)); } catch {} };
  const [remotos, setRemotos] = useState([]);
  const [cola, setCola] = useState(leerCola);
  const [sync, setSync] = useState({estado:"cargando"});

  const subir = async (m) => {
    const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({[cuerpo]:m})});
    const d = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  };
  const recargar = async () => {
    try {
      const r = await fetch(url);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRemotos(d[campo] || []);
      setSync({estado:"ok"});
    } catch(e) { setSync({estado:"error", txt:e.message}); }
  };
  const reintentar = async () => {
    let pendientes = leerCola();
    for(const m of [...pendientes]){
      try { await subir(m); pendientes = pendientes.filter(x => x.id !== m.id); } catch { break; }
    }
    escribirCola(pendientes); setCola(pendientes);
    await recargar();
  };
  useEffect(() => { reintentar(); }, []);

  const guardar = async (lista) => {
    setSync({estado:"guardando"});
    let pendientes = leerCola().filter(x => !lista.some(m => m.id === x.id));
    let fallo = null;
    for(const m of lista){
      try { await subir(m); } catch(e) { fallo = e; pendientes.push(m); }
    }
    escribirCola(pendientes); setCola(pendientes);
    if(fallo){ setSync({estado:"error", txt:fallo.message}); return false; }
    await recargar();
    return true;
  };
  const borrar = async (id) => {
    const pendientes = leerCola().filter(x => x.id !== id);
    escribirCola(pendientes); setCola(pendientes);
    setRemotos(rs => rs.filter(m => m.id !== id));
    try { await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id, borrar:true})}); } catch {}
  };
  const lista = useMemo(() => [...cola.map(m => ({...m, sinSubir:true})), ...remotos.filter(m => !cola.some(c => c.id === m.id))]
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.registrado||"").localeCompare(String(a.registrado||""))), [cola, remotos]);
  return {lista, guardar, borrar, reintentar, sync, sinSubir: cola.length};
}
const useMonitoreos = () => useListaCompartida({url:"/api/monitoreo", cuerpo:"monitoreo", colaKey:"smix_monitoreo_pendientes_v1", campo:"monitoreos"});
const useLluvias = () => useListaCompartida({url:"/api/lluvias", cuerpo:"registro", colaKey:"smix_lluvias_pendientes_v1", campo:"lluvias"});

// Fotos: se achican en el teléfono (máx. 1600 px, JPEG) antes de subirlas al Drive
const achicarFoto = file => new Promise((ok, mal) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    ok(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
  };
  img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("no se pudo leer la foto")); };
  img.src = url;
});

// Último monitoreo de un lote (para la ficha de Labores pendientes)
const ultimoMonitoreo = (lista, campoId, loteId) => (lista||[]).find(m => m.campo === campoId && String(m.lote) === String(loteId));

// Lluvias por campo: sirven para saber si un residual se activó (pestaña Labores pendientes)
function SeccionLluvias({lluv, autor}){
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({fecha:hoyISO(), mm:"", campos:[], nota:""});
  const [msg, setMsg] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  const mm = parseFloat(String(form.mm).replace(",", "."));
  const guardar = async () => {
    if(!form.campos.length || !(mm >= 0)){ setMsg({ok:false, txt:"Elegí los campos y cargá los mm."}); return; }
    const lista = form.campos.map((c, i) => ({id:`l${Date.now().toString(36)}${i}`, fecha:form.fecha, campo:c, mm, nota:form.nota.trim(), autor}));
    setMsg({ok:true, txt:"Guardando…"});
    const ok = await lluv.guardar(lista);
    setMsg(ok ? {ok:true, txt:`✓ ${fmt1(mm)} mm guardados en ${lista.length} campo${lista.length>1?"s":""}.`}
      : {ok:false, txt:"Sin conexión: quedó en este equipo y se sube cuando vuelva la señal."});
    setForm(f => ({...f, mm:"", nota:"", campos:[]})); setAbierto(false);
  };
  // Acumulado de los últimos 30 días por campo
  const corte = Date.now() - 30 * DIA_MS;
  const acum = {};
  lluv.lista.forEach(l => { const f = fechaLocal(l.fecha); if(f && f.getTime() >= corte) acum[l.campo] = (acum[l.campo] || 0) + (Number(l.mm) || 0); });
  const recientes = verTodas ? lluv.lista : lluv.lista.slice(0, 6);
  const chipS = a => ({padding:"5px 10px",fontSize:12.5,borderRadius:16,cursor:"pointer",fontFamily:"inherit",
    border:`1px solid ${a?"#1E5FA8":"#C8C2B0"}`,background:a?"#1E5FA8":"#fff",color:a?"#fff":TINTA,fontWeight:a?700:500});
  const txt = {boxSizing:"border-box",padding:"8px 9px",fontSize:14,border:"1px solid #C8C2B0",borderRadius:7,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"};
  return (
    <div style={{...cajaV,borderColor:"#1E5FA8"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <div>
          <div style={{fontSize:15,fontWeight:700}}>🌧 Lluvias</div>
          <div style={{fontSize:11.5,opacity:0.7}}>Hoja <b>lluvias</b> de la planilla. Con ellas se sabe si un residual se activó.{lluv.sinSubir ? ` · 📵 ${lluv.sinSubir} sin subir` : ""}</div>
        </div>
        {!abierto && <button onClick={()=>{ setAbierto(true); setMsg(null); }} style={{padding:"8px 14px",fontSize:13.5,fontWeight:700,borderRadius:9,border:"none",background:"#1E5FA8",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>➕ Registrar lluvia</button>}
      </div>
      {msg && <div style={{fontSize:12.5,fontWeight:600,marginTop:8,color:msg.ok?"#2E7D32":"#8A6200"}}>{msg.txt}</div>}
      {abierto && (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:10}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={txt}/>
            <input inputMode="decimal" value={form.mm} onChange={e=>setForm(f=>({...f,mm:e.target.value}))} placeholder="mm" style={{...txt,width:90,textAlign:"right"}}/>
            <input value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))} placeholder="nota (opcional)" style={{...txt,flex:"1 1 140px",minWidth:0}}/>
          </div>
          <div>
            <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",opacity:0.6,marginBottom:4}}>Campos donde llovió eso</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {CAMPOS.map(c => { const a = form.campos.includes(c.id); return <button key={c.id} onClick={()=>setForm(f=>({...f,campos:a?f.campos.filter(x=>x!==c.id):[...f.campos,c.id]}))} style={chipS(a)}>{c.nombre}</button>; })}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={guardar} style={{padding:"9px 16px",fontSize:14,fontWeight:700,borderRadius:9,border:"none",background:"#1E5FA8",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>💾 Guardar</button>
            <button onClick={()=>setAbierto(false)} style={{padding:"9px 14px",fontSize:14,fontWeight:600,borderRadius:9,border:`1.5px solid ${TINTA}`,background:"transparent",color:TINTA,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>
      )}
      {Object.keys(acum).length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10,alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700}}>Últimos 30 días:</span>
          {Object.entries(acum).sort((a,b)=>b[1]-a[1]).map(([c, v]) => <span key={c} style={{fontSize:12,background:"#EAF1FA",border:"1px solid #B9CDE2",borderRadius:7,padding:"2px 8px"}}>{nombreCampo(c)} <b>{fmt1(v)} mm</b></span>)}
        </div>
      )}
      {recientes.length > 0 && (
        <div style={{marginTop:8,fontSize:12.5,display:"flex",flexDirection:"column",gap:3}}>
          {recientes.map(l => (
            <div key={l.id} style={{display:"flex",gap:8,alignItems:"baseline",flexWrap:"wrap"}}>
              <span style={{fontWeight:700,minWidth:44}}>{(() => { const d = fechaLocal(l.fecha); return d ? ddmm(d) : l.fecha; })()}</span>
              <span>{nombreCampo(l.campo)}: <b>{fmt1(Number(l.mm)||0)} mm</b></span>
              {l.nota && <span style={{opacity:0.65}}>{l.nota}</span>}
              {l.sinSubir && <span style={{fontSize:11,color:"#8A6200"}}>📵 sin subir</span>}
              <button onClick={()=>{ if(window.confirm(`¿Borrar la lluvia de ${nombreCampo(l.campo)} del ${l.fecha}?`)) lluv.borrar(l.id); }}
                style={{border:"none",background:"none",padding:0,color:"#C0392B",cursor:"pointer",fontFamily:"inherit",fontSize:11.5}}>borrar</button>
            </div>
          ))}
          {lluv.lista.length > 6 && <button onClick={()=>setVerTodas(v=>!v)} style={{border:"none",background:"none",padding:0,color:"#1E5FA8",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12,alignSelf:"flex-start"}}>{verTodas ? "Ver menos" : `Ver todas (${lluv.lista.length})`}</button>}
        </div>
      )}
    </div>
  );
}

// Sube una foto al Drive (carpeta de las órdenes / "Fotos monitoreo") y devuelve el link
const subirFoto = async (base64, nombre) => {
  const r = await fetch("/api/guardar-foto", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({base64, nombre})});
  const d = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d.link;
};

// Formulario de monitoreo de UN lote. Se abre desde el lote (Mapa por campo → tocar el lote →
// "Monitorear este lote") y también para editar uno ya cargado desde la pestaña Monitoreo.
// Casi todo es para elegir (desplegables y botones) así se escribe lo menos posible en el celular.
function FormMonitoreo({monit, campoId, loteId, cultivoDe, siembraDe, autor, cambiarAutor, inicial, onListo, onCancelar}){
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const campo = CAMPOS.find(c => c.id === campoId) || {nombre:campoId, lotes:[]};
  const lote = campo.lotes.find(l => String(l.id) === String(loteId)) || {id:loteId};
  const cvPlan = cultivoDe(campoId, loteId);
  const siembra = siembraDe ? siembraDe(campoId, loteId) : null;
  const opcionesCultivo = [...new Set([...cvPartes(cvPlan), ...CULTIVOS_MONITOREO])];
  const [form, setForm] = useState(() => {
    const base = {id:null, fecha:hoyISO(), estado:"", nivel:"ok", malezas:"", malezasDensidad:"", malezasTamano:"", plagas:"", enfermedades:"", suelo:"",
      observaciones:"", accion:"", fotos:"", plantasHa:"", sembradasHa:"", logro:"", nacimiento:""};
    const f = inicial ? {...base, ...inicial} : base;
    const cv = inicial && opcionesCultivo.includes(baseCv(inicial.cultivo)) ? baseCv(inicial.cultivo) : cultivoEnLote(cvPlan, siembra, f.fecha);
    return {...f, cultivo: cv || ""};
  });
  const [fotos, setFotos] = useState([]);   // {file, url} elegidas para este monitoreo
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = cambios => setForm(f => ({...f, ...cambios}));

  const escala = escalaDe(form.cultivo);
  const estadosConocidos = [...ESTADOS_SIN_CULTIVO, ...escala.estadios].map(e => e[0]);
  const [estadoOtro, setEstadoOtro] = useState(() => !!form.estado && !estadosConocidos.includes(form.estado));
  const fino = CULTIVOS_FINOS.includes(baseCv(form.cultivo));
  const conCultivo = form.estado && !["Pre-siembra","Rastrojo"].includes(form.estado);

  // ── Control de nacimientos ──
  const sembReg = sembradasSegunRegistro(siembra, form.cultivo);
  const [verNac, setVerNac] = useState(() => !!(inicial && (inicial.plantasHa || inicial.nacimiento)));
  const [nac, setNac] = useState(() => ({surco: fino ? 0.175 : 0.52, metros: fino ? 1 : 10, conteos:["","",""],
    sembradas: inicial?.sembradasHa ? String(fino ? Number(inicial.sembradasHa)/10000 : inicial.sembradasHa) : (sembReg?.valor ? String(sembReg.valor) : ""),
    uniformidad:"", causas:[]}));
  const setN = c => setNac(n => ({...n, ...c}));
  const nums = nac.conteos.map(Number).filter(x => x > 0);
  const promedio = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const plHaContado = promedio != null ? promedio / (nac.metros * nac.surco) * 10000 : null;
  const plHa = plHaContado ?? (inicial?.plantasHa ? Number(inicial.plantasHa) : null);
  const sembradasHa = Number(nac.sembradas) > 0 ? (fino ? Number(nac.sembradas) * 10000 : Number(nac.sembradas)) : null;
  const logro = plHa && sembradasHa ? plHa / sembradasHa * 100 : null;
  const unidad = fino ? "pl/m²" : "pl/ha";
  const enUnidad = v => v == null ? "—" : fino ? fmtMiles(v / 10000) : fmtMiles(v);
  const cambiarEstado = v => {
    if(v === "__otro"){ setEstadoOtro(true); set({estado:""}); return; }
    setEstadoOtro(false); set({estado:v});
    if(ESTADIOS_NACIMIENTO.includes(v) && !["Pre-siembra","Rastrojo"].includes(v)) setVerNac(true);
  };

  // Botón rápido: agrega o saca el nombre de la lista del campo de texto
  const toggleSugerencia = (k, nombre) => {
    const partes = String(form[k]||"").split(",").map(x => x.trim()).filter(Boolean);
    const esta = partes.some(x => normBusca(x) === normBusca(nombre));
    set({[k]: (esta ? partes.filter(x => normBusca(x) !== normBusca(nombre)) : [...partes, nombre]).join(", ")});
  };
  const marcada = (k, n) => String(form[k]||"").split(",").some(x => normBusca(x.trim()) === normBusca(n));

  const guardar = async () => {
    setGuardando(true);
    let links = form.fotos ? String(form.fotos).split(" ").filter(Boolean) : [], fallaron = 0;
    for(const [k, ft] of fotos.entries()){
      setMsg({ok:true, txt:`Subiendo foto ${k+1} de ${fotos.length}…`});
      try { links.push(await subirFoto(await achicarFoto(ft.file), `monitoreo ${form.fecha} ${campo.nombre} ${lote.label||lote.id} ${links.length+1}.jpg`)); }
      catch { fallaron++; }
    }
    // Nacimientos: si se contó algo, se arma el detalle; si no, queda lo que ya tenía
    let nacimiento = form.nacimiento, plantasHa = form.plantasHa, sembradas = form.sembradasHa, logroTxt = form.logro;
    if(verNac && conCultivo && (plHaContado != null || sembradasHa || nac.uniformidad || nac.causas.length)){
      plantasHa = plHa != null ? String(Math.round(plHa)) : "";
      sembradas = sembradasHa ? String(Math.round(sembradasHa)) : "";
      logroTxt = logro != null ? String(Math.round(logro)) : "";
      nacimiento = [
        plHaContado != null ? `${enUnidad(plHaContado)} ${unidad} (${nums.join(", ")} pl en ${String(nac.metros).replace(".",",")} m, surco ${String(nac.surco).replace(".",",")} m)` : "",
        sembradasHa ? `sembradas ${enUnidad(sembradasHa)} ${unidad}` : "",
        logro != null ? `logro ${Math.round(logro)}%` : "",
        nac.uniformidad ? `uniformidad ${nac.uniformidad.toLowerCase()}` : "",
        nac.causas.length ? `fallas: ${nac.causas.join(", ")}` : "",
      ].filter(Boolean).join(" · ");
    }
    const m = {id: form.id || `m${Date.now().toString(36)}`, fecha:form.fecha, campo:campoId, lote:String(loteId), cultivo:form.cultivo || cvPlan,
      estado:String(form.estado).trim(), nivel:form.nivel, malezas:String(form.malezas).trim(), malezasDensidad:form.malezasDensidad, malezasTamano:form.malezasTamano,
      plagas:String(form.plagas).trim(), enfermedades:String(form.enfermedades).trim(), suelo:form.suelo, observaciones:String(form.observaciones).trim(),
      accion:String(form.accion).trim(), autor, fotos:links.join(" "), plantasHa, sembradasHa:sembradas, logro:logroTxt, nacimiento};
    setMsg({ok:true, txt:"Guardando…"});
    const ok = await monit.guardar([m]);
    fotos.forEach(ft => URL.revokeObjectURL(ft.url)); setFotos([]);
    setGuardando(false);
    const avisoFotos = fallaron ? ` ${fallaron} foto${fallaron>1?"s":""} no se pudo subir (sin señal o el Drive no respondió).` : "";
    onListo(ok ? {ok:!fallaron, txt:`✓ Monitoreo de ${campo.nombre} ${lote.label||lote.id} guardado en la planilla${links.length ? ` con ${links.length} foto${links.length>1?"s":""}` : ""}.${avisoFotos}`}
      : {ok:false, txt:`Sin conexión con la planilla: el monitoreo quedó guardado en este equipo y se sube cuando vuelva la señal.${avisoFotos}`});
  };

  const lbl = t => <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",opacity:0.6,marginBottom:3}}>{t}</div>;
  // 16px en los campos: con menos, el iPhone hace zoom al tocarlos
  const txt = {width:"100%",boxSizing:"border-box",padding:"9px 10px",fontSize:16,border:"1px solid #C8C2B0",borderRadius:7,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"};
  const chipS = a => ({padding:"7px 11px",fontSize:13,borderRadius:16,cursor:"pointer",fontFamily:"inherit",
    border:`1px solid ${a?TINTA:"#C8C2B0"}`,background:a?TINTA:"#fff",color:a?CREMA:TINTA,fontWeight:a?700:500});
  const fila2 = {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>{form.id ? "Editar monitoreo" : "🔍 Monitoreo"} · {campo.nombre} · Lote {lote.label||lote.id}</div>
        <div style={{fontSize:12.5,opacity:0.7,marginTop:2}}>{lote.ha ? `${fmt(Number(lote.ha))} ha · ` : ""}{cvPlan || "sin cultivo asignado"}
          {siembra && <> · sembrado {fechaCorta(siembra.fecha)}</>}</div>
      </div>
      <div style={fila2}>
        <div>{lbl("Fecha")}<input type="date" value={form.fecha} onChange={e=>set({fecha:e.target.value})} style={txt}/></div>
        <div>{lbl("Recorrió")}<input value={autor} onChange={e=>cambiarAutor(e.target.value)} placeholder="Tu nombre" style={txt}/></div>
      </div>
      <div>
        {lbl("Nivel")}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {Object.entries(NIVEL_MONITOREO).map(([k, n]) => (
            <button key={k} onClick={()=>set({nivel:k})} style={{padding:"9px 13px",fontSize:14,fontWeight:700,borderRadius:9,cursor:"pointer",fontFamily:"inherit",
              border:`2px solid ${form.nivel===k?n.color:"#C8C2B0"}`,background:form.nivel===k?n.fondo:"#fff",color:form.nivel===k?n.color:TINTA}}>{n.icono} {n.txt}</button>
          ))}
        </div>
      </div>
      <div style={fila2}>
        <div>{lbl("Cultivo en el lote")}
          <select value={form.cultivo} onChange={e=>{ const cv = e.target.value, fn = CULTIVOS_FINOS.includes(baseCv(cv));
            set({cultivo:cv, estado:estadoOtro || ESTADOS_SIN_CULTIVO.some(x => x[0] === form.estado) ? form.estado : ""});
            setN({surco: fn ? 0.175 : 0.52, metros: fn ? 1 : 10}); }} style={txt}>
            {!form.cultivo && <option value="">—</option>}
            {opcionesCultivo.map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div>{lbl(`Estadio (escala ${escala.nombre})`)}
          <select value={estadoOtro ? "__otro" : form.estado} onChange={e=>cambiarEstado(e.target.value)} style={txt}>
            <option value="">— elegir —</option>
            <optgroup label="Sin cultivo / sin emerger">{ESTADOS_SIN_CULTIVO.map(([c, d]) => <option key={c} value={c}>{d}</option>)}</optgroup>
            <optgroup label={`${form.cultivo || "Cultivo"} · ${escala.nombre}`}>{escala.estadios.map(([c, d]) => <option key={c} value={c}>{c === d ? c : `${c} · ${d}`}</option>)}</optgroup>
            <option value="__otro">Otro (escribir)…</option>
          </select>
          {estadoOtro && <input value={form.estado} onChange={e=>set({estado:e.target.value})} placeholder="Estadio" style={{...txt,marginTop:6}}/>}
        </div>
      </div>
      <div>{lbl("Suelo / humedad")}<select value={form.suelo} onChange={e=>set({suelo:e.target.value})} style={txt}>
        {HUMEDAD_SUELO.map(h => <option key={h} value={h}>{h || "—"}</option>)}</select></div>

      {conCultivo && (
        <div style={{border:"1.5px solid #9CC29A",borderRadius:10,background:"#F7FBF5"}}>
          <button onClick={()=>setVerNac(v => !v)} style={{width:"100%",textAlign:"left",padding:"11px 12px",fontSize:14.5,fontWeight:700,border:"none",background:"none",color:TINTA,cursor:"pointer",fontFamily:"inherit",display:"flex",justifyContent:"space-between"}}>
            <span>🌱 Control de nacimientos{plHa != null ? ` · ${enUnidad(plHa)} ${unidad}${logro != null ? ` · logro ${Math.round(logro)}%` : ""}` : ""}</span><span>{verNac ? "▴" : "▾"}</span>
          </button>
          {verNac && (
            <div style={{padding:"0 12px 12px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={fila2}>
                <div>{lbl("Distancia entre surcos")}<select value={nac.surco} onChange={e=>setN({surco:Number(e.target.value)})} style={txt}>
                  {SURCOS.map(s => <option key={s} value={s}>{Math.round(s*1000)/10} cm</option>)}</select></div>
                <div>{lbl("Metros de surco contados")}<select value={nac.metros} onChange={e=>setN({metros:Number(e.target.value)})} style={txt}>
                  {[0.5,1,2,3,5,10].map(m => <option key={m} value={m}>{String(m).replace(".",",")} m</option>)}</select></div>
              </div>
              <div>
                {lbl("Plantas contadas en cada estación")}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {nac.conteos.map((c, k) => (
                    <input key={k} value={c} inputMode="numeric" pattern="[0-9]*" placeholder={`#${k+1}`}
                      onChange={e=>setN({conteos:nac.conteos.map((x, i) => i === k ? e.target.value.replace(/\D/g,"") : x)})}
                      style={{...txt,width:64,textAlign:"center",padding:"9px 4px"}}/>
                  ))}
                  <button onClick={()=>setN({conteos:[...nac.conteos, ""]})} style={chipS(false)}>+ estación</button>
                </div>
              </div>
              <div>{lbl(`Semillas sembradas (por ${fino ? "m²" : "ha"})`)}
                <input value={nac.sembradas} inputMode="numeric" list={`sembradas-${form.cultivo}`} onChange={e=>setN({sembradas:e.target.value.replace(/[^\d]/g,"")})}
                  placeholder={fino ? "ej: 300" : "ej: 70000"} style={txt}/>
                <datalist id={`sembradas-${form.cultivo}`}>{(fino ? [200,250,300,350] : SEMBRADAS_SUGERIDAS[baseCv(form.cultivo)] || []).map(v => <option key={v} value={v}/>)}</datalist>
                {sembReg?.valor && <div style={{fontSize:11.5,opacity:0.7,marginTop:3}}>Según la siembra del {fechaCorta(siembra.fecha)}: {sembReg.sem.n} {String(sembReg.sem.d).replace(".",",")} bolsas/ha ≈ {fmtMiles(sembReg.valor)} semillas/ha</div>}
                {sembReg && !sembReg.valor && <div style={{fontSize:11.5,opacity:0.7,marginTop:3}}>En la siembra del {fechaCorta(siembra.fecha)} se cargó {sembReg.sem.n} a {fmtCant(sembReg.sem.d)}/ha: completá las semillas por {fino ? "m²" : "ha"}.</div>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,textAlign:"center"}}>
                {[["Logradas", plHa != null ? `${enUnidad(plHa)}` : "—", unidad],["Sembradas", sembradasHa ? enUnidad(sembradasHa) : "—", unidad],
                  ["Logro", logro != null ? `${Math.round(logro)}%` : "—", "nacidas / sembradas"]].map(([t, v, u]) => (
                  <div key={t} style={{background:"#fff",border:"1px solid #D5E6D3",borderRadius:8,padding:"7px 4px"}}>
                    <div style={{fontSize:10,textTransform:"uppercase",opacity:0.6,fontWeight:700}}>{t}</div>
                    <div style={{fontSize:17,fontWeight:700,color:t==="Logro"&&logro!=null?(logro>=90?"#2E7D32":logro>=75?"#8A6200":"#C0392B"):TINTA}}>{v}</div>
                    <div style={{fontSize:10,opacity:0.55}}>{u}</div>
                  </div>
                ))}
              </div>
              <div>{lbl("Uniformidad")}
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {["Buena","Regular","Mala"].map(u => <button key={u} onClick={()=>setN({uniformidad:nac.uniformidad===u?"":u})} style={chipS(nac.uniformidad===u)}>{u}</button>)}
                </div></div>
              <div>{lbl("Causas de fallas")}
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {CAUSAS_FALLA.map(c => { const a = nac.causas.includes(c); return <button key={c} onClick={()=>setN({causas:a ? nac.causas.filter(x => x !== c) : [...nac.causas, c]})} style={chipS(a)}>{c}</button>; })}
                </div></div>
              {inicial?.nacimiento && <div style={{fontSize:11.5,opacity:0.7}}>Cargado antes: {inicial.nacimiento}</div>}
            </div>
          )}
        </div>
      )}

      {[["malezas","Malezas"],["plagas","Plagas"],["enfermedades","Enfermedades"]].map(([k, t]) => (
        <div key={k}>
          {lbl(t)}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
            {SUGERENCIAS_MONITOREO[k].map(n => <button key={n} onClick={()=>toggleSugerencia(k, n)} style={chipS(marcada(k, n))}>{n}</button>)}
          </div>
          {k === "malezas" && form.malezas && (
            <div style={{...fila2,marginBottom:6}}>
              <div>{lbl("Densidad")}<select value={form.malezasDensidad} onChange={e=>set({malezasDensidad:e.target.value})} style={txt}>
                {DENSIDAD_MALEZAS.map(d => <option key={d} value={d}>{d || "—"}</option>)}</select></div>
              <div>{lbl("Tamaño")}<select value={form.malezasTamano} onChange={e=>set({malezasTamano:e.target.value})} style={txt}>
                {TAMANO_MALEZAS.map(d => <option key={d} value={d}>{d || "—"}</option>)}</select></div>
            </div>
          )}
          <input value={form[k]} onChange={e=>set({[k]:e.target.value})} placeholder={`Otra / detalle (opcional)`} style={txt}/>
        </div>
      ))}
      <div>
        {lbl("Acción sugerida")}
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
          {ACCIONES_MONITOREO.map(n => <button key={n} onClick={()=>toggleSugerencia("accion", n)} style={chipS(marcada("accion", n))}>{n}</button>)}
        </div>
        <input value={form.accion} onChange={e=>set({accion:e.target.value})} placeholder="Detalle (opcional), ej: antes del 30/10" style={txt}/>
      </div>
      <div>{lbl("Observaciones")}<textarea rows={2} value={form.observaciones} onChange={e=>set({observaciones:e.target.value})} style={{...txt,resize:"vertical"}}/></div>
      <div>
        {lbl("Fotos (se guardan en el Drive)")}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {fotos.map((ft, k) => (
            <div key={ft.url} style={{position:"relative"}}>
              <img src={ft.url} alt="" style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:"1px solid #C8C2B0"}}/>
              <button onClick={()=>{ URL.revokeObjectURL(ft.url); setFotos(fs => fs.filter((_, i) => i !== k)); }}
                style={{position:"absolute",top:-6,right:-6,width:22,height:22,borderRadius:11,border:"none",background:TINTA,color:"#fff",fontSize:12,cursor:"pointer"}}>✕</button>
            </div>
          ))}
          <label style={{padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:9,border:`1.5px dashed ${TINTA}`,cursor:"pointer"}}>
            📷 Agregar fotos
            <input type="file" accept="image/*" multiple style={{display:"none"}}
              onChange={e=>{ const fs = [...e.target.files].map(file => ({file, url:URL.createObjectURL(file)})); setFotos(x => [...x, ...fs]); e.target.value=""; }}/>
          </label>
          {form.fotos && <span style={{fontSize:12,opacity:0.7}}>ya tiene {String(form.fotos).split(" ").filter(Boolean).length} foto(s) guardada(s)</span>}
        </div>
      </div>
      {msg && <div style={{fontSize:13,fontWeight:600,color:msg.ok?"#2E7D32":"#8A6200"}}>{msg.txt}</div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={guardar} disabled={guardando} style={{padding:"12px 20px",fontSize:15,fontWeight:700,borderRadius:9,border:"none",background:"#2E7D32",color:"#fff",cursor:"pointer",fontFamily:"inherit",opacity:guardando?0.7:1}}>{guardando ? "Guardando…" : "💾 Guardar monitoreo"}</button>
        <button onClick={onCancelar} disabled={guardando} style={{padding:"12px 16px",fontSize:15,fontWeight:600,borderRadius:9,border:`1.5px solid ${TINTA}`,background:"transparent",color:TINTA,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
      </div>
    </div>
  );
}

function VistaMonitoreo({monit, lluv, cultivoDe, siembraDe, autor, cambiarAutor}){
  const [editando, setEditando] = useState(null);   // monitoreo que se está editando
  const [msg, setMsg] = useState(null);
  const [campoF, setCampoF] = useState("TODOS");
  const [nivelF, setNivelF] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const editar = m => { setEditando(m); setMsg(null); window.scrollTo({top:0, behavior:"smooth"}); };

  const palabras = normBusca(busca).split(/\s+/).filter(Boolean);
  const filtrados = monit.lista.filter(m => (campoF === "TODOS" || m.campo === campoF) && (nivelF === "TODOS" || m.nivel === nivelF)
    && (!palabras.length || palabras.every(w => normBusca(Object.values(m).join(" ")).includes(w))));
  // Último monitoreo de cada lote, para el resumen de arriba
  const ultimos = [];
  monit.lista.filter(m => campoF === "TODOS" || m.campo === campoF).forEach(m => { if(!ultimos.some(u => u.campo === m.campo && u.lote === m.lote)) ultimos.push(m); });
  const conAlerta = ultimos.filter(m => m.nivel === "urgente" || m.nivel === "atencion");
  const fFecha = s => { const d = fechaLocal(s); return d ? ddmm(d) : s; };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:12.5,opacity:0.75}}>
        Para cargar un monitoreo: <b>🗺️ Mapa por campo</b> → elegí el campo → tocá el lote → <b>🔍 Monitorear este lote</b>.
        Se guardan en la hoja <b>monitoreo</b> de la planilla LABORES S-MIX 26-27 (Drive).
        {monit.sync.estado==="error" && <span style={{color:"#C0392B"}}> No se pudo leer la planilla{monit.sync.txt ? ` (${monit.sync.txt})` : ""}.</span>}
      </div>
      {monit.sinSubir > 0 && (
        <div style={{...cajaV,borderColor:"#C9A227",background:"#FFF8E6",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",padding:"10px 14px"}}>
          <span style={{fontSize:13}}>📵 {monit.sinSubir} monitoreo{monit.sinSubir>1?"s":""} guardado{monit.sinSubir>1?"s":""} en este equipo, sin subir a la planilla.</span>
          <button onClick={monit.reintentar} style={{...chipV(false),padding:"5px 12px"}}>Subir ahora</button>
        </div>
      )}
      {msg && <div style={{fontSize:13,fontWeight:600,padding:"9px 12px",borderRadius:8,background:msg.ok?"#E8F5E9":"#FFF6DD",color:msg.ok?"#2E7D32":"#8A6200"}}>{msg.txt}</div>}

      {editando && (
        <div style={cajaV}>
          <FormMonitoreo key={editando.id} monit={monit} campoId={editando.campo} loteId={editando.lote} cultivoDe={cultivoDe} siembraDe={siembraDe} autor={autor} cambiarAutor={cambiarAutor}
            inicial={editando} onListo={m => { setMsg(m); setEditando(null); }} onCancelar={() => setEditando(null)}/>
        </div>
      )}

      <SeccionLluvias lluv={lluv} autor={autor}/>

      {conAlerta.length > 0 && (
        <div style={cajaV}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Lotes con alerta en su último monitoreo</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {conAlerta.map(m => { const n = NIVEL_MONITOREO[m.nivel]; return (
              <span key={m.id} style={{fontSize:12.5,border:`1px solid ${n.color}55`,background:n.fondo,color:n.color,borderRadius:7,padding:"3px 9px",fontWeight:600}}>
                {n.icono} {nombreCampo(m.campo)} {m.lote} · {fFecha(m.fecha)}{m.malezas||m.plagas ? ` · ${[m.malezas, m.plagas].filter(Boolean).join(", ")}` : ""}
              </span>
            );})}
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <select value={campoF} onChange={e=>setCampoF(e.target.value)} style={selectV}>
          <option value="TODOS">Todos los campos</option>
          {CAMPOS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={nivelF} onChange={e=>setNivelF(e.target.value)} style={selectV}>
          <option value="TODOS">Todos los niveles</option>
          {Object.entries(NIVEL_MONITOREO).map(([k, n]) => <option key={k} value={k}>{n.icono} {n.txt}</option>)}
        </select>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar (ej: rama negra, lote 5)" style={{...selectV,fontWeight:400,flex:"1 1 180px",minWidth:0}}/>
      </div>

      {monit.sync.estado==="cargando" && !monit.lista.length && <div style={{...cajaV,textAlign:"center",opacity:0.6}}>Cargando monitoreos…</div>}
      {monit.sync.estado!=="cargando" && !filtrados.length && <div style={{...cajaV,textAlign:"center",opacity:0.7}}>Todavía no hay monitoreos{campoF!=="TODOS"||nivelF!=="TODOS"||busca ? " con estos filtros" : ""}.</div>}
      {filtrados.map(m => { const n = NIVEL_MONITOREO[m.nivel] || NIVEL_MONITOREO.ok; return (
        <div key={m.id} style={{...cajaV,borderLeft:`6px solid ${n.color}`,padding:"11px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontWeight:700}}>{fFecha(m.fecha)}</span>
              <span style={{fontSize:15,fontWeight:700}}>{nombreCampo(m.campo)} · Lote {m.lote}</span>
              {m.cultivo && <span style={{fontSize:11.5,display:"inline-flex",alignItems:"center",gap:4,border:"1px solid #C8C2B0",borderRadius:6,padding:"1px 7px",background:"#fff"}}>
                <span style={{width:8,height:8,borderRadius:2,background:colorCv(m.cultivo)}}/>{m.cultivo}</span>}
              {m.estado && <span style={{fontSize:12,opacity:0.75}}>{m.estado}</span>}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:700,color:n.color,background:n.fondo,borderRadius:5,padding:"2px 8px"}}>{n.icono} {n.txt}</span>
              {m.sinSubir && <span title="Guardado en este equipo, falta subirlo a la planilla" style={{fontSize:11,color:"#8A6200"}}>📵 sin subir</span>}
            </div>
          </div>
          <div style={{fontSize:12.5,marginTop:6,display:"flex",flexDirection:"column",gap:2}}>
            {m.malezas && <div><b>Malezas:</b> {m.malezas}{[m.malezasDensidad, m.malezasTamano].filter(Boolean).length ? ` (${[m.malezasDensidad, m.malezasTamano].filter(Boolean).join(", ").toLowerCase()})` : ""}</div>}
            {m.nacimiento && <div><b>🌱 Nacimientos:</b> {m.nacimiento}</div>}
            {m.plagas && <div><b>Plagas:</b> {m.plagas}</div>}
            {m.enfermedades && <div><b>Enfermedades:</b> {m.enfermedades}</div>}
            {m.suelo && <div><b>Suelo:</b> {m.suelo}</div>}
            {m.observaciones && <div><b>Observaciones:</b> {m.observaciones}</div>}
            {m.accion && <div style={{color:"#1E5FA8"}}><b>Acción sugerida:</b> {m.accion}</div>}
            {m.fotos && <div><b>Fotos:</b> {m.fotos.split(" ").filter(Boolean).map((l, k) => <a key={l} href={l} target="_blank" rel="noreferrer" style={{color:"#1E5FA8",fontWeight:600,marginRight:8}}>📷 {k+1}</a>)}</div>}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:8,fontSize:11.5,opacity:0.8,flexWrap:"wrap"}}>
            <span>{m.autor ? `Recorrió: ${m.autor}` : ""}</span>
            <span style={{display:"flex",gap:10}}>
              <button onClick={()=>editar(m)} style={{border:"none",background:"none",padding:0,color:"#1E5FA8",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Editar</button>
              <button onClick={()=>{ if(window.confirm(`¿Borrar el monitoreo de ${nombreCampo(m.campo)} ${m.lote} del ${fFecha(m.fecha)}?`)) monit.borrar(m.id); }}
                style={{border:"none",background:"none",padding:0,color:"#C0392B",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Borrar</button>
            </span>
          </div>
        </div>
      );})}
    </div>
  );
}

export default function App(){
  // ── DATOS DINÁMICOS: cargados desde /datos.json (pipeline automático) ──
  const [datosOK, setDatosOK] = useState(null); // null=cargando, true=cargado, false=falló
  const [datosRemotos, setDatosRemotos] = useState(null);
  const [fechaDatos, setFechaDatos] = useState(null);

  useEffect(() => {
    fetch("/datos.json?t=" + Date.now(), {cache: "no-store"})
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
    datosRemotos.APLICACIONES.map((a,i)=>{
      // Blindaje: el pipeline a veces escribe "produtos" y puede faltar costo o ha
      const ES_LABOR = /^(PULVERIZADA|INCORPORADA|VOLEADA|PARATIL|RASTRA|ROLOS|SIEMBRA|SG\b|MZ PP|SJ PP|GR PP|SJ 2DA|MZ FERT|GR FERT|SJ FERT|FINA FERT)/i;
      const bruta = Array.isArray(a.productos) ? a.productos
        : Array.isArray(a.produtos) ? a.produtos
        : (typeof a.productos === "string" ? [a.productos] : []);
      const labor = a.labor || bruta.find(p => ES_LABOR.test(String(p).trim())) || "";
      const productos = bruta.filter(p => !ES_LABOR.test(String(p).trim()));
      const ha = Number(a.ha) || 0;
      const costo = Number(a.costo) || 0;
      return {...a, id:i, productos, labor, ha, costo, costoHa: ha ? costo/ha : 0};
    }).sort((a,b)=>fechaLocal(b.fecha)-fechaLocal(a.fecha))
    : APLICACIONES_FALLBACK;
  const FERTILIZACIONES = datosRemotos?.FERTILIZACIONES ?
    datosRemotos.FERTILIZACIONES.map((f,i)=>({...f,id:i})).sort((a,b)=>fechaLocal(b.fecha)-fechaLocal(a.fecha))
    : FERTILIZACIONES_FALLBACK;

  const [vista,setVista]=useState("mapas");        // mapas | galeria | realizadas | pendientes | monitoreo | ordenes | margenes | protocolo | precios
  const [campoSel,setCampoSel]=useState("L3H");
  const [capaModo,setCapaModo]=useState("campaña"); // campaña|rindes|margenes|suelos
  const [cultivoFiltro,setCultivoFiltro]=useState(null); // null = sin filtro; "MAIZ", "SOJA", etc.
  const [sueloVar,setSueloVar]=useState("P");
  const [pintura,setPintura]=useState({});
  const [brocha,setBrocha]=useState(0);
  const [etiquetas,setEtiquetas]=useState(["","","",""]);
  const [titulos,setTitulos]=useState({});
  const [loteAbierto,setLoteAbierto]=useState(null); // {campo, lote} para modal historial

  // === Estado del generador de órdenes ===
  const [ordFecha, setOrdFecha] = useState(new Date().toISOString().split("T")[0]);
  const [ordProductor, setOrdProductor] = useState("");
  // Divisiones efímeras de lotes (solo dentro de esta orden)
  // { "CAMPO|LOTE": [{id, nombre, poly, ha}] }
  const [divisiones, setDivisiones] = useState({});

  // ── Borradores de órdenes (se guardan en este dispositivo, 10 días) ──
  const PROD_KEY = "smix_productos_propios_v1";
  const RECE_KEY = "smix_recetas_propias_v1";
  const [productosPropios, setProductosPropios] = useState([]);
  const [recetasPropias, setRecetasPropias] = useState([]);
  const [formProd, setFormProd] = useState(null);   // {fila} cuando se está agregando
  const [nuevoProd, setNuevoProd] = useState({n:"", u:"L", p:"", cat:"HER"});
  const [nombreReceta, setNombreReceta] = useState("");

  const leerJSON = (k) => { try { return JSON.parse(window.localStorage.getItem(k)) || []; } catch { return []; } };
  const guardarJSON = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  useEffect(() => {
    setProductosPropios(leerJSON(PROD_KEY));
    setRecetasPropias(leerJSON(RECE_KEY));
  }, []);

  const BORR_KEY = "smix_borradores_v1";
  const DIAS_BORRADOR = 10;
  const [ordId, setOrdId] = useState(() => `o${Date.now()}`);
  const [borradores, setBorradores] = useState([]);
  const [panelBorr, setPanelBorr] = useState(false);
  const [autor, setAutor] = useState(() => { try { return window.localStorage.getItem("smix_autor") || ""; } catch { return ""; } });
  const [sincro, setSincro] = useState({estado:"", txt:""});   // estado: ok | error | subiendo
  const cambiarAutor = (v) => { setAutor(v); try { window.localStorage.setItem("smix_autor", v); } catch {} };
  const monit = useMonitoreos();
  const [pideClave, setPideClave] = useState(false);
  const [claveIngresada, setClaveIngresada] = useState("");
  useEffect(() => { const f = () => setPideClave(true); window.addEventListener("smix-clave", f); return () => window.removeEventListener("smix-clave", f); }, []);
  const lluv = useLluvias();

  const leerBorradores = () => {
    try {
      const crudo = window.localStorage.getItem(BORR_KEY);
      if (!crudo) return [];
      const lista = JSON.parse(crudo);
      const corte = Date.now() - DIAS_BORRADOR*24*60*60*1000;
      return lista.filter(b => (b.guardado||0) > corte);
    } catch { return []; }
  };
  const escribirBorradores = (lista) => {
    try { window.localStorage.setItem(BORR_KEY, JSON.stringify(lista)); } catch {}
    setBorradores(lista);
  };

  // Borradores compartidos: se guardan también en la hoja "borradores" de la planilla,
  // así los ve cualquiera de los dos. El localStorage queda como copia local y respaldo
  // si la app está sin señal.
  const subirBorrador = async (item) => {
    try {
      setSincro({estado:"subiendo", txt:"guardando…"});
      const r = await fetch("/api/borradores", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: item.id, autor: item.autor || autor, pdf: item.pdf || "",
          titulo: `${item.productor || "sin productor"} · ${item.resumen?.ha || 0} ha`,
          datos: item,
        }),
      });
      if(!r.ok) throw new Error((await r.json()).error || "error");
      setSincro({estado:"ok", txt:"guardado para los dos"});
    } catch (e) {
      setSincro({estado:"error", txt:"solo en este equipo"});
    }
  };

  const bajarBorradores = async () => {
    try {
      const r = await fetch("/api/borradores");
      if(!r.ok) throw new Error("error");
      const { borradores: remotos } = await r.json();
      const locales = leerBorradores();
      const mapa = new Map();
      [...locales, ...(remotos||[]).map(b => ({...(b.datos||{}), id:b.id, autor:b.autor, pdf:b.pdf}))]
        .forEach(b => {
          const previo = mapa.get(b.id);
          if(!previo || (b.guardado||0) > (previo.guardado||0)) mapa.set(b.id, b);
        });
      const lista = [...mapa.values()].sort((a,b)=>(b.guardado||0)-(a.guardado||0)).slice(0,60);
      escribirBorradores(lista);
      setSincro({estado:"ok", txt:"al día"});
    } catch {
      escribirBorradores(leerBorradores());
      setSincro({estado:"error", txt:"sin conexión con la planilla"});
    }
  };

  // Cargar al iniciar (y purgar los vencidos)
  useEffect(() => { bajarBorradores(); }, []);

  // ── Protocolo y precios: compartidos en la planilla, con copia local por si no hay señal ──
  const [protocolo, guardarProtocolo, protoSync] = useDocCompartido("protocolo", PROTOCOLO_BASE, d => !!d && Array.isArray(d.cultivos), autor);
  const [precios, guardarPrecios, preciosSync] = useDocCompartido("precios", PRECIOS_BASE, d => !!d && !!d.precios && typeof d.precios === "object", autor);
  // Registro de labores con la dosis de cada producto (lo publica el pipeline desde la hoja "registro")
  const aplicacionesConDosis = useMemo(() => {
    const reg = datosRemotos?.REGISTRO;
    if(!Array.isArray(reg) || !reg.length) return null;
    return reg.map((r, i) => ({...r, id:`r${i}`, productos:(r.productos||[]).map(p => p.n), items:r.productos||[]}));
  }, [datosRemotos]);
  // Última siembra registrada de cada lote (para el control de nacimientos del monitoreo)
  const siembraDe = useMemo(() => (campoId, loteId) => (datosRemotos?.REGISTRO || [])
    .filter(r => r.campo === campoId && refApuntaALote(r.lote, loteId) && clasificarLabor(r.labor, (r.productos||[]).map(p => p.n)) === "siembra")
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null, [datosRemotos]);
  // Cultivo 26-27 de cada lote: el plan, y si no está, la rotación histórica
  const cultivoDe = useMemo(() => (campoId, loteId) =>
    buscarKey(PLAN_2627, campoId, loteId) || (buscarKey(HISTORICO_ROTACION, campoId, loteId) || {})["26-27"]?.cv || "",
    [PLAN_2627, HISTORICO_ROTACION]);
  // Capa "Residuales" del mapa (se calcula sólo cuando está elegida)
  const residualesMapa = useMemo(() => capaModo === "residuales"
    ? residualesParaMapa(protocolo, CAMPOS, cultivoDe, aplicacionesConDosis || APLICACIONES, (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })(), lluv.lista)
    : null, [capaModo, protocolo, cultivoDe, aplicacionesConDosis, datosRemotos, lluv.lista]);
  const [modoDividir, setModoDividir] = useState(false);
  const [loteDiv, setLoteDiv] = useState(null);       // {campoId, loteId} en edición
  const [puntosCorte, setPuntosCorte] = useState([]); // [[x,y],[x,y]]
  const [ordCultivo, setOrdCultivo] = useState("cebada");
  const [ordTipo, setOrdTipo] = useState("PULVERIZADA TERRESTRE"); // tipo de labor GLOBAL
  // 4 tratamientos, uno por color. Cada uno con su etiqueta, cultivo y tabla de 10 filas.
  const [tratamientos, setTratamientos] = useState(
    Array(COLORES_APP.length).fill(null).map(() => ({
      etiqueta: "",
      cultivo: "",
      productos: Array(10).fill(null).map(() => ({n:"", d:0})),
    }))
  );

  const svgRef=useRef(null);

  const abrirLote=(campo,lote)=>setLoteAbierto({campo,lote});
  const cerrarLote=()=>setLoteAbierto(null);

  // Cultivos que tiene un lote en 26-27 (puede ser 1 o 2 si es doble cultivo)
  const cultivosDeLote=(campoId,loteId)=>{
    const inv=buscarKey(INV_26, campoId, loteId), plan=buscarKey(PLAN_2627, campoId, loteId);
    const set=new Set();
    cvPartes(inv).forEach(p=>set.add(p));
    cvPartes(plan).forEach(p=>set.add(p));
    return [...set].filter(Boolean);
  };
  // Lista de todos los cultivos presentes en 26-27 (para el selector de filtro)
  const cultivosDisponibles=useMemo(()=>{
    const set=new Set();
    CAMPOS.forEach(c=>c.lotes.forEach(l=>cultivosDeLote(c.id,l.id).forEach(cv=>set.add(cv))));
    return [...set].sort();
  },[INV_26,PLAN_2627]);
  // Agrupa lotes por el cultivo filtrado: [{campo, lote, ha, cultivosLote}]
  const lotesDelCultivo=useMemo(()=>{
    if(!cultivoFiltro) return [];
    const res=[];
    CAMPOS.forEach(c=>c.lotes.forEach(l=>{
      const cvs=cultivosDeLote(c.id,l.id);
      if(cvs.includes(cultivoFiltro)) res.push({campo:c,lote:l,ha:Number(l.ha)||0,cvs});
    }));
    return res.sort((a,b)=>b.ha-a.ha);
  },[cultivoFiltro,INV_26,PLAN_2627]);

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

  // Unidades pintables de un campo: lotes enteros, o sus sectores si está dividido
  const unidadesDe = (cid) => {
    const out = [];
    lotesDe(cid).forEach(l => {
      const secs = divisiones[clL(cid, l.id)];
      if (secs && secs.length) {
        secs.forEach(s => out.push({
          key: `${cid}|${l.id}#${s.id}`,
          loteId: l.id, secId: s.id, nombre: s.nombre,
          label: `${l.label||l.id} ${s.nombre}`.trim(),
          ha: Number(s.ha)||0, poly: s.poly, dividido: true,
        }));
      } else {
        out.push({
          key: clL(cid, l.id),
          loteId: l.id, secId: null, nombre: "",
          label: l.label||l.id,
          ha: Number(l.ha)||0, poly: l.poly, dividido: false,
        });
      }
    });
    return out;
  };
  const haCol=(cid,i)=>unidadesDe(cid).filter(u=>pintura[u.key]===i).reduce((s,u)=>s+u.ha,0);
  const haPint=cid=>COLORES_APP.reduce((s,_,i)=>s+haCol(cid,i),0);
  const colEn=COLORES_APP.map((_,i)=>i).filter(i=>unidadesDe(campoSel).some(u=>pintura[u.key]===i));
  const tit=titulos[campoSel]??"Orden de aplicación";
  const campoOrd=CAMPOS.find(c=>c.id===campoSel);
  // Lotes pintados en un tratamiento cuyo cultivo no coincide con el del tratamiento
  const conflictosCultivo = (tratIdx) => {
    const cvTrat = (tratamientos[tratIdx]?.cultivo || "").trim().toUpperCase();
    if (!cvTrat) return [];
    const out = [];
    CAMPOS.forEach(c => unidadesDe(c.id).forEach(u => {
      if (pintura[u.key] !== tratIdx) return;
      const cvs = cultivosDeLote(c.id, u.loteId);
      if (cvs.length === 0) return;                 // lote sin cultivo cargado: no molestamos
      if (!cvs.includes(cvTrat)) out.push({campo:c.nombre, lote:u.label, cultivos:cvs});
    }));
    return out;
  };

  const [avisoCultivo, setAvisoCultivo] = useState(null);

  const pintarL=(lid, unidadKey)=>{
    const k2 = unidadKey || clL(campoSel,lid);
    const yaEstaba = pintura[k2] === brocha;

    // Al pintar (no al despintar): avisar si el cultivo del lote no es el del tratamiento
    if (!yaEstaba) {
      const cvTrat = (tratamientos[brocha]?.cultivo || "").trim().toUpperCase();
      const cvs = cultivosDeLote(campoSel, lid);
      if (cvTrat && cvs.length > 0 && !cvs.includes(cvTrat)) {
        const l = lotesDe(campoSel).find(x => x.id === lid);
        setAvisoCultivo({
          lote: l?.label || lid,
          campo: CAMPOS.find(c=>c.id===campoSel)?.nombre || campoSel,
          cultivoLote: cvs.join(" / "),
          cultivoTrat: cvTrat,
          trat: brocha + 1,
        });
        return;   // no lo pinta
      }
    }

    setPintura(p=>{const n={...p};if(n[k2]===brocha)delete n[k2];else n[k2]=brocha;return n;});
    setAvisoCultivo(null);
    // Autocompletar cultivo del tratamiento activo si está vacío
    setTratamientos(ts => ts.map((t, i) => {
      if(i !== brocha) return t;
      if(t.cultivo && t.cultivo.trim() !== "") return t; // ya tiene cultivo, no pisar
      // Buscar cultivo del lote pintado en los datos de rotación
      const cvs = cultivosDeLote(campoSel, lid);
      if(cvs.length === 0) return t;
      // Priorizar cultivo más representativo: si hay uno solo lo ponemos, si hay dos elegimos el grueso
      const GRUESAS = ["MAIZ","SOJA","GIRASOL","SORGO","MANI"];
      const grueso = cvs.find(cv => GRUESAS.includes(cv.toUpperCase()));
      const cvAuto = grueso || cvs[0];
      return {...t, cultivo: cvAuto.toLowerCase()};
    }));
  };
  const limpiarOrd=()=>setPintura(p=>{const n={...p};unidadesDe(campoSel).forEach(u=>delete n[u.key]);return n;});

  // === Órdenes: helpers ===
  // Lotes pintados agrupados por campo Y por tratamiento (color)
  const lotesPintadosPorCampo = () => {
    const acc = {};
    CAMPOS.forEach(c => {
      const pintados = unidadesDe(c.id).filter(u => pintura[u.key] !== undefined);
      if (pintados.length > 0) {
        acc[c.id] = pintados.map(u => ({loteId: u.loteId, label: u.label, ha: u.ha, colorIdx: pintura[u.key], key: u.key}));
      }
    });
    return acc;
  };
  // Total ha de un tratamiento específico
  const haTratamiento = (tratIdx) => {
    let total = 0;
    CAMPOS.forEach(c => {
      unidadesDe(c.id).forEach(u => { if(pintura[u.key] === tratIdx) total += u.ha; });
    });
    return total;
  };
  const haTotalOrden = () => COLORES_APP.reduce((s,_,i) => s + haTratamiento(i), 0);

  // ── Guardado automático del borrador en curso ──
  const resumenOrden = () => {
    const ha = haTotalOrden();
    const trats = tratamientos
      .map((t,i) => ({...t, i, ha: haTratamiento(i)}))
      .filter(t => t.ha > 0 && t.productos.some(p => p.n && p.d > 0));
    const campos = [...new Set(
      CAMPOS.flatMap(c => unidadesDe(c.id).filter(u => pintura[u.key] !== undefined).map(() => c.nombre))
    )];
    return { ha, nTrats: trats.length, campos,
      etiquetas: trats.map(t => t.etiqueta || `T${t.i+1}`) };
  };

  useEffect(() => {
    const r = resumenOrden();
    const hayAlgo = r.ha > 0 || tratamientos.some(t => t.productos.some(p => p.n));
    if (!hayAlgo) return;
    const t = setTimeout(() => {
      const previo = leerBorradores().find(b => b.id === ordId) || {};
      const item = {
        id: ordId, guardado: Date.now(), autor: autor || previo.autor || "", pdf: previo.pdf || "",
        fecha: ordFecha, productor: ordProductor, tipo: ordTipo,
        tratamientos, pintura, divisiones,
        resumen: { ha: r.ha, nTrats: r.nTrats, campos: r.campos, etiquetas: r.etiquetas },
      };
      const lista = leerBorradores().filter(b => b.id !== ordId);
      escribirBorradores([item, ...lista].slice(0, 60));
      subirBorrador(item);
    }, 800);
    return () => clearTimeout(t);
  }, [ordId, ordFecha, ordProductor, ordTipo, tratamientos, pintura, divisiones, autor]);

  const cargarBorrador = (b) => {
    setOrdId(b.id);
    setOrdFecha(b.fecha || new Date().toISOString().split("T")[0]);
    setOrdProductor(b.productor || "");
    setOrdTipo(b.tipo || "PULVERIZADA TERRESTRE");
    // Un borrador viejo puede tener menos tratamientos que los actuales
    const vacio = () => ({etiqueta:"", cultivo:"", productos: Array(10).fill(null).map(() => ({n:"", d:0}))});
    const ts = [...(b.tratamientos || [])];
    while (ts.length < COLORES_APP.length) ts.push(vacio());
    setTratamientos(ts.slice(0, COLORES_APP.length));
    setPintura(b.pintura || {});
    setDivisiones(b.divisiones || {});
    setModoDividir(false); setLoteDiv(null); setPuntosCorte([]);
    setPanelBorr(false);
    setGuardadoMsg(null);
  };

  const borrarBorrador = (id) => {
    escribirBorradores(leerBorradores().filter(b => b.id !== id));
    fetch("/api/borradores", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({id, borrar:true})}).catch(()=>{});
  };

  const nuevaOrden = () => {
    setOrdId(`o${Date.now()}`);
    setPintura({}); setDivisiones({});
    setTratamientos(Array(COLORES_APP.length).fill(null).map(() => ({
      etiqueta: "", cultivo: "", productos: Array(10).fill(null).map(() => ({n:"", d:0})),
    })));
    setOrdProductor(""); setOrdFecha(new Date().toISOString().split("T")[0]);
    setModoDividir(false); setLoteDiv(null); setPuntosCorte([]);
    setGuardadoMsg(null); setPanelBorr(false);
  };

  // "Armar orden" desde Labores pendientes: orden nueva con el lote pintado y los residuales que tocan,
  // con el producto que más se usó y su última dosis (el resto de la mezcla se agrega a mano)
  const armarOrdenDesde = (f, p) => {
    const sugeridos = queAplicar(p).map(a => sugerirProducto(a, p.paso.mezcla, aplicacionesConDosis, TODOS_PRODUCTOS));
    const partes = cvPartes(f.cv).map(baseCv);
    const cv = p.prot.id === "fina" ? partes[0] : partes[partes.length - 1];
    nuevaOrden();
    setOrdTipo("PULVERIZADA TERRESTRE");
    setCampoSel(f.campo.id);
    setBrocha(0);
    setPintura({[clL(f.campo.id, f.lote.id)]: 0});
    setTratamientos(ts => ts.map((t, i) => i !== 0 ? t : {...t, etiqueta:"", cultivo: CULTIVOS_ORDEN.includes(cv) ? cv : "",
      productos: Array(10).fill(null).map((_, k) => { const s = sugeridos[k];
        return s ? {n:s.n, d:s.d || 0, dTexto: s.d != null ? String(s.d).replace(".", ",") : "", u:s.u, p:s.p, prov:s.prov} : {n:"", d:0}; })}));
    setVista("ordenes");
    window.scrollTo({top:0});
  };

  const fechaBorrador = (ms) => {
    const d = new Date(ms), h = new Date();
    const mismoDia = d.toDateString() === h.toDateString();
    const ayer = new Date(h.getTime()-86400000).toDateString() === d.toDateString();
    const hora = d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    if (mismoDia) return `hoy ${hora}`;
    if (ayer) return `ayer ${hora}`;
    return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}) + " " + hora;
  };

  // ── Dividir lotes (efímero, solo esta orden) ──────────────
  const loteObj = (cid, lid) => lotesDe(cid).find(l => l.id === lid);

  // Aplica un corte recto entre dos puntos al lote en edición
  // Aplica el corte a los sectores que ya existan: cada corte nuevo suma una parcela.
  // El primer pedazo conserva el id del sector (así no se pierde lo pintado).
  const aplicarCorte = (a, b) => {
    if(!loteDiv) return;
    const l = loteObj(loteDiv.campoId, loteDiv.loteId);
    if(!l) return;
    const k = clL(loteDiv.campoId, loteDiv.loteId);
    const haTot = Number(l.ha)||0;
    const previas = divisiones[k];

    // Primer corte: el lote entero en dos
    if(!previas || !previas.length){
      const partes = cortarPoligono(l.poly, a, b);
      if(!partes){ setPuntosCorte([]); return; }
      const [pa, pb] = partes;
      const aa = areaPoly(pa), ab = areaPoly(pb);
      const ha1 = Math.round(haTot * aa/(aa+ab));
      setDivisiones(d => ({...d, [k]: [
        {id:"a", nombre:"sector 1", poly:pa, ha:ha1},
        {id:"b", nombre:"sector 2", poly:pb, ha:haTot-ha1},
      ]}));
      setPuntosCorte([]);
      return;
    }

    // Cortes siguientes: parte cada sector que la línea cruce
    const usados = new Set(previas.map(s=>s.id));
    const nuevoId = () => {
      for(let i=0;i<40;i++){ const id = String.fromCharCode(97+i); if(!usados.has(id)){ usados.add(id); return id; } }
      return "s"+Date.now();
    };
    let cortoAlguno = false;
    const salida = [];
    previas.forEach(s => {
      const partes = s.anillo ? null : cortarPoligono(s.poly, a, b);
      if(!partes){ salida.push(s); return; }
      cortoAlguno = true;
      const [pa, pb] = partes;
      const aa = areaPoly(pa), ab = areaPoly(pb);
      const haS = Number(s.ha)||0;
      const ha1 = Math.round(haS * aa/(aa+ab) * 10)/10;
      salida.push({...s, poly:pa, ha:ha1});
      salida.push({id:nuevoId(), nombre:"parcela", poly:pb, ha:Math.round((haS-ha1)*10)/10});
    });
    if(!cortoAlguno){ setPuntosCorte([]); return; }
    // Renombra las que quedaron con nombre automático, de arriba hacia abajo
    let nro = 0;
    const final = salida.map(s => {
      const auto = /^(sector|parcela)( \d+)?$/.test(s.nombre||"");
      nro += 1;
      return auto ? {...s, nombre:`parcela ${nro}`} : s;
    });
    setDivisiones(d => ({...d, [k]: final}));
    setPuntosCorte([]);
  };

  // Cabecera: anillo perimetral + centro
  const aplicarCabecera = (fracPct) => {
    if(!loteDiv) return;
    const l = loteObj(loteDiv.campoId, loteDiv.loteId);
    if(!l) return;
    const frac = Math.min(0.8, Math.max(0.02, fracPct/100));
    const [ext, dentro] = anilloPerimetral(l.poly, frac);
    const haTot = Number(l.ha)||0;
    const haCab = Math.round(haTot*frac);
    setDivisiones(d => ({...d, [clL(loteDiv.campoId, loteDiv.loteId)]: [
      {id:"cab", nombre:"cabecera", poly:ext, ha:haCab, anillo:true},
      {id:"cen", nombre:"sin cabecera", poly:dentro, ha:haTot-haCab},
    ]}));
    setPuntosCorte([]);
  };

  const quitarDivision = (cid, lid) => {
    const k = clL(cid, lid);
    setDivisiones(d => { const n={...d}; delete n[k]; return n; });
    setPintura(p => { const n={...p};
      Object.keys(n).forEach(kk => { if(kk.startsWith(k+"#")) delete n[kk]; });
      return n; });
  };

  const updateSector = (cid, lid, secId, campoK, valor) => {
    const k = clL(cid, lid);
    setDivisiones(d => {
      const secs = (d[k]||[]).map(s => s.id===secId
        ? {...s, [campoK]: campoK==="ha" ? (parseFloat(String(valor).replace(",","."))||0) : valor}
        : s);
      return {...d, [k]: secs};
    });
  };

  // Suma de ha de los sectores vs ha del lote (para avisar descuadres)
  const chequeoDivision = (cid, lid) => {
    const secs = divisiones[clL(cid,lid)];
    if(!secs) return null;
    const l = loteObj(cid,lid);
    const suma = secs.reduce((s,x)=>s+(Number(x.ha)||0),0);
    return {suma, total:Number(l?.ha)||0, ok: Math.abs(suma-(Number(l?.ha)||0)) < 0.5};
  };

  // Convierte coordenadas de pantalla a coordenadas del viewBox del SVG
  const puntoSVG = (evt, svgEl) => {
    if(!svgEl) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const ctm = svgEl.getScreenCTM();
    if(!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  const updateFila = (tratIdx, filaIdx, campoK, valor, producto) => {
    setTratamientos(ts => ts.map((t, ti) => {
      if(ti !== tratIdx) return t;
      return {
        ...t,
        productos: t.productos.map((p, pi) => {
          if(pi !== filaIdx) return p;
          if(campoK === "n") {
            const base = producto || TODOS_PRODUCTOS.find(pr => pr.n === valor);
            return {n: valor, d: p.d, u: base?.u||"L", p: base?.p||0};
          }
          if(campoK === "d") {
            // Guardamos el texto crudo para que el input pueda mostrar "0," mientras se tipea
            const dNum = parseFloat((valor||"").toString().replace(",","."));
            return {...p, d: isNaN(dNum) ? 0 : dNum, dTexto: valor};
          }
          return p;
        }),
      };
    }));
  };
  const updateEtiquetaTrat = (tratIdx, etq) => setTratamientos(ts => ts.map((t,i) => i===tratIdx ? {...t, etiqueta: etq} : t));
  const updateCultivoTrat = (tratIdx, cv) => setTratamientos(ts => ts.map((t,i) => i===tratIdx ? {...t, cultivo: cv} : t));
  const aplicarRecetaAlTrat = (tratIdx, receta) => {
    const filas = Array(10).fill(null).map(() => ({n:"", d:0}));
    receta.productos.forEach((rp, i) => {
      if(i >= 10) return;
      const base = TODOS_PRODUCTOS.find(p => p.n === rp.n);
      filas[i] = {n: rp.n, d: rp.d, dTexto: String(rp.d), u: base?.u||"L", p: base?.p||0, prov: base?.prov||""};
    });
    setTratamientos(ts => ts.map((t,i) => i===tratIdx ? {...t, productos: filas} : t));
  };
  const limpiarTratamiento = (tratIdx) => {
    // Limpia productos de un tratamiento Y despinta sus lotes
    setTratamientos(ts => ts.map((t,i) => i===tratIdx
      ? {etiqueta: "", cultivo: "", productos: Array(10).fill(null).map(() => ({n:"", d:0}))}
      : t
    ));
    setPintura(p => {
      const n = {...p};
      Object.keys(n).forEach(k => { if(n[k] === tratIdx) delete n[k]; });
      return n;
    });
  };
  const limpiarOrdenCompleta = () => {
    setPintura({});
    setDivisiones({});
    setLoteDiv(null);
    setPuntosCorte([]);
    setModoDividir(false);
    setTratamientos(Array(COLORES_APP.length).fill(null).map(() => ({
      etiqueta: "",
      cultivo: "",
      productos: Array(10).fill(null).map(() => ({n:"", d:0})),
    })));
  };

  // Productos filtrados según tipo de labor GLOBAL (contexto)
  const categoriaDelTipo = (tipo) => {
    if(tipo === "PULVERIZADA TERRESTRE" || tipo === "PULVERIZADA AEREA") return ["HER","INS","FUN","COAD"];
    if(tipo === "SIEMBRA") return ["SEM","FERT","SGR"];
    if(tipo === "VOLEADA" || tipo === "INCORPORADA") return ["FERT"];
    return ["HER","INS","FUN","COAD","FERT","SEM","SGR"];
  };
  // Catálogo con los precios editados en la pestaña Precios
  const TODOS_PRODUCTOS = [...PRODUCTOS_BASE, ...productosPropios]
    .map(p => precios.precios?.[p.n] != null ? {...p, p: precios.precios[p.n]} : p);
  const productosDisponibles = TODOS_PRODUCTOS.filter(p => categoriaDelTipo(ordTipo).includes(p.cat));

  // ── Productos propios ──
  const agregarProductoPropio = () => {
    const n = (nuevoProd.n||"").trim();
    const precio = parseFloat(String(nuevoProd.p).replace(",","."));
    if(!n) return;
    if(TODOS_PRODUCTOS.some(p => p.n.toLowerCase() === n.toLowerCase())){
      setFormProd(null); return;   // ya existe, no duplicamos
    }
    const item = {n, cat: nuevoProd.cat, u: nuevoProd.u, p: isNaN(precio)?0:precio, prov:"PROPIO"};
    const lista = [...productosPropios, item];
    setProductosPropios(lista); guardarJSON(PROD_KEY, lista);
    // lo dejamos elegido en la fila donde se estaba agregando
    if(formProd && formProd.fila != null) updateFila(brocha, formProd.fila, "n", n, item);
    setFormProd(null);
    setNuevoProd({n:"", u:"L", p:"", cat:"HER"});
  };
  const borrarProductoPropio = (n) => {
    const lista = productosPropios.filter(p => p.n !== n);
    setProductosPropios(lista); guardarJSON(PROD_KEY, lista);
  };

  // ── Recetas propias ──
  const guardarRecetaActual = () => {
    const t = tratamientos[brocha];
    const filas = t.productos.filter(p => p.n && p.d > 0);
    if(!filas.length) return;
    const nombre = (nombreReceta || t.etiqueta || "").trim() || `Receta ${recetasPropias.length+1}`;
    const item = { id:`r${Date.now()}`, nombre, cultivo: t.cultivo||"",
      productos: filas.map(p => ({n:p.n, d:p.d})) };
    const lista = [item, ...recetasPropias.filter(r => r.nombre !== nombre)].slice(0,20);
    setRecetasPropias(lista); guardarJSON(RECE_KEY, lista);
    setNombreReceta("");
  };
  const borrarRecetaPropia = (id) => {
    const lista = recetasPropias.filter(r => r.id !== id);
    setRecetasPropias(lista); guardarJSON(RECE_KEY, lista);
  };
  const aplicarRecetaPropia = (r) => {
    const filas = Array(10).fill(null).map(() => ({n:"", d:0}));
    r.productos.forEach((rp,i) => {
      if(i>=10) return;
      const base = TODOS_PRODUCTOS.find(p => p.n === rp.n);
      filas[i] = {n:rp.n, d:rp.d, dTexto:String(rp.d), u:base?.u||"L", p:base?.p||0, prov:base?.prov||""};
    });
    setTratamientos(ts => ts.map((t,i) => i===brocha
      ? {...t, productos: filas, cultivo: t.cultivo || r.cultivo || ""}
      : t));
  };

  // Tratamientos que tienen algo (productos + lotes pintados)
  const tratamientosActivos = tratamientos
    .map((t, i) => ({...t, idx: i, ha: haTratamiento(i), filasActivas: t.productos.filter(p => p.n && p.d > 0)}))
    .filter(t => t.ha > 0 && t.filasActivas.length > 0);

  // Bloqueos de restricciones en tratamientos con lotes pintados
  const bloqueosOrden = tratamientosActivos.flatMap(t =>
    evaluarTratamiento(t).filter(x => x.nivel === "bloquea").map(x => ({...x, trat: t.idx + 1})));
  const textoBloqueos = () => "No se puede: " + bloqueosOrden.map(b => `T${b.trat} · ${b.texto}`).join(" | ");

  // Estado de guardado a planilla
  const [guardando, setGuardando] = useState(false);
  const [guardadoMsg, setGuardadoMsg] = useState(null); // {ok:bool, texto:string}
  const laboresGuardadas = useRef(new Set());            // lo guardado desde este equipo en esta sesión

  const guardarLaborEnPlanilla = async () => {
    if(bloqueosOrden.length){
      setGuardadoMsg({ok:false, texto: textoBloqueos()});
      return;
    }
    if(!ordProductor){
      setGuardadoMsg({ok:false, texto:"Elegí el productor antes de guardar."});
      return;
    }
    // Armar payload: cada tratamiento con sus lotes (agrupados por campo) + productos
    const tratamientosPayload = tratamientosActivos.map(t => {
      const lotes = [];
      CAMPOS.forEach(c => unidadesDe(c.id).forEach(u => {
        if(pintura[u.key] === t.idx){
          lotes.push({campo: c.id, lote: u.label, ha: u.ha});
        }
      }));
      return {
        cultivo: t.cultivo || "",
        productos: t.filasActivas.map(p => ({n: p.n, d: p.d, p: p.p || 0, u: p.u})),
        lotes,
      };
    }).filter(t => t.lotes.length > 0);

    if(tratamientosPayload.length === 0){
      setGuardadoMsg({ok:false, texto:"No hay tratamientos con lotes pintados para guardar."});
      return;
    }

    const payload = {
      fecha: ordFecha,
      productor: ordProductor,
      tipoLabor: ordTipo,
      tratamientos: tratamientosPayload,
    };

    // Evitar cargar dos veces la misma labor: misma fecha, campo, lote y tipo de labor ya en la
    // planilla (registro publicado) o guardada recién desde este equipo
    const firma = (fecha, campo, lote, labor) => `${fecha}|${campo}|${String(lote).toUpperCase().trim()}|${String(labor).toUpperCase().trim()}`;
    const enPlanilla = new Set((aplicacionesConDosis || []).map(a => firma(a.fecha, a.campo, a.lote, a.labor)));
    const repetidos = [...new Set(tratamientosPayload.flatMap(t => t.lotes
      .filter(l => { const k = firma(ordFecha, l.campo, l.lote, ordTipo); return enPlanilla.has(k) || laboresGuardadas.current.has(k); })
      .map(l => `${nombreCampo(l.campo)} ${l.lote}`)))];
    if(repetidos.length && !window.confirm(`Esta labor ya parece estar cargada en la planilla (${fechaCorta(ordFecha)}, ${ordTipo.toLowerCase()}):\n${repetidos.join(", ")}\n\n¿Guardar igual?`)){
      setGuardadoMsg({ok:false, texto:"No se guardó: la labor ya estaba cargada."});
      return;
    }

    setGuardando(true);
    setGuardadoMsg(null);
    try {
      const resp = await fetch("/api/guardar-labor", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if(resp.ok && data.ok){
        tratamientosPayload.forEach(t => t.lotes.forEach(l => laboresGuardadas.current.add(firma(ordFecha, l.campo, l.lote, ordTipo))));
        setGuardadoMsg({ok:true, texto:`✓ ${data.mensaje} Aparecerá en la app tras la próxima corrida del pipeline.`});
      } else {
        setGuardadoMsg({ok:false, texto:`Error: ${data.error || "no se pudo guardar"}`});
      }
    } catch(err) {
      setGuardadoMsg({ok:false, texto:`Error de conexión: ${err.message}`});
    } finally {
      setGuardando(false);
    }
  };


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
  // Carga una librería por CDN una sola vez
  const cargarScript = (url) => new Promise((ok, fail) => {
    if(document.querySelector(`script[src="${url}"]`)) return ok();
    const s = document.createElement("script");
    s.src = url; s.onload = () => ok(); s.onerror = () => fail(new Error("No se pudo cargar "+url));
    document.body.appendChild(s);
  });

  const [pdfMsg, setPdfMsg] = useState(null);

  // Genera el PDF de la orden, lo descarga y lo archiva en la carpeta de Drive
  const descargarPDFOrden = async () => {
    if(bloqueosOrden.length){ window.alert(textoBloqueos()); return; }
    const nodo = document.querySelector(".orden-completa-print");
    if(!nodo){ window.alert("No encuentro la orden en pantalla."); return; }
    try{
      setPdfMsg({ok:true, texto:"Armando el PDF…"});
      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      // El PDF va al aplicador: sin precios ni dólares (lo mismo que se oculta al imprimir)
      nodo.classList.add("pdf-sin-precios");
      let canvas;
      try { canvas = await window.html2canvas(nodo, {scale:2, backgroundColor:"#FFFFFF", useCORS:true}); }
      finally { nodo.classList.remove("pdf-sin-precios"); }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({unit:"mm", format:"a4", orientation:"portrait"});
      const anchoP = 210, altoP = 297;
      const alto = canvas.height * anchoP / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.92);
      let resta = alto, y = 0;
      pdf.addImage(img, "JPEG", 0, 0, anchoP, alto);
      resta -= altoP;
      while(resta > 0){ y -= altoP; pdf.addPage(); pdf.addImage(img, "JPEG", 0, y, anchoP, alto); resta -= altoP; }
      const nombre = `orden ${ordFecha} ${(ordProductor||"sin productor").toLowerCase()}.pdf`;
      pdf.save(nombre);

      // Archivo en Drive, para que quede la orden tal cual se descargó
      setPdfMsg({ok:true, texto:"Guardando copia en Drive…"});
      const base64 = pdf.output("datauristring").split(",")[1];
      const r = await fetch("/api/guardar-pdf", {method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({nombre, base64, id: ordId})});
      const data = await r.json();
      if(!r.ok) throw new Error(data.error || "no se pudo archivar");
      // El link queda pegado al borrador, así Andrés abre el PDF desde la lista
      const previo = leerBorradores().find(b => b.id === ordId);
      if(previo){
        const item = {...previo, pdf: data.link};
        escribirBorradores([item, ...leerBorradores().filter(b=>b.id!==ordId)]);
        subirBorrador(item);
      }
      setPdfMsg({ok:true, texto:"PDF descargado y archivado en Drive."});
    }catch(e){
      setPdfMsg({ok:false, texto:`PDF descargado, pero no se archivó: ${e.message}`});
    }
  };

  const imprimirOrdenCompleta=()=>{
    if(bloqueosOrden.length){ window.alert(textoBloqueos()); return; }
    // Imprime toda la sección de recibos con estilo aplicado. El usuario puede "Guardar como PDF" desde la impresora.
    document.body.classList.add("printing-orden");
    setTimeout(()=>{
      window.print();
      setTimeout(()=>document.body.classList.remove("printing-orden"),100);
    },100);
  };

  // herbicidas

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
    {id:"residuales",lbl:"🧪 Residuales"},
  ];

  const inputB={width:"100%",boxSizing:"border-box",padding:"6px 8px",fontSize:13,border:"1px solid #C8C2B0",borderRadius:6,background:"#FFFDF7",color:TINTA,fontFamily:"inherit"};

  return (
    <div style={{minHeight:"100vh",background:FONDO,padding:"20px 14px",fontFamily:"'Avenir Next','Segoe UI',system-ui,sans-serif",color:TINTA}}>
      <style>{`
        @media print {
          body.printing-orden * { visibility: hidden; }
          body.printing-orden .orden-completa-print,
          body.printing-orden .orden-completa-print * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body.printing-orden .orden-completa-print { position:absolute; left:0; top:0; width:100%; padding:0; margin:0; }
          body.printing-orden .no-print, body.printing-orden .no-print * { display:none !important; }
          body.printing-orden .print-only { display:block !important; }
          @page { margin: 1cm; }
        }
        .print-only { display: none; }
        .pdf-sin-precios .no-print, .pdf-sin-precios .no-print * { display: none !important; }
      `}</style>
      <div style={{maxWidth:1200,margin:"0 auto"}}>

        {/* Header */}
        <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:14}}>
          <svg width="56" height="56" viewBox="0 0 512 512" style={{flexShrink:0,background:"#fff",borderRadius:10,border:`1px solid ${TINTA}`,padding:4}}>
            <rect x="88" y="88" width="150" height="150" rx="18" fill="#1E2E7E"/>
            <rect x="274" y="88" width="150" height="150" rx="18" fill="#F5D426"/>
            <circle cx="163" cy="349" r="75" fill="#43A047"/>
            <rect x="274" y="274" width="150" height="150" rx="18" fill="#1E2E7E"/>
          </svg>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,letterSpacing:"0.25em",textTransform:"uppercase",opacity:0.5}}>SMIX · General Pico, La Pampa · campaña 26-27</div>
            <div style={{fontSize:10.5,opacity:0.55,marginTop:4,display:"flex",alignItems:"center",gap:6}}>
              {datosOK === null && <><span>⏳</span> Cargando datos…</>}
              {datosOK === true && fechaDatos && <><span style={{color:"#43A047"}}>●</span> Datos actualizados: {new Date(fechaDatos).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",dateStyle:"short",timeStyle:"short"})}</>}
              {datosOK === false && <><span style={{color:"#C0392B"}}>●</span> Sin conexión a datos actualizados (modo offline)</>}
            </div>
            <h1 style={{margin:"2px 0 4px",fontSize:26,fontWeight:700}}>Gestión integral de campos</h1>
            <div style={{fontSize:13,opacity:0.6}}>{CAMPOS.length} campos · {fmt(haTotal)} ha totales · {APLICACIONES.length} aplicaciones registradas</div>
          </div>
        </div>

        {pideClave && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",padding:"10px 14px",marginBottom:14,borderRadius:10,border:"1.5px solid #C0392B",background:"#FBE3E0"}}>
            <span style={{fontSize:13.5,fontWeight:700}}>🔒 La app pide la clave para leer y guardar en la planilla.</span>
            <input type="password" value={claveIngresada} onChange={e=>setClaveIngresada(e.target.value)} placeholder="Clave"
              style={{padding:"7px 10px",fontSize:14,border:"1px solid #C8C2B0",borderRadius:7,fontFamily:"inherit",flex:"1 1 140px",minWidth:0}}/>
            <button onClick={()=>{ try { window.localStorage.setItem(CLAVE_KEY, claveIngresada.trim()); } catch {} window.location.reload(); }}
              style={{padding:"8px 14px",fontSize:13.5,fontWeight:700,borderRadius:8,border:"none",background:TINTA,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Entrar</button>
          </div>
        )}

        {/* TABS PRINCIPALES */}
        <div style={{display:"flex",gap:7,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
          <button style={tab(vista==="mapas")} onClick={()=>setVista("mapas")}>🗺️ Mapa por campo</button>
          <button style={tab(vista==="realizadas")} onClick={()=>setVista("realizadas")}>✅ Labores realizadas</button>
          <button style={tab(vista==="pendientes")} onClick={()=>setVista("pendientes")}>⏳ Labores pendientes</button>
          <button style={tab(vista==="monitoreo")} onClick={()=>setVista("monitoreo")}>🔍 Monitoreo</button>
          <button style={tab(vista==="galeria")} onClick={()=>setVista("galeria")}>🗂️ Todos los campos</button>
          <button style={tab(vista==="margenes")} onClick={()=>setVista("margenes")}>💵 Márgenes</button>
          <button style={tab(vista==="ordenes")} onClick={()=>setVista("ordenes")}>🚜 Nueva labor</button>
          <button style={tab(vista==="protocolo")} onClick={()=>setVista("protocolo")}>📝 Protocolo</button>
          <button style={tab(vista==="precios")} onClick={()=>setVista("precios")}>💲 Precios</button>
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
            {/* filtro por cultivo — solo en capa campaña */}
            {capaModo==="campaña"&&(
              <div style={{width:"100%",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:12,opacity:0.6,fontWeight:600,marginRight:2}}>Filtrar cultivo:</span>
                <button onClick={()=>setCultivoFiltro(null)} style={chip(cultivoFiltro===null)}>Todos</button>
                {cultivosDisponibles.map(cv=>(
                  <button key={cv} onClick={()=>setCultivoFiltro(cv===cultivoFiltro?null:cv)} style={{...chip(cultivoFiltro===cv),display:"inline-flex",alignItems:"center",gap:5}}>
                    <span style={{width:9,height:9,borderRadius:2,background:colorCv(cv),flexShrink:0}}/>{cv}
                  </button>
                ))}
              </div>
            )}
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
              <MapaCampo campo={campo} modo={capaModo} sueloVar={sueloVar} onLoteClick={abrirLote} datos={{INV_26,PLAN_2627,RINDE_2526,SUELOS,RESIDUALES:residualesMapa}} cultivoFiltro={cultivoFiltro} cultivosDeLote={cultivosDeLote}/>
              <div style={{paddingInline:4}}><Leyenda modo={capaModo} sueloVar={sueloVar}/></div>
              {/* Resumen ha por cultivo — campaña 26-27 */}
              {capaModo==="campaña"&&(()=>{
                const acum={};
                campo.lotes.forEach(l=>{
                  const invRaw=buscarKey(INV_26, campo.id, l.id);
                  const planRaw=buscarKey(PLAN_2627, campo.id, l.id);
                  const pInv=cvPartes(invRaw), pPlan=cvPartes(planRaw);
                  let fina=null, gruesa=null;
                  if(pPlan.length>=2){ fina=pPlan[0]; gruesa=pPlan[1]; }
                  else if(pInv.length>=2){ fina=pInv[0]; gruesa=pInv[1]; }
                  else { fina=pInv[0]||null; gruesa=pPlan[0]||null; }
                  if(fina&&gruesa&&fina===gruesa) gruesa=null;
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
            {/* panel lista del cultivo filtrado */}
            {capaModo==="campaña"&&cultivoFiltro&&(
              <div style={{flex:"1 1 300px",maxWidth:420,...caja}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{width:14,height:14,borderRadius:3,background:colorCv(cultivoFiltro),border:`1px solid ${TINTA}`,flexShrink:0}}/>
                  <div style={{fontSize:13,fontWeight:700}}>Lotes con {cultivoFiltro} · 26-27</div>
                </div>
                {lotesDelCultivo.length===0
                  ?<div style={{fontSize:13,opacity:0.6}}>No hay lotes con {cultivoFiltro} en esta campaña.</div>
                  :(<>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:"#F3EFE3",borderRadius:8,marginBottom:8,fontSize:13}}>
                      <span style={{fontWeight:600}}>{lotesDelCultivo.length} lotes · {[...new Set(lotesDelCultivo.map(x=>x.campo.id))].length} campos</span>
                      <span style={{fontWeight:700}}>{fmt(lotesDelCultivo.reduce((s,x)=>s+x.ha,0))} ha</span>
                    </div>
                    <div style={{maxHeight:420,overflow:"auto",display:"flex",flexDirection:"column",gap:4}}>
                      {(()=>{
                        // agrupar por campo
                        const porCampo={};
                        lotesDelCultivo.forEach(x=>{(porCampo[x.campo.id]=porCampo[x.campo.id]||{campo:x.campo,items:[]}).items.push(x);});
                        return Object.values(porCampo).map(({campo:cc,items})=>(
                          <div key={cc.id} style={{marginBottom:6}}>
                            <div style={{fontSize:11,fontWeight:700,opacity:0.7,textTransform:"uppercase",letterSpacing:"0.05em",padding:"2px 0",borderBottom:"1px solid #E5E0D0",marginBottom:3,display:"flex",justifyContent:"space-between"}}>
                              <span>{cc.nombre}</span>
                              <span>{fmt(items.reduce((s,x)=>s+x.ha,0))} ha</span>
                            </div>
                            {items.map(x=>{
                              const esDoble=x.cvs.length>1;
                              return (
                                <div key={x.lote.id} onClick={()=>abrirLote(cc,x.lote)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",borderRadius:6,cursor:"pointer",fontSize:12.5,background:"#FFFDF7",border:"1px solid #EEE9DC"}}>
                                  <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                                    <b>Lote {x.lote.label||x.lote.id}</b>
                                    {esDoble&&<span style={{fontSize:10,opacity:0.6}}>({x.cvs.join(" + ")})</span>}
                                  </span>
                                  <span style={{opacity:0.75}}>{x.ha} ha</span>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </>)}
              </div>
            )}
          </div>
        )}
        {vista==="galeria"&&(
          <div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
              <span style={{fontSize:13,opacity:0.65}}>Capa:</span>
              {CAPAS.map(c=><button key={c.id} style={chip(capaModo===c.id)} onClick={()=>setCapaModo(c.id)}>{c.lbl}</button>)}
              {capaModo==="suelos"&&[["P","🟠 P"],["N","🔵 N"],["MO","🟢 MO"]].map(([v,l])=>(
                <button key={v} style={chip(sueloVar===v)} onClick={()=>setSueloVar(v)}>{l}</button>
              ))}
            </div>
            {capaModo==="campaña"&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
                <span style={{fontSize:12,opacity:0.6,fontWeight:600}}>Filtrar cultivo:</span>
                <button onClick={()=>setCultivoFiltro(null)} style={chip(cultivoFiltro===null)}>Todos</button>
                {cultivosDisponibles.map(cv=>(
                  <button key={cv} onClick={()=>setCultivoFiltro(cv===cultivoFiltro?null:cv)} style={{...chip(cultivoFiltro===cv),display:"inline-flex",alignItems:"center",gap:5}}>
                    <span style={{width:9,height:9,borderRadius:2,background:colorCv(cv),flexShrink:0}}/>{cv}
                  </button>
                ))}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
              {CAMPOS.map(c=>(
                <div key={c.id} style={{background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:12,padding:10,boxShadow:"0 1px 6px rgba(46,42,34,.08)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                    <div style={{fontWeight:700,fontSize:14}}>{c.nombre}</div>
                    <div style={{fontSize:12,opacity:0.55}}>{PRODUCTOR[c.id]} · {fmt(haCampo(c))} ha</div>
                  </div>
                  <MapaCampo campo={c} modo={capaModo} sueloVar={sueloVar} mini={false} onLoteClick={abrirLote} datos={{INV_26,PLAN_2627,RINDE_2526,SUELOS,RESIDUALES:residualesMapa}} cultivoFiltro={cultivoFiltro} cultivosDeLote={cultivosDeLote}/>
                  <div style={{marginTop:4}}><Leyenda modo={capaModo} sueloVar={sueloVar}/></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ HERBICIDAS ══ */}
        {vista==="realizadas"&&<VistaRealizadas aplicaciones={APLICACIONES} fertilizaciones={FERTILIZACIONES} registro={aplicacionesConDosis}/>}

        {vista==="pendientes"&&<VistaPendientes protocolo={protocolo} cultivoDe={cultivoDe}
          aplicaciones={aplicacionesConDosis || APLICACIONES} conDosis={!!aplicacionesConDosis} monitoreos={monit.lista}
          lluvias={lluv.lista} catalogo={TODOS_PRODUCTOS} onArmarOrden={armarOrdenDesde}
          fechaDatos={fechaDatos ? new Date(fechaDatos).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}) : null}
          onEditar={()=>setVista("protocolo")}/>}

        {vista==="monitoreo"&&<VistaMonitoreo monit={monit} lluv={lluv} cultivoDe={cultivoDe} siembraDe={siembraDe} autor={autor} cambiarAutor={cambiarAutor}/>}

        {vista==="protocolo"&&<VistaProtocoloEditor protocolo={protocolo} sync={protoSync} onGuardar={guardarProtocolo}/>}

        {vista==="precios"&&<VistaPrecios productos={[...PRODUCTOS_BASE, ...productosPropios]} precios={precios} sync={preciosSync} onGuardar={guardarPrecios}/>}

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

        {/* ══ NUEVA LABOR — orden con 4 tratamientos ══ */}
        {vista==="ordenes"&&(()=>{
          const grupos = lotesPintadosPorCampo();
          const campoIds = Object.keys(grupos);
          const haTotalO = haTotalOrden();
          const [vx,vy,vw,vh]=campoOrd.vb;
          const k=vw/700;

          const tratActual = tratamientos[brocha];
          const haBrocha = haTratamiento(brocha);
          const costoTratamiento = (t, ha) => t.filasActivas.reduce((s,p) => s + (p.d||0)*ha*(p.p||0), 0);

          // Totalizador general: suma de productos de TODOS los tratamientos
          const totalesGenerales = {};
          tratamientosActivos.forEach(t => {
            t.filasActivas.forEach(p => {
              if(!totalesGenerales[p.n]) totalesGenerales[p.n] = {n:p.n, u:p.u, p:p.p, total:0, costo:0};
              const cantP = p.d * t.ha;
              totalesGenerales[p.n].total += cantP;
              totalesGenerales[p.n].costo += cantP * (p.p||0);
            });
          });
          const listaTotales = Object.values(totalesGenerales);
          const costoTotalGeneral = listaTotales.reduce((s,x) => s+x.costo, 0);

          const TIPOS_LABOR = [
            {v:"PULVERIZADA TERRESTRE", lbl:"🚿 Pulverización terrestre"},
            {v:"PULVERIZADA AEREA", lbl:"✈️ Pulverización aérea"},
            {v:"SIEMBRA", lbl:"🌱 Siembra"},
            {v:"INCORPORADA", lbl:"🚜 Fertilización incorporada"},
            {v:"VOLEADA", lbl:"⚡ Fertilización voleada"},
            {v:"RASTRA", lbl:"🚜 Rastra"},
            {v:"ROLOS", lbl:"🔄 Rolos"},
            {v:"PARATIL", lbl:"🚜 Paratil"},
          ];

          return (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* ─── ENCABEZADO GLOBAL ─── */}
              <div style={{...caja}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase",opacity:0.6}}>Nueva labor</div>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    <button onClick={()=>setPanelBorr(v=>!v)}
                      style={{padding:"5px 11px",fontSize:12,fontWeight:600,cursor:"pointer",borderRadius:7,
                        border:`1.5px solid ${TINTA}`,background:panelBorr?TINTA:"transparent",
                        color:panelBorr?"#F3EFE3":TINTA,fontFamily:"inherit"}}>
                      📋 Borradores{borradores.length?` (${borradores.length})`:""}
                    </button>
                    <button onClick={nuevaOrden}
                      style={{padding:"5px 11px",fontSize:12,fontWeight:600,cursor:"pointer",borderRadius:7,
                        border:`1.5px solid ${TINTA}`,background:"transparent",color:TINTA,fontFamily:"inherit"}}>
                      + Nueva
                    </button>
                  </div>
                </div>

                {panelBorr && (
                  <div style={{marginBottom:12,padding:"10px 12px",border:"1.5px solid #D8D2C0",borderRadius:10,background:"#FFFDF7"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                      <div style={{fontSize:11,opacity:0.6}}>Órdenes compartidas de los últimos 30 días</div>
                      <select value={autor} onChange={e=>cambiarAutor(e.target.value)}
                        style={{...inputB,fontSize:11.5,padding:"3px 6px",width:"auto"}}>
                        <option value="">¿quién sos?</option>
                        <option value="Santos">Santos</option>
                        <option value="Andrés">Andrés</option>
                      </select>
                      <button onClick={bajarBorradores}
                        style={{padding:"3px 9px",fontSize:11,fontWeight:600,cursor:"pointer",borderRadius:6,
                          border:`1px solid ${TINTA}`,background:"transparent",color:TINTA,fontFamily:"inherit"}}>↻ actualizar</button>
                      {sincro.txt && (
                        <span style={{fontSize:11,marginLeft:"auto",color:sincro.estado==="error"?"#C0392B":"#2E7D32"}}>
                          {sincro.estado==="error"?"⚠️":"●"} {sincro.txt}
                        </span>
                      )}
                    </div>
                    {borradores.length===0
                      ? <div style={{fontSize:12.5,opacity:0.6,fontStyle:"italic"}}>Todavía no hay borradores.</div>
                      : (
                        <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:280,overflow:"auto"}}>
                          {borradores.map(b=>{
                            const esActual = b.id===ordId;
                            const r=b.resumen||{};
                            return (
                              <div key={b.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",
                                borderRadius:7,background:esActual?"#EEF5E9":"#fff",
                                border:`1px solid ${esActual?"#A5D6A7":"#EEE9DC"}`}}>
                                <div style={{minWidth:0,flex:1}}>
                                  <div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                    {b.productor || "sin productor"} · {fmt(r.ha||0)} ha
                                    {esActual && <span style={{fontSize:10.5,color:"#2E7D32",marginLeft:6}}>· en edición</span>}
                                  </div>
                                  <div style={{fontSize:10.5,opacity:0.6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                    {fechaBorrador(b.guardado)}{b.autor ? ` · ${b.autor}` : ""} · {(r.campos||[]).join(", ")||"sin lotes"}
                                    {r.etiquetas&&r.etiquetas.length ? ` · ${r.etiquetas.join(" / ")}` : ""}
                                  </div>
                                </div>
                                {b.pdf && (
                                  <a href={b.pdf} target="_blank" rel="noreferrer" title="Abrir el PDF archivado"
                                    style={{fontSize:14,textDecoration:"none",flexShrink:0}}>📄</a>
                                )}
                                {!esActual && (
                                  <button onClick={()=>cargarBorrador(b)}
                                    style={{padding:"4px 10px",fontSize:11.5,fontWeight:600,cursor:"pointer",borderRadius:6,
                                      border:"none",background:TINTA,color:"#F3EFE3",fontFamily:"inherit",flexShrink:0}}>
                                    Abrir
                                  </button>
                                )}
                                <button onClick={()=>borrarBorrador(b.id)} title="Borrar"
                                  style={{padding:"2px 7px",fontSize:15,cursor:"pointer",borderRadius:6,
                                    border:"none",background:"transparent",color:"#C0392B",fontFamily:"inherit",flexShrink:0}}>×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                  <div>
                    <div style={{fontSize:10.5,opacity:0.55,marginBottom:3}}>Tipo de labor</div>
                    <select value={ordTipo} onChange={e=>setOrdTipo(e.target.value)} style={{...inputB,fontSize:13,fontWeight:600}}>
                      {TIPOS_LABOR.map(t => <option key={t.v} value={t.v}>{t.lbl}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,opacity:0.55,marginBottom:3}}>Fecha</div>
                    <input type="date" value={ordFecha} onChange={e=>setOrdFecha(e.target.value)} style={{...inputB,fontSize:13}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,opacity:0.55,marginBottom:3}}>Productor</div>
                    <select value={ordProductor} onChange={e=>setOrdProductor(e.target.value)} style={{...inputB,fontSize:13,fontWeight:600,color:ordProductor?TINTA:"#9A937E"}}>
                      <option value="">— elegir productor —</option>                      {PRODUCTORES_BASE.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:11,opacity:0.55}}>Cada tratamiento tiene su propio cultivo (abajo).</div>
                <div style={{marginTop:12,padding:"8px 12px",background:"#F3EFE3",borderRadius:8,fontSize:13,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                  <span style={{fontWeight:600}}>Total ha a aplicar:</span>
                  <span style={{fontWeight:700,fontSize:15}}>{fmt(haTotalO)} ha</span>
                </div>
              </div>

              {/* ─── SELECTOR DE TRATAMIENTO + MAPA ─── */}
              <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
                {/* Panel izq: selector de tratamiento y su tabla */}
                <div style={{flex:"1 1 500px",display:"flex",flexDirection:"column",gap:10}}>
                  {/* Selector de tratamiento activo */}
                  <div style={{...caja,padding:"10px 12px"}}>
                    <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>Tratamiento activo</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {COLORES_APP.map((color,i)=>{
                        const ha = haTratamiento(i);
                        const activo = brocha === i;
                        const filas = tratamientos[i].productos.filter(p => p.n && p.d > 0).length;
                        return (
                          <button key={i} onClick={()=>setBrocha(i)} style={{
                            display:"flex",alignItems:"center",gap:6,padding:"6px 10px",cursor:"pointer",borderRadius:8,
                            border:activo?`2.5px solid ${TINTA}`:"1.5px solid #C8C2B0",
                            background:activo?"#F8F5EC":"#fff",fontFamily:"inherit",fontSize:12,fontWeight:600}}>
                            <span style={{width:16,height:16,borderRadius:4,background:color,border:`1px solid ${TINTA}`}}/>
                            <span>T{i+1}</span>
                            {ha > 0 && <span style={{opacity:0.7}}>· {fmt(ha)}ha</span>}
                            {filas > 0 && <span style={{opacity:0.55,fontSize:11}}>· {filas}p</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{fontSize:11.5,opacity:0.55,marginTop:8}}>Elegí un tratamiento, pintá lotes y armale su receta. Después cambiá al siguiente.</div>
                  </div>

                  {/* Etiqueta del tratamiento activo */}
                  <div style={caja}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{width:22,height:22,borderRadius:5,background:COLORES_APP[brocha],border:`1.5px solid ${TINTA}`,flexShrink:0}}/>
                      <div style={{fontSize:12,fontWeight:700}}>Tratamiento {brocha+1}</div>
                      <select value={tratActual.etiqueta} onChange={e=>updateEtiquetaTrat(brocha, e.target.value)}
                        style={{...inputB,fontSize:12.5,flex:1,fontWeight:600,color:tratActual.etiqueta?TINTA:"#9A937E"}}>
                        <option value="">— tipo de tratamiento —</option>
                        {TIPOS_TRATAMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div style={{fontSize:12,opacity:0.65,whiteSpace:"nowrap"}}>{fmt(haBrocha)} ha</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <div style={{fontSize:10.5,opacity:0.55,paddingLeft:30}}>Cultivo:</div>
                      <select value={(tratActual.cultivo||"").toUpperCase()} onChange={e=>{updateCultivoTrat(brocha, e.target.value); setAvisoCultivo(null);}}
                        style={{...inputB,fontSize:12.5,flex:1,padding:"4px 8px",fontWeight:600,color:tratActual.cultivo?TINTA:"#9A937E"}}>
                        <option value="">— cultivo —</option>
                        {CULTIVOS_ORDEN.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {(() => {
                      const conf = conflictosCultivo(brocha);
                      if (!conf.length) return null;
                      return (
                        <div style={{marginBottom:8,padding:"7px 10px",borderRadius:7,background:"#FDECEA",
                          border:"1px solid #E8A9A2",fontSize:11.5,lineHeight:1.5}}>
                          <b style={{color:"#C0392B"}}>Hay {conf.length} lote{conf.length>1?"s":""} pintado{conf.length>1?"s":""} que no va{conf.length>1?"n":""} a {(tratActual.cultivo||"").toUpperCase()}:</b>
                          <div style={{marginTop:2}}>
                            {conf.map((x,i) => (
                              <span key={i}>{i>0 && " · "}{x.campo} {x.lote} ({x.cultivos.join("/")})</span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const ev = evaluarTratamiento(tratActual);
                      if (!ev.length) return null;
                      const est = {
                        bloquea:{bg:"#FDECEA",bd:"#E8A9A2",c:"#C0392B",ic:"⛔"},
                        alerta:{bg:"#FDECEA",bd:"#E8A9A2",c:"#C0392B",ic:"🔴"},
                        aviso:{bg:"#FFF6DD",bd:"#E9CF7A",c:"#8A6200",ic:"⚠️"},
                        info:{bg:"#F1EFE8",bd:"#D6D1C2",c:"#6B6452",ic:"ℹ️"},
                      };
                      const orden = {bloquea:0, alerta:1, aviso:2, info:3};
                      return (
                        <div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:4}}>
                          {[...ev].sort((a,b)=>orden[a.nivel]-orden[b.nivel]).map((x,i) => (
                            <div key={i} style={{padding:"6px 10px",borderRadius:7,background:est[x.nivel].bg,
                              border:`1px solid ${est[x.nivel].bd}`,fontSize:11.5,lineHeight:1.45,color:est[x.nivel].c}}>
                              {est[x.nivel].ic} {x.texto}
                            </div>
                          ))}
                          {!tratActual.etiqueta && (
                            <div style={{fontSize:10.5,opacity:0.6}}>Elegí el tipo de tratamiento para validar por momento.</div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Recetas rápidas */}
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                      {RECETAS_BASE.map(r => (
                        <button key={r.nombre} onClick={()=>aplicarRecetaAlTrat(brocha, r)} style={{padding:"4px 9px",fontSize:10.5,fontWeight:600,cursor:"pointer",border:"1px solid #C8C2B0",borderRadius:14,background:"transparent",color:TINTA,fontFamily:"inherit"}}>
                          📋 {r.nombre}
                        </button>
                      ))}
                      {recetasPropias.map(r => (
                        <span key={r.id} style={{display:"inline-flex",alignItems:"center",border:"1px solid #1E5FA8",borderRadius:14,overflow:"hidden"}}>
                          <button onClick={()=>aplicarRecetaPropia(r)} style={{padding:"4px 4px 4px 9px",fontSize:10.5,fontWeight:600,cursor:"pointer",border:"none",background:"transparent",color:"#1E5FA8",fontFamily:"inherit"}}>
                            ⭐ {r.nombre}
                          </button>
                          <button onClick={()=>borrarRecetaPropia(r.id)} title="Borrar receta" style={{padding:"2px 7px 3px 3px",fontSize:13,cursor:"pointer",border:"none",background:"transparent",color:"#1E5FA8",fontFamily:"inherit",opacity:0.6}}>×</button>
                        </span>
                      ))}
                      <button onClick={()=>limpiarTratamiento(brocha)} style={{padding:"4px 9px",fontSize:10.5,fontWeight:600,cursor:"pointer",border:"1px solid #C0392B",borderRadius:14,background:"transparent",color:"#C0392B",fontFamily:"inherit",marginLeft:"auto"}}>Vaciar T{brocha+1}</button>
                    </div>

                    {/* Guardar el tratamiento actual como receta */}
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10}}>
                      <input value={nombreReceta} onChange={e=>setNombreReceta(e.target.value)}
                        placeholder={`Guardar T${brocha+1} como receta…`}
                        style={{...inputB,fontSize:11.5,padding:"4px 8px",flex:1}}/>
                      <button onClick={guardarRecetaActual}
                        disabled={!tratActual.productos.some(p=>p.n && p.d>0)}
                        style={{padding:"5px 11px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"none",
                          background:tratActual.productos.some(p=>p.n && p.d>0)?"#1E5FA8":"#C8C2B0",
                          color:"#fff",cursor:tratActual.productos.some(p=>p.n && p.d>0)?"pointer":"default",
                          fontFamily:"inherit",whiteSpace:"nowrap"}}>
                        ⭐ Guardar receta
                      </button>
                    </div>

                    {/* Formulario de producto nuevo */}
                    {formProd && (
                      <div style={{marginBottom:10,padding:"10px 12px",border:"1.5px solid #1E5FA8",borderRadius:9,background:"#F4F8FD"}}>
                        <div style={{fontSize:11.5,fontWeight:700,marginBottom:8,color:"#1E5FA8"}}>Producto nuevo</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 70px 80px 90px",gap:6,alignItems:"center"}}>
                          <input autoFocus value={nuevoProd.n} onChange={e=>setNuevoProd(v=>({...v,n:e.target.value}))}
                            placeholder="Nombre del producto" style={{...inputB,fontSize:12,padding:"5px 8px"}}/>
                          <select value={nuevoProd.u} onChange={e=>setNuevoProd(v=>({...v,u:e.target.value}))}
                            style={{...inputB,fontSize:12,padding:"5px 6px"}}>
                            <option value="L">L</option><option value="kg">kg</option><option value="bolsa">bolsa</option>
                          </select>
                          <input value={nuevoProd.p} onChange={e=>setNuevoProd(v=>({...v,p:e.target.value}))}
                            inputMode="decimal" placeholder="USD" style={{...inputB,fontSize:12,padding:"5px 8px",textAlign:"right"}}/>
                          <select value={nuevoProd.cat} onChange={e=>setNuevoProd(v=>({...v,cat:e.target.value}))}
                            style={{...inputB,fontSize:12,padding:"5px 6px"}}>
                            <option value="HER">Herbicida</option><option value="INS">Insecticida</option>
                            <option value="FUN">Fungicida</option><option value="COAD">Coadyuvante</option>
                            <option value="FERT">Fertilizante</option><option value="SEM">Semilla</option>
                            <option value="SGR">Curasemilla</option>
                          </select>
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:8}}>
                          <button onClick={agregarProductoPropio} disabled={!nuevoProd.n.trim()}
                            style={{padding:"5px 12px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"none",
                              background:nuevoProd.n.trim()?"#1E5FA8":"#C8C2B0",color:"#fff",
                              cursor:nuevoProd.n.trim()?"pointer":"default",fontFamily:"inherit"}}>Agregar</button>
                          <button onClick={()=>{setFormProd(null);setNuevoProd({n:"",u:"L",p:"",cat:"HER"});}}
                            style={{padding:"5px 12px",fontSize:11.5,fontWeight:600,borderRadius:7,
                              border:"1px solid #9A937E",background:"transparent",color:TINTA,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                          <span style={{fontSize:10.5,opacity:0.6,alignSelf:"center"}}>Queda guardado en este dispositivo</span>
                        </div>
                      </div>
                    )}

                    {/* Referencia de proveedores */}
                    <div style={{display:"flex",gap:12,marginBottom:6,fontSize:10.5,opacity:0.75,alignItems:"center"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                        <span style={{width:9,height:9,borderRadius:2,background:COLOR_PROV.PELAYO,display:"inline-block"}}/>BH Pelayo
                      </span>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                        <span style={{width:9,height:9,borderRadius:2,background:COLOR_PROV.QUEMU,display:"inline-block"}}/>BH Cereales Quemú
                      </span>
                      {productosPropios.length>0&&(
                        <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                          <span style={{width:9,height:9,borderRadius:2,background:COLOR_PROV.PROPIO,display:"inline-block"}}/>
                          Míos ({productosPropios.length})
                        </span>
                      )}
                    </div>
                    {/* Tabla estilo recibo */}
                    <div style={{border:`1.5px solid ${TINTA}`,borderRadius:6,overflow:"hidden"}}>
                      <div style={{display:"grid",gridTemplateColumns:"7px minmax(0,1fr) 62px 62px 62px",background:"#EEE9DC",borderBottom:`1.5px solid ${TINTA}`}}>
                        <div/>
                        <div style={{padding:"6px 8px",fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Producto</div>
                        <div style={{padding:"6px 8px",fontSize:10.5,fontWeight:700,textTransform:"uppercase",textAlign:"right"}}>Dosis/ha</div>
                        <div style={{padding:"6px 8px",fontSize:10.5,fontWeight:700,textTransform:"uppercase",textAlign:"right"}}>Total</div>
                        <div style={{padding:"6px 8px",fontSize:10.5,fontWeight:700,textTransform:"uppercase",textAlign:"right"}}>USD</div>
                      </div>
                      {tratActual.productos.map((p, fi) => {
                        const total = (p.d||0) * haBrocha;
                        const costo = total * (p.p||0);
                        const evF = p.n && p.d > 0 ? evaluarProducto(p.n, p.d, p.u, tratActual.cultivo, tratActual.etiqueta) : [];
                        const rojoF = evF.some(x=>x.nivel==="bloquea" || x.nivel==="alerta");
                        const bgF = rojoF ? "#FBE3E0" : evF.some(x=>x.nivel==="aviso") ? "#FFF8E6" : (fi%2===0?"#fff":"#FDFCF6");
                        return (
                          <div key={fi} style={{display:"grid",gridTemplateColumns:"7px minmax(0,1fr) 62px 62px 62px",borderBottom:fi<9?"1px solid #EEE9DC":"none",background:bgF}}>
                            <div style={{background:p.prov?COLOR_PROV[p.prov]:"transparent"}}/>
                            <BuscadorProducto valor={p.n} lista={productosDisponibles}
                              color={p.prov?COLOR_PROV[p.prov]:TINTA} negrita={!!p.prov}
                              onElegir={n=>updateFila(brocha, fi, "n", n)}
                              onNuevo={t=>{ if(t) setNuevoProd(v=>({...v,n:t})); setFormProd({fila: fi}); }}/>
                            <input type="text" inputMode="decimal" value={p.dTexto !== undefined ? p.dTexto : (p.d || "")} onChange={e=>updateFila(brocha, fi, "d", e.target.value)} placeholder="0" style={{padding:"5px 6px",fontSize:11.5,border:"none",borderLeft:"1px solid #EEE9DC",background:"transparent",fontFamily:"inherit",color:evF.some(x=>x.nivel==="alerta")?"#C0392B":TINTA,fontWeight:evF.some(x=>x.nivel==="alerta")?700:400,textAlign:"right",width:"100%",minWidth:0}}/>
                            <div style={{padding:"5px 6px",fontSize:11,textAlign:"right",borderLeft:"1px solid #EEE9DC",opacity:total>0?1:0.35}}>{total>0?fmtCant(total):"—"}</div>
                            <div style={{padding:"5px 6px",fontSize:11,textAlign:"right",borderLeft:"1px solid #EEE9DC",fontWeight:600,opacity:costo>0?1:0.35}}>{costo>0?fmt(costo):"—"}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Totales del tratamiento */}
                    <div style={{marginTop:8,padding:"8px 10px",background:"#F8F5EC",borderRadius:6,display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{fontWeight:600}}>Total tratamiento {brocha+1}:</span>
                      <span style={{fontWeight:700}}>
                        USD {fmt(tratActual.productos.reduce((s,p) => s + (p.d||0)*haBrocha*(p.p||0), 0))}
                        {haBrocha > 0 && <span style={{opacity:0.6,marginLeft:8}}>({(tratActual.productos.reduce((s,p) => s + (p.d||0)*(p.p||0), 0)).toFixed(2)}/ha)</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Panel derecho: mapa */}
                <div style={{flex:"1 1 400px"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                    <select value={campoSel} onChange={e=>setCampoSel(e.target.value)}
                      style={{padding:"7px 11px",fontSize:14,fontWeight:600,border:`1.5px solid ${TINTA}`,borderRadius:8,background:CREMA,color:TINTA,fontFamily:"inherit",cursor:"pointer"}}>
                      {CAMPOS.map(c=><option key={c.id} value={c.id}>{c.nombre}{haPint(c.id)?` ● ${fmt(haPint(c.id))} ha`:""}</option>)}
                    </select>
                    <div style={{fontSize:11,opacity:0.6,flex:1,minWidth:120}}>Pintás con color de <b>T{brocha+1}</b></div>
                  </div>
                  <div style={{background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:10,padding:8}}>
                    <svg ref={svgRef} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{width:"100%",height:"auto",display:"block"}}
                      onClick={(e)=>{
                        if(!modoDividir || !loteDiv) return;
                        const p = puntoSVG(e.nativeEvent, svgRef.current);
                        if(!p) return;
                        setPuntosCorte(prev=>{
                          const np=[...prev,p];
                          if(np.length>=2){ setTimeout(()=>aplicarCorte(np[0],np[1]),0); return np.slice(0,2); }
                          return np;
                        });
                      }}>
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
                      {unidadesDe(campoSel).map(u=>{
                        const idx=pintura[u.key];
                        const pint=idx!==undefined;
                        const [cx,cy]=centro(u.poly);
                        const w=anchoP(u.poly);
                        const mHa=u.ha>0&&w>=40*k;
                        const enDiv = modoDividir && loteDiv && loteDiv.campoId===campoSel && loteDiv.loteId===u.loteId;
                        return <g key={u.key}
                          onClick={()=>{
                            if(modoDividir){
                              setLoteDiv({campoId:campoSel, loteId:u.loteId});
                              setPuntosCorte([]);
                            } else pintarL(u.loteId, u.key);
                          }}
                          style={{cursor:"pointer"}}>
                          <polygon points={u.poly.map(p=>p.join(",")).join(" ")}
                            fill={pint?COLORES_APP[idx]:"#FFFFFF"} fillOpacity={pint?0.85:1}
                            stroke={enDiv?"#C0392B":TINTA} strokeWidth={(enDiv?3:pint?2.2:1.2)*k}
                            strokeDasharray={enDiv?`${5*k} ${3*k}`:undefined}/>
                          <g style={{pointerEvents:"none"}}>
                            <text x={cx} y={cy+(mHa?0:4*k)} fontSize={(w<55*k?10:13)*k} fontWeight="700" textAnchor="middle" fill={pint?"#FFF":TINTA} opacity={pint?1:0.5} style={pint?{paintOrder:"stroke",stroke:"rgba(0,0,0,0.25)",strokeWidth:2*k}:{}}>{u.label}</text>
                            {mHa&&<text x={cx} y={cy+13*k} fontSize={9.5*k} textAnchor="middle" fill={pint?"#FFF":TINTA} opacity={pint?0.95:0.45}>{u.ha} ha</text>}
                          </g>
                        </g>;
                      })}
                      {/* puntos del corte en curso */}
                      {puntosCorte.map((p,i)=>(
                        <circle key={i} cx={p[0]} cy={p[1]} r={5*k} fill="#C0392B" stroke="#fff" strokeWidth={1.5*k} style={{pointerEvents:"none"}}/>
                      ))}
                      {puntosCorte.length===2&&(
                        <line x1={puntosCorte[0][0]} y1={puntosCorte[0][1]} x2={puntosCorte[1][0]} y2={puntosCorte[1][1]} stroke="#C0392B" strokeWidth={2*k} strokeDasharray={`${4*k} ${3*k}`} style={{pointerEvents:"none"}}/>
                      )}
                    </svg>
                  </div>
                  {/* Aviso: el lote no coincide con el cultivo del tratamiento */}
                  {avisoCultivo && (
                    <div style={{marginTop:10,padding:"10px 12px",borderRadius:9,
                      border:"1.5px solid #C0392B",background:"#FDECEA",display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{fontSize:17,lineHeight:1}}>⚠️</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:"#C0392B"}}>
                          El lote no coincide con el cultivo del tratamiento
                        </div>
                        <div style={{fontSize:12,marginTop:3,lineHeight:1.5}}>
                          <b>{avisoCultivo.campo} · lote {avisoCultivo.lote}</b> va a <b>{avisoCultivo.cultivoLote}</b>,
                          pero el tratamiento {avisoCultivo.trat} está armado para <b>{avisoCultivo.cultivoTrat}</b>.
                          <br/>No se pintó. Cambiá el cultivo del tratamiento, usá otro tratamiento, o revisá el lote.
                        </div>
                      </div>
                      <button onClick={()=>setAvisoCultivo(null)}
                        style={{border:"none",background:"transparent",color:"#C0392B",fontSize:17,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
                    </div>
                  )}

                  {/* ── Panel dividir lote ── */}
                  <div style={{marginTop:10,padding:"10px 12px",border:`1.5px solid ${modoDividir?"#C0392B":"#D8D2C0"}`,borderRadius:10,background:modoDividir?"#FDF3F1":"#FFFDF7"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <button onClick={()=>{setModoDividir(m=>!m);setLoteDiv(null);setPuntosCorte([]);}}
                        style={{padding:"7px 12px",fontSize:12.5,fontWeight:700,cursor:"pointer",border:"none",borderRadius:8,
                          background:modoDividir?"#C0392B":"transparent",color:modoDividir?"#fff":TINTA,
                          boxShadow:modoDividir?"none":`inset 0 0 0 1.5px ${TINTA}`,fontFamily:"inherit"}}>
                        ✂️ {modoDividir?"Salir de dividir":"Dividir lote"}
                      </button>
                      {modoDividir && !loteDiv && <span style={{fontSize:12,opacity:0.7}}>Tocá el lote que querés dividir.</span>}
                      {modoDividir && loteDiv && puntosCorte.length===0 && (
                        <span style={{fontSize:12,opacity:0.75}}>
                          Lote <b>{loteObj(loteDiv.campoId,loteDiv.loteId)?.label}</b> · tocá dos puntos del mapa para el corte, o usá cabecera →
                          {divisiones[clL(loteDiv.campoId,loteDiv.loteId)]?.length > 1 && <span style={{marginLeft:6,color:"#C0392B",fontWeight:600}}>Otro corte lo divide de nuevo.</span>}
                        </span>
                      )}
                      {modoDividir && loteDiv && puntosCorte.length===1 && <span style={{fontSize:12,opacity:0.75}}>Tocá el segundo punto.</span>}
                      {modoDividir && loteDiv && (
                        <span style={{display:"inline-flex",alignItems:"center",gap:5,marginLeft:"auto"}}>
                          <span style={{fontSize:12,opacity:0.7}}>Cabecera</span>
                          <input type="number" defaultValue={15} min={2} max={80} id="fracCab"
                            style={{...inputB,width:58,fontSize:12,padding:"4px 6px",textAlign:"right"}}/>
                          <span style={{fontSize:12,opacity:0.7}}>%</span>
                          <button onClick={()=>{
                            const el=document.getElementById("fracCab");
                            aplicarCabecera(parseFloat(el?.value)||15);
                          }} style={{padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer",border:`1.5px solid ${TINTA}`,borderRadius:7,background:"transparent",color:TINTA,fontFamily:"inherit"}}>Aplicar</button>
                        </span>
                      )}
                    </div>

                    {/* sectores del lote en edición */}
                    {loteDiv && divisiones[clL(loteDiv.campoId,loteDiv.loteId)] && (()=>{
                      const secs = divisiones[clL(loteDiv.campoId,loteDiv.loteId)];
                      const chk = chequeoDivision(loteDiv.campoId, loteDiv.loteId);
                      return (
                        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
                          {secs.map(s=>(
                            <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 40px",gap:6,alignItems:"center"}}>
                              <input value={s.nombre} onChange={e=>updateSector(loteDiv.campoId,loteDiv.loteId,s.id,"nombre",e.target.value)}
                                placeholder="nombre del sector" style={{...inputB,fontSize:12.5,padding:"5px 8px"}}/>
                              <input type="text" inputMode="decimal" value={s.ha}
                                onChange={e=>updateSector(loteDiv.campoId,loteDiv.loteId,s.id,"ha",e.target.value)}
                                style={{...inputB,fontSize:12.5,padding:"5px 8px",textAlign:"right"}}/>
                              <span style={{fontSize:11.5,opacity:0.6}}>ha</span>
                            </div>
                          ))}
                          <div style={{display:"flex",alignItems:"center",gap:10,fontSize:12}}>
                            <span style={{fontWeight:600,color:chk&&chk.ok?"#2E7D32":"#C0392B"}}>
                              {chk ? `${fmt(chk.suma)} de ${fmt(chk.total)} ha` : ""}
                              {chk && !chk.ok && ` — no cuadra con el lote`}
                            </span>
                            <button onClick={()=>{quitarDivision(loteDiv.campoId,loteDiv.loteId);setLoteDiv(null);}}
                              style={{marginLeft:"auto",padding:"4px 9px",fontSize:11.5,fontWeight:600,cursor:"pointer",border:"1px solid #C0392B",borderRadius:6,background:"transparent",color:"#C0392B",fontFamily:"inherit"}}>
                              Deshacer división
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    <button onClick={guardarLaborEnPlanilla} disabled={guardando||tratamientosActivos.length===0} style={{padding:"9px 15px",fontSize:12.5,fontWeight:700,cursor:guardando?"wait":"pointer",border:"none",borderRadius:8,background:tratamientosActivos.length===0?"#B5AF9D":"#2E7D32",color:"#fff",fontFamily:"inherit",opacity:guardando?0.7:1}}>{guardando?"Guardando…":"💾 Guardar en planilla"}</button>
                    <button onClick={descargarPDFOrden} style={{padding:"9px 13px",fontSize:12.5,fontWeight:700,cursor:"pointer",border:"none",borderRadius:8,background:TINTA,color:"#F3EFE3",fontFamily:"inherit"}}>⬇️ Descargar PDF y archivar</button>
                    <button onClick={imprimirOrdenCompleta} style={{padding:"9px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer",border:`1.5px solid ${TINTA}`,borderRadius:8,background:"transparent",color:TINTA,fontFamily:"inherit"}}>🖨️ Imprimir</button>
                    <button onClick={descargarPNG} style={{padding:"9px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer",border:`1.5px solid ${TINTA}`,borderRadius:8,background:"transparent",color:TINTA,fontFamily:"inherit"}}>⬇ PNG mapa actual</button>
                    <button onClick={limpiarOrd} style={{padding:"9px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer",border:`1.5px solid ${TINTA}`,borderRadius:8,background:"transparent",color:TINTA,fontFamily:"inherit"}}>Limpiar campo</button>
                    <button onClick={nuevaOrden} style={{padding:"9px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer",border:"1.5px solid #C0392B",borderRadius:8,background:"transparent",color:"#C0392B",fontFamily:"inherit"}}>Reset orden</button>
                  </div>
                  {pdfMsg&&(
                    <div style={{marginTop:8,padding:"9px 12px",borderRadius:8,fontSize:12.5,fontWeight:600,background:pdfMsg.ok?"#E8F5E9":"#FFF6DD",color:pdfMsg.ok?"#2E7D32":"#8A6200",border:`1px solid ${pdfMsg.ok?"#A5D6A7":"#E9CF7A"}`}}>
                      {pdfMsg.texto}
                    </div>
                  )}
                  {guardadoMsg&&(
                    <div style={{marginTop:8,padding:"9px 12px",borderRadius:8,fontSize:12.5,fontWeight:600,background:guardadoMsg.ok?"#E8F5E9":"#FDECEA",color:guardadoMsg.ok?"#2E7D32":"#C0392B",border:`1px solid ${guardadoMsg.ok?"#A5D6A7":"#F5C6CB"}`}}>
                      {guardadoMsg.texto}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── RECIBOS GENERADOS ─── */}
              {tratamientosActivos.length > 0 && (
                <div className="orden-completa-print" style={{display:"flex",flexDirection:"column",gap:14,marginTop:6}}>
                  <div className="print-only" style={{padding:"10px 0",borderBottom:`2px solid ${TINTA}`,marginBottom:8}}>
                    <div style={{fontSize:20,fontWeight:700}}>Orden de labor · {fmtFecha(ordFecha,{day:"2-digit",month:"2-digit",year:"numeric"})}</div>
                    <div style={{fontSize:13,marginTop:4}}>Productor: <b>{ordProductor}</b> · Labor: <b>{ordTipo}</b> · Total: <b>{fmt(haTotalOrden())} ha</b></div>
                  </div>
                  <div className="no-print" style={{fontSize:12,letterSpacing:"0.2em",textTransform:"uppercase",opacity:0.6}}>Recibos generados</div>

                  {/* Mapas resumen: un mapa por campo con TODOS los tratamientos pintados */}
                  <div className="print-only" style={{display:"flex",flexDirection:"column",gap:14,marginBottom:10}}>
                    {(() => {
                      // Agrupar por campo: {campoId: {campo, lotesPorTrat: {tratIdx: [{label,ha}]}}}
                      const porCampo = {};
                      CAMPOS.forEach(c => {
                        unidadesDe(c.id).forEach(u => {
                          const idx = pintura[u.key];
                          if(idx === undefined) return;
                          if(!porCampo[c.id]) porCampo[c.id] = {campo: c, lotesPorTrat: {}};
                          if(!porCampo[c.id].lotesPorTrat[idx]) porCampo[c.id].lotesPorTrat[idx] = [];
                          porCampo[c.id].lotesPorTrat[idx].push({label: u.label, ha: u.ha, loteId: u.loteId, key: u.key});
                        });
                      });
                      return Object.values(porCampo).map(({campo, lotesPorTrat}) => {
                        const [vx,vy,vw,vh] = campo.vb;
                        const kk = vw/700;
                        // Mapa de unidad (lote o sector) -> tratIdx para pintar
                        const pintadoPorUnidad = {};
                        Object.entries(lotesPorTrat).forEach(([tIdx, lotes]) => {
                          lotes.forEach(l => { pintadoPorUnidad[l.key] = Number(tIdx); });
                        });
                        const haTotalCampo = Object.values(lotesPorTrat).reduce((s,arr) => s + arr.reduce((a,b)=>a+b.ha,0), 0);
                        return (
                          <div key={campo.id} style={{border:`1.5px solid ${TINTA}`,borderRadius:8,padding:"10px 12px",background:"#fff",pageBreakInside:"avoid"}}>
                            <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                              <div style={{fontSize:14,fontWeight:700}}>{campo.nombre}</div>
                              <div style={{fontSize:12,opacity:0.7}}>{fmt(haTotalCampo)} ha totales</div>
                            </div>
                            {/* Leyenda de tratamientos presentes en este campo */}
                            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8,fontSize:11}}>
                              {Object.entries(lotesPorTrat).map(([tIdx, lotes]) => {
                                const t = tratamientos[Number(tIdx)];
                                const haT = lotes.reduce((s,l)=>s+l.ha,0);
                                return (
                                  <div key={tIdx} style={{display:"flex",alignItems:"center",gap:5}}>
                                    <svg width="14" height="14" style={{flexShrink:0}}><rect width="14" height="14" fill={COLORES_APP[Number(tIdx)]} stroke={TINTA} strokeWidth="1"/></svg>
                                    <span><b>T{Number(tIdx)+1}</b>{t?.etiqueta?` · ${t.etiqueta}`:""}{t?.cultivo?` · ${t.cultivo}`:""} — lote{lotes.length>1?"s":""} {lotes.map(l=>l.label).join(", ")} ({fmt(haT)} ha)</span>
                                  </div>
                                );
                              })}
                            </div>
                            <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{width:"100%",height:"auto",display:"block",border:`1px solid ${TINTA}`,background:"#fff",maxHeight:520}}>
                              {(campo.grises||[]).map((g,j)=>(
                                <polygon key={`g${j}`} points={g.poly.map(p=>p.join(",")).join(" ")} fill="#EDEBE3" stroke="#B5AF9D" strokeWidth={kk}/>
                              ))}
                              {unidadesDe(campo.id).map(u => {
                                const [cx,cy] = centro(u.poly);
                                const tIdx = pintadoPorUnidad[u.key];
                                const pintado = tIdx !== undefined;
                                const w = anchoP(u.poly);
                                return (
                                  <g key={u.key}>
                                    <polygon points={u.poly.map(p=>p.join(",")).join(" ")}
                                      fill={pintado?COLORES_APP[tIdx]:"#fff"}
                                      fillOpacity={pintado?0.85:1}
                                      stroke={TINTA}
                                      strokeWidth={(pintado?2:1)*kk}/>
                                    {w>=34*kk && (
                                      <g style={{pointerEvents:"none"}}>
                                        <text x={cx} y={cy-2*kk} fontSize={(w<55*kk?9:10.5)*kk} fontWeight="700" textAnchor="middle" fill={pintado?"#fff":TINTA} style={pintado?{paintOrder:"stroke",stroke:"rgba(0,0,0,0.25)",strokeWidth:2*kk}:{}}>{u.label}</text>
                                        {u.ha>0 && <text x={cx} y={cy+9*kk} fontSize={(w<55*kk?7:8)*kk} textAnchor="middle" fill={pintado?"#fff":TINTA} opacity={pintado?0.95:0.6}>{u.ha} ha</text>}
                                      </g>
                                    )}
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {tratamientosActivos.map(t => {
                    // Agrupar lotes de este tratamiento por campo
                    const camposDelTrat = {};
                    CAMPOS.forEach(c => {
                      unidadesDe(c.id).forEach(l => {
                        if(pintura[l.key] === t.idx) {
                          if(!camposDelTrat[c.id]) camposDelTrat[c.id] = {campo: c, lotes: []};
                          camposDelTrat[c.id].lotes.push({label: l.label, ha: l.ha});
                        }
                      });
                    });
                    return Object.values(camposDelTrat).map(({campo: c, lotes: lotesC}) => {
                      const haC = lotesC.reduce((s,x) => s+x.ha, 0);
                      const lotesLabel = lotesC.map(x => x.label).join(", ");
                      const costoC = t.filasActivas.reduce((s,p) => s + (p.d||0)*haC*(p.p||0), 0);
                      return (
                        <div key={`${t.idx}-${c.id}`} style={{background:"#fff",border:`2px solid ${TINTA}`,borderRadius:10,overflow:"hidden",pageBreakInside:"avoid"}}>
                          <div style={{position:"relative",padding:"6px 12px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#fff",overflow:"hidden"}}>
                            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} preserveAspectRatio="none"><rect width="100%" height="100%" fill={COLORES_APP[t.idx]}/></svg>
                            <span style={{position:"relative"}}>Tratamiento {t.idx+1} {t.etiqueta && `· ${t.etiqueta}`} {t.cultivo && `· ${t.cultivo}`}</span>
                          </div>
                          {/* Header estilo recibo */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:`1px solid ${TINTA}`,background:"#F8F5EC"}}>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7,borderRight:"1px solid #E5E0D0"}}>PRODUCTOR</div>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7,borderRight:"1px solid #E5E0D0"}}></div>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7,gridColumn:"3 / span 2"}}>FECHA</div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:"1px solid #E5E0D0"}}>
                            <div style={{padding:"6px 10px",fontSize:13,fontWeight:700,borderRight:"1px solid #E5E0D0",gridColumn:"1 / span 2"}}>{ordProductor}</div>
                            <div style={{padding:"6px 10px",fontSize:13,gridColumn:"3 / span 2",textAlign:"center"}}>{fmtFecha(ordFecha,{day:"2-digit",month:"2-digit",year:"numeric"})}</div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:"1px solid #E5E0D0",background:"#F8F5EC"}}>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7,borderRight:"1px solid #E5E0D0"}}>CAMPO</div>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7,borderRight:"1px solid #E5E0D0"}}>LOTES</div>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7,borderRight:"1px solid #E5E0D0"}}>HAS</div>
                            <div style={{padding:"5px 10px",fontSize:10.5,textTransform:"uppercase",opacity:0.7}}>CULTIVO</div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:`1.5px solid ${TINTA}`}}>
                            <div style={{padding:"6px 10px",fontSize:13,fontWeight:700,borderRight:"1px solid #E5E0D0"}}>{c.nombre.toUpperCase()}</div>
                            <div style={{padding:"6px 10px",fontSize:13,fontWeight:600,borderRight:"1px solid #E5E0D0"}}>{lotesLabel}</div>
                            <div style={{padding:"6px 10px",fontSize:14,fontWeight:700,borderRight:"1px solid #E5E0D0"}}>{fmt(haC)}</div>
                            <div style={{padding:"6px 10px",fontSize:13,fontWeight:700,textTransform:"uppercase"}}>{t.cultivo || "—"}</div>
                          </div>
                          {/* Productos */}
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{background:"#EEE9DC"}}>
                                <th style={{textAlign:"left",padding:"5px 10px",fontWeight:700,fontSize:10.5,textTransform:"uppercase",borderBottom:`1px solid ${TINTA}`}}>Producto</th>
                                <th style={{textAlign:"right",padding:"5px 10px",fontWeight:700,fontSize:10.5,textTransform:"uppercase",borderBottom:`1px solid ${TINTA}`}}>Dosis/ha</th>
                                <th style={{textAlign:"right",padding:"5px 10px",fontWeight:700,fontSize:10.5,textTransform:"uppercase",borderBottom:`1px solid ${TINTA}`}}>Total</th>
                                <th className="no-print" style={{textAlign:"right",padding:"5px 10px",fontWeight:700,fontSize:10.5,textTransform:"uppercase",borderBottom:`1px solid ${TINTA}`}}>Precio/{t.filasActivas[0]?.u||"L"}</th>
                                <th className="no-print" style={{textAlign:"right",padding:"5px 10px",fontWeight:700,fontSize:10.5,textTransform:"uppercase",borderBottom:`1px solid ${TINTA}`}}>USD</th>
                                <th className="no-print" style={{textAlign:"right",padding:"5px 10px",fontWeight:700,fontSize:10.5,textTransform:"uppercase",borderBottom:`1px solid ${TINTA}`}}>USD/ha</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.filasActivas.map((p,i) => {
                                const totalP = p.d * haC;
                                const costoP = totalP * (p.p||0);
                                return (
                                  <tr key={i} style={{borderBottom:"1px solid #EEE9DC"}}>
                                    <td style={{padding:"5px 10px",fontWeight:600}}>{p.n}</td>
                                    <td style={{padding:"5px 10px",textAlign:"right"}}>{p.d.toFixed(3)}</td>
                                    <td style={{padding:"5px 10px",textAlign:"right"}}>{fmtCant(totalP)}</td>
                                    <td className="no-print" style={{padding:"5px 10px",textAlign:"right"}}>{p.p.toFixed(2)}</td>
                                    <td className="no-print" style={{padding:"5px 10px",textAlign:"right",fontWeight:600}}>{fmt(costoP)}</td>
                                    <td className="no-print" style={{padding:"5px 10px",textAlign:"right"}}>{(costoP/haC).toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="no-print" style={{background:"#F8F5EC",borderTop:`2px solid ${TINTA}`}}>
                                <td colSpan={4} style={{padding:"7px 10px",textAlign:"right",fontWeight:700,fontSize:12}}>TOTAL $</td>
                                <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,fontSize:14}}>{fmt(costoC)}</td>
                                <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,fontSize:14}}>{(costoC/haC).toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    });
                  })}

                  {/* Totalizador general */}
                  <div style={{background:"#FFFDF7",border:`2.5px solid ${TINTA}`,borderRadius:10,padding:"14px 18px"}}>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.1em"}}>Totales {ordProductor.toLowerCase()}:</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <tbody>
                        {listaTotales.map((t,i) => (
                          <tr key={i} style={{borderBottom:"1px solid #E5E0D0"}}>
                            <td style={{padding:"6px 4px",fontWeight:600}}>{t.n}</td>
                            <td style={{padding:"6px 4px",textAlign:"right",fontWeight:700}}>{fmtCant(t.total)} {t.u}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{borderTop:`2px solid ${TINTA}`,background:"#F3EFE3"}}>
                          <td style={{padding:"10px 4px",fontWeight:700,fontSize:14}}>TOTAL orden: {fmt(haTotalO)} ha</td>
                          <td className="no-print" style={{padding:"10px 4px",textAlign:"right",fontWeight:700,fontSize:15}}>USD {fmt(costoTotalGeneral)}</td>
                        </tr>
                        {haTotalO > 0 && (
                          <tr className="no-print">
                            <td style={{padding:"3px 4px",fontSize:11.5,opacity:0.65}}>Costo promedio por ha</td>
                            <td style={{padding:"3px 4px",textAlign:"right",fontSize:12,opacity:0.65}}>USD {(costoTotalGeneral/haTotalO).toFixed(2)}/ha</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {tratamientosActivos.length === 0 && (
                <div style={{padding:"25px 20px",textAlign:"center",background:"#F8F5EC",border:"1.5px dashed #B5AF9D",borderRadius:12}}>
                  <div style={{fontSize:14,opacity:0.7}}>Elegí un tratamiento, pintá lotes y armale su receta.</div>
                  <div style={{fontSize:12.5,opacity:0.55,marginTop:4}}>Podés armar hasta 4 tratamientos distintos en la misma orden.</div>
                </div>
              )}
            </div>
          );
        })()}

        <div style={{fontSize:11,opacity:0.45,marginTop:20,textAlign:"center"}}>
          Invierno 26-27: sembrado al 30/6/2026. Análisis de suelo: L3H 2017-2025. Márgenes: 25-26 cosechado.
        </div>

        {/* ══ PROTOCOLOS ══ */}

        <div style={{fontSize:11,opacity:0.45,marginTop:20,textAlign:"center"}}>
        </div>
      </div>

      {/* MODAL HISTORIAL LOTE */}
      {loteAbierto&&<ModalHistorial loteInfo={loteAbierto} onClose={cerrarLote} monit={monit} cultivoDe={cultivoDe} siembraDe={siembraDe} autor={autor} cambiarAutor={cambiarAutor} aplicaciones={APLICACIONES} fertilizaciones={FERTILIZACIONES} inv26={INV_26} plan2627={PLAN_2627} suelos={SUELOS}/>}
    </div>
  );
}

// ============================================================
// MODAL HISTORIAL — muestra 8 campañas de un lote
// ============================================================
function ModalHistorial({loteInfo, onClose, aplicaciones=[], fertilizaciones=[], inv26={}, plan2627={}, suelos={}, monit, cultivoDe, siembraDe, autor, cambiarAutor}){
  const {campo,lote}=loteInfo;
  const [monitoreando,setMonitoreando]=useState(false);
  const [aviso,setAviso]=useState(null);
  const cajaRef=useRef(null);
  const fFecha=s=>{ const d=fechaLocal(s); return d?ddmm(d):s; };
  // Últimos monitoreos de este lote (la lista viene ordenada de más nuevo a más viejo)
  const monLote=(monit?.lista||[]).filter(m=>m.campo===campo.id&&String(m.lote)===String(lote.id)).slice(0,3);

  // Filtrar aplicaciones y fert de este lote (matching flexible)
  const matchLote=(x)=> x.campo===campo.id && refApuntaALote(x.lote, lote.id);
  const aplLote=aplicaciones.filter(matchLote).sort((a,b)=>fechaLocal(b.fecha)-fechaLocal(a.fecha));
  const fertLote=fertilizaciones.filter(matchLote).sort((a,b)=>fechaLocal(b.fecha)-fechaLocal(a.fecha));
  const ultimaApl=aplLote[0]||null;

  // Sumar kg totales de fertilizante en la campaña actual (26-27, o últimas 12 meses)
  const haceUnAnio=new Date();
  haceUnAnio.setFullYear(haceUnAnio.getFullYear()-1);
  const fertRecientes=fertLote.filter(f=>fechaLocal(f.fecha)>=haceUnAnio);
  // Extraer kg/ha del texto de dosis (ej "150 kg/ha" → 150)
  const parseKg=(dosis)=>{
    if(!dosis) return 0;
    const m=(dosis+"").match(/(\d+(?:\.\d+)?)\s*kg/i);
    return m?parseFloat(m[1]):0;
  };
  // Agrupar por producto
  const fertPorProducto={};
  fertRecientes.forEach(f=>{
    const kgHa=parseKg(f.dosis);
    const key2=f.producto||"Fertilizante";
    if(!fertPorProducto[key2]) fertPorProducto[key2]={kgHa:0, kgTotal:0, apps:0, fechas:[]};
    fertPorProducto[key2].kgHa+=kgHa;
    fertPorProducto[key2].kgTotal+=kgHa*(f.ha||lote.ha||0);
    fertPorProducto[key2].apps+=1;
    fertPorProducto[key2].fechas.push(f.fecha);
  });
  const fertResumen=Object.entries(fertPorProducto).sort((a,b)=>b[1].kgHa-a[1].kgHa);
  const kgHaTotal=Object.values(fertPorProducto).reduce((s,f)=>s+f.kgHa,0);

  const overlay={position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16};
  const modal={background:CREMA,borderRadius:14,maxWidth:640,width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`2px solid ${TINTA}`};

  return (
    <div style={overlay} onClick={()=>{ if(!monitoreando) onClose(); }}>
      <div ref={cajaRef} style={modal} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${TINTA}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div>
            <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.6}}>{campo.nombre}</div>
            <div style={{fontSize:22,fontWeight:700,marginTop:2}}>Lote {lote.label||lote.id}</div>
            <div style={{fontSize:13,opacity:0.7,marginTop:2}}>{lote.ha} ha</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:26,cursor:"pointer",lineHeight:1,color:TINTA,padding:4}}>×</button>
        </div>

        {/* ── MONITOREO DEL LOTE ── */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #D8D2C0",background:"#F4F8F1"}}>
          {monitoreando?(
            <FormMonitoreo monit={monit} campoId={campo.id} loteId={lote.id} cultivoDe={cultivoDe} siembraDe={siembraDe} autor={autor} cambiarAutor={cambiarAutor}
              onListo={m=>{ setAviso(m); setMonitoreando(false); cajaRef.current?.scrollTo({top:0}); }} onCancelar={()=>setMonitoreando(false)}/>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              <button onClick={()=>{ setAviso(null); setMonitoreando(true); }}
                style={{padding:"13px 16px",fontSize:16,fontWeight:700,borderRadius:10,border:"none",background:"#2E7D32",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>🔍 Monitorear este lote</button>
              {aviso&&<div style={{fontSize:13,fontWeight:600,color:aviso.ok?"#2E7D32":"#8A6200"}}>{aviso.txt}</div>}
              {monLote.length>0?(
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55}}>Últimos monitoreos</div>
                  {monLote.map(m=>{ const n=NIVEL_MONITOREO[m.nivel]||NIVEL_MONITOREO.ok; return (
                    <div key={m.id} style={{fontSize:12.5,background:"#fff",borderLeft:`4px solid ${n.color}`,borderRadius:6,padding:"6px 9px"}}>
                      <b>{fFecha(m.fecha)}</b> · <span style={{color:n.color,fontWeight:700}}>{n.icono} {n.txt}</span>
                      {m.estado&&<span style={{opacity:0.75}}> · {m.estado}</span>}
                      {[m.malezas,m.plagas,m.enfermedades].filter(Boolean).length>0&&<div style={{marginTop:2}}>{[m.malezas,m.plagas,m.enfermedades].filter(Boolean).join(" · ")}</div>}
                      {m.nacimiento&&<div style={{marginTop:2}}>🌱 {m.nacimiento}</div>}
                      {m.accion&&<div style={{marginTop:2,color:"#1E5FA8"}}>→ {m.accion}</div>}
                    </div>
                  );})}
                </div>
              ):<div style={{fontSize:12,opacity:0.6,fontStyle:"italic"}}>Todavía no se monitoreó este lote.</div>}
            </div>
          )}
        </div>

        {!monitoreando&&<>
        {/* ── 1. CAMPAÑA ACTUAL 26-27 ── */}
        {(()=>{
          const k=`${campo.id}|${lote.id}`;
          const fina=buscarKey(inv26, campo.id, lote.id);
          const plan=buscarKey(plan2627, campo.id, lote.id);
          const suelo=buscarKey(suelos, campo.id, lote.id);
          let cvFina=fina, cvGruesa=null;
          if(plan){
            if(plan.includes("-")){
              const [f,g]=plan.split("-").map(s=>s.trim());
              cvFina=cvFina||f;
              cvGruesa=g;
            } else cvGruesa=plan;
          }
          if(cvFina&&cvGruesa&&baseCv(cvFina)===baseCv(cvGruesa)) cvGruesa=null;
          const sinDatos=!cvFina&&!cvGruesa;
          return (
            <div style={{padding:"16px 20px",borderBottom:"1px solid #D8D2C0",background:"#FFFDF7"}}>
              <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>Campaña 26-27</div>
              {sinDatos?(
                <div style={{opacity:0.55,fontStyle:"italic",fontSize:13}}>Sin cultivo asignado.</div>
              ):(
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {cvFina&&(
                    <div style={{flex:"1 1 200px",background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:9,padding:"10px 12px"}}>
                      <div style={{fontSize:10.5,letterSpacing:"0.1em",textTransform:"uppercase",opacity:0.55}}>{cvGruesa?"Fina":"Cultivo"}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        <span style={{width:18,height:18,borderRadius:4,background:colorCv(cvFina),border:`1px solid ${TINTA}`,flexShrink:0}}/>
                        <span style={{fontSize:18,fontWeight:700}}>{cvFina}</span>
                      </div>
                    </div>
                  )}
                  {cvGruesa&&(
                    <div style={{flex:"1 1 200px",background:"#fff",border:`1.5px solid ${TINTA}`,borderRadius:9,padding:"10px 12px"}}>
                      <div style={{fontSize:10.5,letterSpacing:"0.1em",textTransform:"uppercase",opacity:0.55}}>{cvFina?"Gruesa":"Cultivo"}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        <span style={{width:18,height:18,borderRadius:4,background:colorCv(cvGruesa),border:`1px solid ${TINTA}`,flexShrink:0}}/>
                        <span style={{fontSize:18,fontWeight:700}}>{cvGruesa}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {suelo&&(
                <div style={{marginTop:10,fontSize:12,opacity:0.75,display:"flex",gap:12,flexWrap:"wrap"}}>
                  <span>🔬 Análisis {suelo.fecha}:</span>
                  {suelo.P!=null&&<span><b>P</b> {suelo.P}</span>}
                  {suelo.N!=null&&<span><b>N</b> {suelo.N}</span>}
                  {suelo.MO!=null&&<span><b>MO</b> {suelo.MO}%</span>}
                  {suelo.IMO&&<span><b>IMO</b> {suelo.IMO}</span>}
                  {suelo.pH&&<span><b>pH</b> {suelo.pH}</span>}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 2. ÚLTIMAS APLICACIONES DE HERBICIDA ── */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #D8D2C0"}}>
          <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>🧪 Aplicaciones de herbicida</div>
          {aplLote.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {aplLote.slice(0,3).map((a,i)=>(
                <div key={a.id||i} style={{background:i===0?"#FFFDF7":"#fff",border:i===0?`1.5px solid ${TINTA}`:"1px solid #E5E0D0",borderRadius:9,padding:"9px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
                    <div style={{fontWeight:700,fontSize:13.5}}>
                      {fmtFecha(a.fecha)}
                      {i===0&&<span style={{fontSize:10,marginLeft:6,padding:"2px 6px",background:TINTA,color:"#fff",borderRadius:4,letterSpacing:"0.05em"}}>ÚLTIMA</span>}
                    </div>
                    <div style={{fontSize:12,opacity:0.65}}>
                      {a.ha} ha · US$ {a.costo?.toFixed(0)||"—"} <span style={{opacity:0.6}}>(${((a.costo||0)/(a.ha||1)).toFixed(1)}/ha)</span>
                    </div>
                  </div>
                  {a.cultivo&&<div style={{fontSize:11.5,marginTop:3,opacity:0.7}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                      <span style={{width:8,height:8,borderRadius:2,background:colorCv(a.cultivo)}}/>{a.cultivo}
                    </span>
                  </div>}
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                    {(a.productos||[]).map((p,j)=>(
                      <span key={j} style={{fontSize:10.5,background:"#F3EFE3",borderRadius:4,padding:"2px 6px",fontWeight:600}}>{p}</span>
                    ))}
                  </div>
                </div>
              ))}
              {aplLote.length>3&&(
                <div style={{fontSize:11,opacity:0.55,fontStyle:"italic",textAlign:"center",marginTop:2}}>
                  + {aplLote.length-3} aplicación(es) más
                </div>
              )}
            </div>
          ):(
            <div style={{fontSize:12.5,opacity:0.55,fontStyle:"italic"}}>Sin aplicaciones registradas.</div>
          )}
        </div>

        {/* ── 3. FERTILIZACIÓN CAMPAÑA ACTUAL ── */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #D8D2C0"}}>
          <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",opacity:0.55,marginBottom:8}}>🌱 Fertilización campaña actual</div>
          {fertResumen.length>0?(
            <div>
              <div style={{background:"#FFFDF7",border:`1.5px solid ${TINTA}`,borderRadius:9,padding:"10px 12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:6}}>
                  <div style={{fontSize:20,fontWeight:700}}>{kgHaTotal.toFixed(0)} kg/ha</div>
                  <div style={{fontSize:12,opacity:0.7}}>total aplicado · {fertRecientes.length} aplicación(es)</div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {fertResumen.map(([prod,d])=>(
                  <div key={prod} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#fff",border:"1px solid #EEE9DC",borderRadius:7,fontSize:12.5}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700}}>{prod}</div>
                      <div style={{fontSize:11,opacity:0.6}}>
                        {d.apps} aplicación{d.apps>1?"es":""} · {d.fechas.map(f=>fmtFecha(f,{day:"2-digit",month:"short"})).join(", ")}
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontWeight:700,color:"#3B82C4"}}>{d.kgHa.toFixed(0)} kg/ha</div>
                      {d.kgTotal>0&&<div style={{fontSize:10.5,opacity:0.55}}>{d.kgTotal.toFixed(0)} kg total</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ):(
            <div style={{fontSize:12.5,opacity:0.55,fontStyle:"italic"}}>Sin fertilizaciones registradas en los últimos 12 meses.</div>
          )}
        </div>

        </>}
      </div>
    </div>
  );
}
