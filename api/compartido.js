// api/compartido.js
// Vercel Serverless Function — documentos de la app COMPARTIDOS entre Santos y Andrés:
//   ?doc=protocolo  protocolo de residuales (pestaña Protocolo)
//   ?doc=precios    precios editados de los productos (pestaña Precios)
// Cada uno se guarda en su hoja de la planilla LABORES S-MIX 26-27, en la fila 2:
//   A actualizado (ISO) | B autor | C… el JSON partido en trozos
// (una celda admite hasta 50.000 caracteres).
//
// GET  ?doc=…               → { datos | null, actualizado, autor }
// POST ?doc=… {datos, autor} → guarda y devuelve { ok, actualizado }
//
// Requiere la env GOOGLE_CREDENTIALS (la misma que usa guardar-labor.js).

import { google } from "googleapis";
import { claveOk } from "./_clave.js";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const DOCS = {
  protocolo: d => d && Array.isArray(d.cultivos),
  precios:   d => d && typeof d.precios === "object" && !Array.isArray(d.precios),
};
const TROZO = 40000;

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

// Crea la hoja la primera vez, con su encabezado
async function asegurarHoja(sheets, HOJA) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: PLANILLA_LABORES });
  if (meta.data.sheets.some(s => s.properties.title === HOJA)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILLA_LABORES,
    requestBody: { requests: [{ addSheet: { properties: { title: HOJA } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANILLA_LABORES,
    range: `${HOJA}!A1:C1`,
    valueInputOption: "RAW",
    requestBody: { values: [["actualizado", "autor", "json (lo escribe la app, no editar a mano)"]] },
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-clave");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!claveOk(req, res)) return;

  const doc = String(req.query?.doc || "protocolo");
  if (!DOCS[doc]) return res.status(400).json({ error: `Documento desconocido: ${doc}` });
  const HOJA = doc;

  try {
    const auth = getAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: "v4", auth });
    await asegurarHoja(sheets, HOJA);

    if (req.method === "GET") {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A2:Z2` });
      const fila = (r.data.values || [])[0] || [];
      const json = fila.slice(2).join("");
      let datos = null;
      if (json) { try { datos = JSON.parse(json); } catch { datos = null; } }
      return res.status(200).json({ datos, actualizado: fila[0] || null, autor: fila[1] || "" });
    }

    if (req.method === "POST") {
      const { datos, autor } = req.body || {};
      if (!DOCS[doc](datos)) return res.status(400).json({ error: `Datos inválidos para ${doc}.` });
      const json = JSON.stringify(datos);
      const trozos = [];
      for (let i = 0; i < json.length; i += TROZO) trozos.push(json.slice(i, i + TROZO));
      if (trozos.length > 24) return res.status(413).json({ error: "Es demasiado grande para guardarlo." });
      const actualizado = new Date().toISOString();
      await sheets.spreadsheets.values.clear({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A2:Z2` });
      await sheets.spreadsheets.values.update({
        spreadsheetId: PLANILLA_LABORES,
        range: `${HOJA}!A2`,
        valueInputOption: "RAW",
        requestBody: { values: [[actualizado, String(autor || ""), ...trozos]] },
      });
      return res.status(200).json({ ok: true, actualizado });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(`Error en ${doc}:`, err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
