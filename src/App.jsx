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
