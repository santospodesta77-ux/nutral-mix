// api/guardar-pdf.js
// Vercel Serverless Function — recibe el PDF de una orden (base64) y lo archiva en
// Google Drive, para que quede guardado y lo vean Santos y Andrés.
//
// POST { nombre, base64, id }  → { ok:true, link, fileId }
//
// No sube directo con la cuenta de servicio: esas cuentas no tienen espacio en Drive y
// Google rechaza el archivo. Se lo pasa a un Apps Script que corre con la cuenta de
// Santos (ver apps-script/guardar-pdf.gs) y que lo guarda en su carpeta.
//
// Envs:
//   APPS_SCRIPT_PDF_URL     URL /exec de la aplicación web del Apps Script
//   APPS_SCRIPT_PDF_TOKEN   la misma clave que CLAVE en el Apps Script
//   DRIVE_ORDENES_FOLDER    (opcional) id de la carpeta de Drive donde se guardan los PDF

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = process.env.APPS_SCRIPT_PDF_URL;
  const token = process.env.APPS_SCRIPT_PDF_TOKEN;
  if (!url || !token) {
    return res.status(500).json({ error: "Falta configurar APPS_SCRIPT_PDF_URL y APPS_SCRIPT_PDF_TOKEN." });
  }

  try {
    const { nombre, base64 } = req.body || {};
    if (!base64) return res.status(400).json({ error: "Falta el PDF." });

    const limpio = base64.replace(/^data:application\/pdf;base64,/, "");
    if (limpio.length * 0.75 > 8 * 1024 * 1024) return res.status(413).json({ error: "El PDF pesa más de 8 MB." });

    // Apps Script responde con una redirección a googleusercontent.com; fetch la sigue sola.
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nombre, base64: limpio, carpeta: process.env.DRIVE_ORDENES_FOLDER || "" }),
    });
    const texto = await r.text();
    let data;
    try { data = JSON.parse(texto); }
    catch {
      // Se muestra qué contestó Google, para saber si es un login, una página de error u otra cosa
      const resumen = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      let destino = "";
      try { destino = new URL(r.url).host; } catch {}
      throw new Error(`El Apps Script no respondió bien (HTTP ${r.status}${destino ? ` desde ${destino}` : ""}). Respuesta: "${resumen}"`);
    }
    if (!data.ok) throw new Error(data.error || "El Apps Script no pudo guardar el PDF.");

    return res.status(200).json({ ok: true, fileId: data.fileId, link: data.link });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error subiendo el PDF." });
  }
}
