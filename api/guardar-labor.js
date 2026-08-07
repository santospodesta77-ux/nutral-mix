// api/guardar-labor.js
// Vercel Serverless Function — recibe una orden de labor desde la app
// y la escribe en la hoja "registro" de la planilla LABORES S-MIX 26-27.
//
// La hoja "registro" es una tabla plana. Columnas (empezando en A):
// A fecha | B productor | C campo | D lote | E campo lote | F productos |
// G dosis | H ha | I total | J precio | K $us totales | L cultivo
//
// ESTRATEGIA ROBUSTA: en vez de usar append (que puede caer descolocado si
// hay datos dispersos en la hoja), leemos la columna A para encontrar la
// última fila real de la tabla y escribimos con update en posición explícita.

import { google } from "googleapis";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA = "registro";

const PRECIO_LABOR = {
  "PULVERIZADA TERRESTRE": 6.3,
  "PULVERIZADA AEREA": 6.3,
  "INCORPORADA": 31,
  "VOLEADA": 10,
  "PARATIL": 65,
  "RASTRA": 45,
  "ROLOS": 31.25,
  "SIEMBRA": 48,
  "Mz PP": 60, "Sj PP": 60, "Gr PP": 58, "Sj 2da": 55,
  "Mz Fert": 55, "Gr Fert": 55, "Sj FERT": 60, "Fina fert": 57,
};

const fmtNum = (n, dec = 2) =>
  (n == null || isNaN(n)) ? "" : Number(n).toFixed(dec).replace(".", ",");

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const orden = req.body;
    if (!orden || !orden.fecha || !orden.productor || !Array.isArray(orden.tratamientos)) {
      return res.status(400).json({ error: "Faltan datos: fecha, productor o tratamientos." });
    }

    const [y, m, d] = orden.fecha.split("-");
    const fechaAR = `${d}/${m}/${y}`;
    const tipo = orden.tipoLabor || "PULVERIZADA TERRESTRE";
    const precioLabor = PRECIO_LABOR[tipo] ?? 6.3;

    const filas = [];
    for (const trat of orden.tratamientos) {
      const cultivo = trat.cultivo || "";
      const productos = (trat.productos || []).filter(p => p.n && p.d > 0);
      if (productos.length === 0) continue;

      for (const lote of (trat.lotes || [])) {
        const campo = lote.campo;
        const loteId = lote.lote;
        const ha = Number(lote.ha) || 0;
        const campoLote = `${campo} ${loteId}`;

        filas.push([
          fechaAR, orden.productor, campo, loteId, campoLote,
          tipo, "", fmtNum(ha, 1), "", fmtNum(precioLabor, 2),
          fmtNum(ha * precioLabor, 1), cultivo,
        ]);
        for (const p of productos) {
          const total = p.d * ha;
          const costo = total * (p.p || 0);
          filas.push([
            fechaAR, orden.productor, campo, loteId, campoLote,
            p.n, fmtNum(p.d, 3), fmtNum(ha, 1), fmtNum(total, 2),
            fmtNum(p.p, 2), fmtNum(costo, 1), cultivo,
          ]);
        }
      }
    }

    if (filas.length === 0) {
      return res.status(400).json({ error: "No hay tratamientos con productos y lotes para guardar." });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1) Leer SOLO la columna A para saber la última fila real de la tabla
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANILLA_LABORES,
      range: `${HOJA}!A:A`,
    });
    const valoresA = colA.data.values || [];
    let ultimaFila = 0;
    for (let i = valoresA.length - 1; i >= 0; i--) {
      const celda = (valoresA[i] && valoresA[i][0] != null) ? String(valoresA[i][0]).trim() : "";
      if (celda !== "") { ultimaFila = i + 1; break; }
    }
    const filaInicio = ultimaFila + 1;
    const filaFin = filaInicio + filas.length - 1;
    const rango = `${HOJA}!A${filaInicio}:L${filaFin}`;

    // 2) Escribir con update en posición explícita
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILLA_LABORES,
      range: rango,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: filas },
    });

    return res.status(200).json({
      ok: true,
      filasEscritas: filas.length,
      filaInicio,
      mensaje: `Se guardaron ${filas.length} filas en la planilla (desde la fila ${filaInicio}).`,
    });
  } catch (err) {
    console.error("Error guardando labor:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
