// api/ganaderia.js
// Vercel Serverless Function — rodeos, caravanas y lo que les pasa (partos, ventas, cambios de lote…),
// en la planilla LABORES S-MIX 26-27:
//   hoja "rodeos"         id | campo | lote | nombre | servicio | sin caravana | notas      (cómo arrancó cada rodeo)
//   hoja "animales"       caravana | rodeo | categoria | raza | cc | estado | detalle | obs (inventario inicial)
//   hoja "rodeo_eventos"  lo que se carga desde la app, una fila por evento
// La app arma el estado de hoy (en qué lote está cada rodeo, qué caravanas siguen) aplicando los
// eventos sobre el inventario inicial, así funciona igual sin señal (los eventos quedan en cola).
//
// GET                    → { rodeos, animales, eventos }
// POST {evento}          → guarda o pisa (por id)
// POST {id, borrar:true} → borra el evento
//
// Requiere la env GOOGLE_CREDENTIALS (la misma que usa guardar-labor.js).

import { google } from "googleapis";
import { claveOk } from "./_clave.js";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA_EVENTOS = "rodeo_eventos";
// Orden de las columnas en la hoja de eventos (A…M). Las nuevas van siempre al final.
const CAMPOS_EVENTO = ["id", "fecha", "tipo", "rodeo", "caravanas", "cantidad", "campoHasta", "loteHasta", "rodeoHasta",
  "resultado", "detalle", "autor", "registrado"];
const ENCABEZADO_EVENTO = ["id", "fecha", "tipo", "rodeo", "caravanas", "cantidad sin caravana", "campo destino", "lote destino",
  "rodeo destino", "resultado", "detalle", "autor", "registrado (app)"];
const ULTIMA_COL = "M";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

// Crea la hoja de eventos la primera vez, con su encabezado
async function asegurarHoja(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: PLANILLA_LABORES });
  if (meta.data.sheets.some(s => s.properties.title === HOJA_EVENTOS)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILLA_LABORES,
    requestBody: { requests: [{ addSheet: { properties: { title: HOJA_EVENTOS, gridProperties: { frozenRowCount: 1 } } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANILLA_LABORES, range: `${HOJA_EVENTOS}!A1:${ULTIMA_COL}1`,
    valueInputOption: "RAW", requestBody: { values: [ENCABEZADO_EVENTO] },
  });
}

const filas = async (sheets, rango) => {
  try { return (await sheets.spreadsheets.values.get({ spreadsheetId: PLANILLA_LABORES, range: rango })).data.values || []; }
  catch { return []; }   // la hoja todavía no existe
};
const txt = v => String(v ?? "").trim();

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
    const leerEventos = () => filas(sheets, `${HOJA_EVENTOS}!A2:${ULTIMA_COL}20000`);

    if (req.method === "GET") {
      const [fr, fa, fe] = await Promise.all([filas(sheets, "rodeos!A2:G2000"), filas(sheets, "animales!A2:H20000"), leerEventos()]);
      const rodeos = fr.filter(f => txt(f[0])).map(f => ({ id: txt(f[0]), campo: txt(f[1]).toUpperCase(), lote: txt(f[2]), nombre: txt(f[3]),
        servicio: txt(f[4]), sinCaravana: Number(f[5]) || 0, notas: txt(f[6]) }));
      const animales = fa.filter(f => txt(f[0])).map(f => ({ caravana: txt(f[0]), rodeo: txt(f[1]), categoria: txt(f[2]), raza: txt(f[3]),
        cc: txt(f[4]), estado: txt(f[5]), detalle: txt(f[6]), obs: txt(f[7]) }));
      const eventos = fe.filter(f => f[0]).map(f => Object.fromEntries(CAMPOS_EVENTO.map((k, i) => [k, f[i] || ""])))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.registrado).localeCompare(String(a.registrado)));
      return res.status(200).json({ rodeos, animales, eventos });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { evento, id: idBorrar, borrar } = req.body || {};
    const actuales = await leerEventos();

    if (borrar) {
      const idx = actuales.findIndex(f => f[0] === idBorrar);
      if (idx < 0) return res.status(200).json({ ok: true, borrado: false });
      await sheets.spreadsheets.values.clear({ spreadsheetId: PLANILLA_LABORES, range: `${HOJA_EVENTOS}!A${idx + 2}:${ULTIMA_COL}${idx + 2}` });
      return res.status(200).json({ ok: true, borrado: true });
    }

    const e = evento || {};
    if (!e.id || !e.fecha || !e.tipo || !e.rodeo) return res.status(400).json({ error: "Faltan datos: fecha, tipo y rodeo." });
    const idx = actuales.findIndex(f => f[0] === e.id);
    const fila = idx >= 0 ? idx + 2 : actuales.length + 2;
    const valores = CAMPOS_EVENTO.map(k => k === "registrado" ? new Date().toISOString() : String(e[k] ?? "").slice(0, 20000));
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILLA_LABORES, range: `${HOJA_EVENTOS}!A${fila}:${ULTIMA_COL}${fila}`,
      valueInputOption: "RAW", requestBody: { values: [valores] },
    });
    return res.status(200).json({ ok: true, fila });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error con la planilla de ganadería." });
  }
}
