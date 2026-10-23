// api/lluvias.js
// Vercel Serverless Function — lluvias por campo, COMPARTIDAS. La app las usa para saber si un
// residual se activó (protocolo: 10–15 mm dentro de los 10–15 días de aplicado).
// Se guardan en la hoja "lluvias" de la planilla LABORES S-MIX 26-27, una fila por campo y lluvia.
//
// GET                     → { lluvias: [...] }  (más nuevas primero)
// POST {registro}         → guarda o pisa (por id)
// POST {id, borrar:true}  → la borra
//
// Requiere la env GOOGLE_CREDENTIALS (la misma que usa guardar-labor.js).

import { google } from "googleapis";
import { claveOk } from "./_clave.js";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA = "lluvias";
const CAMPOS_FILA = ["id", "fecha", "campo", "mm", "nota", "autor", "registrado"];
const ENCABEZADO = ["id", "fecha", "campo", "mm", "nota", "registró", "registrado (app)"];
const ULTIMA_COL = "G";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

// Crea la hoja la primera vez, con su encabezado
async function asegurarHoja(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: PLANILLA_LABORES });
  if (meta.data.sheets.some(s => s.properties.title === HOJA)) return;
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
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A2:${ULTIMA_COL}20000` });
  return r.data.values || [];
}

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
      const lluvias = (await leerFilas(sheets)).filter(f => f[0])
        .map(f => ({ ...Object.fromEntries(CAMPOS_FILA.map((k, i) => [k, f[i] || ""])), mm: Number(String(f[3] || "").replace(",", ".")) || 0 }))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      return res.status(200).json({ lluvias });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { registro, id: idBorrar, borrar } = req.body || {};
    const filas = await leerFilas(sheets);
    if (borrar) {
      const idx = filas.findIndex(f => f[0] === idBorrar);
      if (idx < 0) return res.status(200).json({ ok: true, borrado: false });
      await sheets.spreadsheets.values.clear({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A${idx + 2}:${ULTIMA_COL}${idx + 2}` });
      return res.status(200).json({ ok: true, borrado: true });
    }

    const r = registro || {};
    const mm = Number(String(r.mm ?? "").replace(",", "."));
    if (!r.id || !r.fecha || !r.campo || !(mm >= 0)) return res.status(400).json({ error: "Faltan datos: fecha, campo y mm." });
    const idx = filas.findIndex(f => f[0] === r.id);
    const fila = idx >= 0 ? idx + 2 : filas.length + 2;
    const valores = CAMPOS_FILA.map(k => k === "registrado" ? new Date().toISOString() : k === "mm" ? mm : String(r[k] ?? "").slice(0, 2000));
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILLA_LABORES,
      range: `${HOJA}!A${fila}:${ULTIMA_COL}${fila}`,
      valueInputOption: "RAW",
      requestBody: { values: [valores] },
    });
    return res.status(200).json({ ok: true, fila });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error guardando la lluvia." });
  }
}
