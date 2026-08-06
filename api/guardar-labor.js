// api/guardar-labor.js
// Vercel Serverless Function — recibe una orden de labor desde la app
// y la escribe en la hoja "registros" de la planilla LABORES S-MIX 26-27.
//
// Escribe UNA fila por labor + UNA fila por cada producto de cada lote,
// replicando el formato de la tabla plana existente:
// fecha | productor | campo | lote | campo lote | productos-labores | dosis | ha | total | precio | $us totales | cultivo
//
// La columna A de la hoja está vacía: los datos arrancan en la columna B.

import { google } from "googleapis";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
const HOJA = "registros";

// Precio por ha de cada tipo de labor (de la planilla insumos)
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

// Formatea número al estilo de la planilla (coma decimal)
const fmtNum = (n, dec = 2) =>
  (n == null || isNaN(n)) ? "" : Number(n).toFixed(dec).replace(".", ",");

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

export default async function handler(req, res) {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const orden = req.body;
    // Validación mínima
    if (!orden || !orden.fecha || !orden.productor || !Array.isArray(orden.tratamientos)) {
      return res.status(400).json({ error: "Faltan datos: fecha, productor o tratamientos." });
    }

    // Fecha a DD/MM/YYYY (la planilla usa ese formato)
    const [y, m, d] = orden.fecha.split("-");
    const fechaAR = `${d}/${m}/${y}`;
    const tipo = orden.tipoLabor || "PULVERIZADA TERRESTRE";
    const precioLabor = PRECIO_LABOR[tipo] ?? 6.3;

    const filas = [];

    // Por cada tratamiento, por cada lote pintado, generamos filas
    for (const trat of orden.tratamientos) {
      const cultivo = trat.cultivo || "";
      const productos = (trat.productos || []).filter(p => p.n && p.d > 0);
      if (productos.length === 0) continue;

      for (const lote of (trat.lotes || [])) {
        const campo = lote.campo;
        const loteId = lote.lote;
        const ha = Number(lote.ha) || 0;
        const campoLote = `${campo} ${loteId}`;

        // Fila 1: la labor (ej PULVERIZADA TERRESTRE)
        // columnas: fecha, productor, campo, lote, campoLote, producto, dosis, ha, total, precio, $us, cultivo
        filas.push([
          "",                       // col A vacía
          fechaAR, orden.productor, campo, loteId, campoLote,
          tipo, "", fmtNum(ha, 1), "", fmtNum(precioLabor, 2),
          fmtNum(ha * precioLabor, 1), cultivo,
        ]);

        // Filas 2..n: cada producto
        for (const p of productos) {
          const total = p.d * ha;
          const costo = total * (p.p || 0);
          filas.push([
            "",
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

    // Append: agrega al final de la tabla en la hoja "registros"
    await sheets.spreadsheets.values.append({
      spreadsheetId: PLANILLA_LABORES,
      range: `${HOJA}!A:M`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: filas },
    });

    return res.status(200).json({
      ok: true,
      filasEscritas: filas.length,
      mensaje: `Se guardaron ${filas.length} filas en la planilla.`,
    });
  } catch (err) {
    console.error("Error guardando labor:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
