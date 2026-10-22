// api/protocolo.js
// Vercel Serverless Function — protocolo de residuales COMPARTIDO entre Santos y Andrés.
// Se guarda en la hoja "protocolo" de la planilla LABORES S-MIX 26-27, en la fila 2:
//   A actualizado (ISO) | B autor | C… el JSON del protocolo partido en trozos
// (una celda admite hasta 50.000 caracteres).
//
// GET                    → { protocolo | null, actualizado, autor }
// POST {protocolo, autor} → guarda y devuelve { ok, actualizado }
//
// Requiere la env GOOGLE_CREDENTIALS (la misma que usa guardar-labor.js).

import { google } from "googleapis";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA = "protocolo";
const TROZO = 40000;

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = getAuth();
    await auth.authorize();
    const sheets = google.sheets({ version: "v4", auth });
    await asegurarHoja(sheets);

    if (req.method === "GET") {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA}!A2:Z2` });
      const fila = (r.data.values || [])[0] || [];
      const json = fila.slice(2).join("");
      let protocolo = null;
      if (json) { try { protocolo = JSON.parse(json); } catch { protocolo = null; } }
      return res.status(200).json({ protocolo, actualizado: fila[0] || null, autor: fila[1] || "" });
    }

    if (req.method === "POST") {
      const { protocolo, autor } = req.body || {};
      if (!protocolo || !Array.isArray(protocolo.cultivos)) {
        return res.status(400).json({ error: "Protocolo inválido: falta la lista de cultivos." });
      }
      const json = JSON.stringify(protocolo);
      const trozos = [];
      for (let i = 0; i < json.length; i += TROZO) trozos.push(json.slice(i, i + TROZO));
      if (trozos.length > 24) return res.status(413).json({ error: "El protocolo es demasiado grande para guardarlo." });
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
    console.error("Error en protocolo:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
