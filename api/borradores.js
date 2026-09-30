// api/borradores.js
// Vercel Serverless Function — borradores de órdenes COMPARTIDOS entre Santos y Andrés.
// Se guardan en la hoja "borradores" de la planilla LABORES S-MIX 26-27, una fila por borrador.
//
// Columnas: A id | B actualizado (ISO) | C autor | D titulo | E pdf | F json
//
// GET                      → { borradores: [...] }
// POST {id, autor, titulo, datos, pdf}  → guarda o pisa el borrador (upsert por id)
// POST {id, borrar:true}   → lo borra
//
// Requiere la env GOOGLE_CREDENTIALS (la misma que usa guardar-labor.js).

import { google } from "googleapis";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA = "borradores";
const DIAS_VIDA = 30;
const ENCABEZADO = ["id", "actualizado", "autor", "titulo", "pdf", "json"];

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

// Crea la hoja la primera vez, con su encabezado
async function asegurarHoja(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: PLANILLA_LABORES });
  const existe = meta.data.sheets.some(s => s.properties.title === HOJA);
  if (existe) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILLA_LABORES,
    requestBody: { requests: [{ addSheet: { properties: { title: HOJA } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANILLA_LABORES,
    range: `${HOJA}!A1:F1`,
    valueInputOption: "RAW",
    requestBody: { values: [ENCABEZADO] },
  });
}

async function leerFilas(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILLA_LABORES,
    range: `${HOJA}!A2:F5000`,
  });
  return r.data.values || [];
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
      const filas = await leerFilas(sheets);
      const corte = Date.now() - DIAS_VIDA * 24 * 60 * 60 * 1000;
      const borradores = filas
        .filter(f => f[0])
        .map(f => {
          let datos = null;
          try { datos = JSON.parse(f[5] || "null"); } catch {}
          return { id: f[0], actualizado: f[1] || "", autor: f[2] || "", titulo: f[3] || "", pdf: f[4] || "", datos };
        })
        .filter(b => b.datos && new Date(b.actualizado).getTime() > corte)
        .sort((a, b) => new Date(b.actualizado) - new Date(a.actualizado));
      return res.status(200).json({ borradores });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { id, autor, titulo, datos, pdf, borrar } = req.body || {};
    if (!id) return res.status(400).json({ error: "Falta el id del borrador." });

    const filas = await leerFilas(sheets);
    const idx = filas.findIndex(f => f[0] === id);   // 0-based sobre A2
    const fila = idx >= 0 ? idx + 2 : filas.length + 2;

    if (borrar) {
      if (idx < 0) return res.status(200).json({ ok: true, borrado: false });
      await sheets.spreadsheets.values.clear({
        spreadsheetId: PLANILLA_LABORES,
        range: `${HOJA}!A${fila}:F${fila}`,
      });
      return res.status(200).json({ ok: true, borrado: true });
    }

    const json = JSON.stringify(datos ?? {});
    if (json.length > 45000) return res.status(413).json({ error: "El borrador es demasiado grande." });

    const anterior = idx >= 0 ? filas[idx] : [];
    const valores = [[
      id,
      new Date().toISOString(),
      autor || anterior[2] || "",
      titulo || anterior[3] || "",
      pdf || anterior[4] || "",
      json,
    ]];
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILLA_LABORES,
      range: `${HOJA}!A${fila}:F${fila}`,
      valueInputOption: "RAW",
      requestBody: { values: valores },
    });
    return res.status(200).json({ ok: true, fila });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error guardando el borrador." });
  }
}
