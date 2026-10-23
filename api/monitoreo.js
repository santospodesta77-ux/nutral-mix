// api/monitoreo.js
// Vercel Serverless Function — monitoreos de lotes (recorridas a campo), COMPARTIDOS.
// Se guardan en la hoja "monitoreo" de la planilla LABORES S-MIX 26-27, una fila por lote recorrido,
// con columnas legibles para poder abrirla y filtrarla en Google Sheets.
//
// GET                       → { monitoreos: [...] }  (más nuevos primero)
// POST {monitoreo}          → guarda o pisa (por id) y devuelve { ok, fila }
// POST {id, borrar:true}    → lo borra
//
// Además, cada monitoreo se escribe en un Google Doc por campo ("Monitoreos – <campo>", en la
// subcarpeta "Monitoreos" de la carpeta de las órdenes), usando el Apps Script de los PDF.
// Si el Doc falla, el monitoreo igual queda guardado en la planilla (la respuesta trae docError).
//
// Requiere la env GOOGLE_CREDENTIALS (la misma que usa guardar-labor.js).
// Para los Docs: APPS_SCRIPT_PDF_URL, APPS_SCRIPT_PDF_TOKEN y (opcional) DRIVE_ORDENES_FOLDER.

import { google } from "googleapis";
import { claveOk } from "./_clave.js";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA = "monitoreo";
// Orden de las columnas en la hoja (A…V). Las columnas nuevas van siempre al final.
const CAMPOS_FILA = ["id", "fecha", "campo", "lote", "cultivo", "estado", "nivel", "malezas", "plagas",
  "enfermedades", "suelo", "observaciones", "accion", "autor", "registrado", "fotos",
  "malezasDensidad", "malezasTamano", "plantasHa", "sembradasHa", "logro", "nacimiento"];
const ENCABEZADO = ["id", "fecha", "campo", "lote", "cultivo", "estado del cultivo", "nivel", "malezas", "plagas",
  "enfermedades", "suelo / humedad", "observaciones", "acción sugerida", "recorrió", "registrado (app)", "fotos (links del Drive)",
  "malezas: densidad", "malezas: tamaño", "plantas logradas / ha", "semillas sembradas / ha", "logro %", "nacimientos (detalle)"];
const ULTIMA_COL = "V";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

// Crea la hoja la primera vez, con su encabezado
async function asegurarHoja(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: PLANILLA_LABORES });
  if (meta.data.sheets.some(s => s.properties.title === HOJA)) {
    // hoja de antes: si le faltan columnas nuevas en el encabezado, se agregan
    const enc = await sheets.spreadsheets.values.get({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A1:${ULTIMA_COL}1` });
    if (((enc.data.values || [])[0] || []).length < ENCABEZADO.length) {
      await sheets.spreadsheets.values.update({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A1:${ULTIMA_COL}1`,
        valueInputOption: "RAW", requestBody: { values: [ENCABEZADO] } });
    }
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILLA_LABORES,
    requestBody: { requests: [{ addSheet: { properties: { title: HOJA, gridProperties: { frozenRowCount: 1 } } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANILLA_LABORES,
    range: `${HOJA}!A1:${ULTIMA_COL}1`,
    valueInputOption: "RAW",
    requestBody: { values: [ENCABEZADO] },
  });
}

async function leerFilas(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILLA_LABORES,
    range: `${HOJA}!A2:${ULTIMA_COL}20000`,
  });
  return r.data.values || [];
}

// Le pasa el monitoreo (o el borrado) al Apps Script que arma los Docs por campo
async function alDoc(cuerpo) {
  const url = process.env.APPS_SCRIPT_PDF_URL, token = process.env.APPS_SCRIPT_PDF_TOKEN;
  if (!url || !token) return { docError: "Falta configurar el Apps Script (APPS_SCRIPT_PDF_URL y APPS_SCRIPT_PDF_TOKEN)." };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, carpeta: process.env.DRIVE_ORDENES_FOLDER || "", ...cuerpo }), signal: AbortSignal.timeout(40000) });
    const d = JSON.parse(await r.text());
    if (!d.ok) return { docError: d.error || "El Apps Script no pudo escribir el Doc." };
    // El script viejo no conoce "accion" y contesta como si fuera un PDF
    if (cuerpo.accion === "monitoreo" && !d.doc) return { docError: "Hay que actualizar el Apps Script (apps-script/guardar-pdf.gs) para los Docs de monitoreo." };
    return { docLink: d.link || "" };
  } catch (e) {
    return { docError: `El Apps Script no respondió bien: ${e.message}` };
  }
}

const aObjeto = f => Object.fromEntries(CAMPOS_FILA.map((k, i) => [k, f[i] || ""]));

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-clave");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!claveOk(req, res)) return;

  try {
    const auth = getAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: "v4", auth });
    await asegurarHoja(sheets);

    if (req.method === "GET") {
      const monitoreos = (await leerFilas(sheets)).filter(f => f[0]).map(aObjeto)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.registrado).localeCompare(String(a.registrado)));
      return res.status(200).json({ monitoreos });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { monitoreo, id: idBorrar, borrar } = req.body || {};
    const filas = await leerFilas(sheets);

    if (borrar) {
      const idx = filas.findIndex(f => f[0] === idBorrar);
      if (idx < 0) return res.status(200).json({ ok: true, borrado: false });
      await sheets.spreadsheets.values.clear({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A${idx + 2}:${ULTIMA_COL}${idx + 2}` });
      return res.status(200).json({ ok: true, borrado: true, ...(await alDoc({ accion: "monitoreo_borrar", id: idBorrar })) });
    }

    const m = monitoreo || {};
    if (!m.id || !m.fecha || !m.campo || !m.lote) {
      return res.status(400).json({ error: "Faltan datos: fecha, campo y lote." });
    }
    const idx = filas.findIndex(f => f[0] === m.id);
    const fila = idx >= 0 ? idx + 2 : filas.length + 2;
    const valores = CAMPOS_FILA.map(k => k === "registrado" ? new Date().toISOString() : String(m[k] ?? "").slice(0, 5000));
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILLA_LABORES,
      range: `${HOJA}!A${fila}:${ULTIMA_COL}${fila}`,
      valueInputOption: "RAW",
      requestBody: { values: [valores] },
    });
    return res.status(200).json({ ok: true, fila, ...(await alDoc({ accion: "monitoreo", monitoreo: m })) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error guardando el monitoreo." });
  }
}
