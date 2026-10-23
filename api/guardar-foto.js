// api/guardar-foto.js
// Vercel Serverless Function — sube una foto (de un monitoreo) al Drive, en la subcarpeta
// "Fotos monitoreo" de la carpeta de las órdenes. Usa el mismo Apps Script que guarda los PDF
// (ver apps-script/guardar-pdf.gs: tiene que ser la versión que acepta imágenes).
//
// POST { nombre, base64 }  → { ok:true, link, fileId }
//
// Envs: APPS_SCRIPT_PDF_URL, APPS_SCRIPT_PDF_TOKEN y (opcional) DRIVE_ORDENES_FOLDER, las mismas del PDF.
import { claveOk } from "./_clave.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-clave");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!claveOk(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = process.env.APPS_SCRIPT_PDF_URL;
  const token = process.env.APPS_SCRIPT_PDF_TOKEN;
  if (!url || !token) return res.status(500).json({ error: "Falta configurar APPS_SCRIPT_PDF_URL y APPS_SCRIPT_PDF_TOKEN." });

  try {
    const { nombre, base64 } = req.body || {};
    if (!base64) return res.status(400).json({ error: "Falta la foto." });
    const limpio = String(base64).replace(/^data:image\/\w+;base64,/, "");
    if (limpio.length * 0.75 > 4 * 1024 * 1024) return res.status(413).json({ error: "La foto pesa más de 4 MB." });

    // Primero se pregunta la versión: el script viejo (sólo PDF) guardaba la foto como un PDF roto
    // en la carpeta de las órdenes. A ese no se le manda nada.
    const v = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, accion: "version" }) })
      .then(x => x.json()).catch(() => ({}));
    if (!(Number(v.version) >= 3)) {
      return res.status(500).json({ error: "Hay que actualizar el Apps Script (apps-script/guardar-pdf.gs, Nueva versión) para guardar fotos. El monitoreo se guarda igual, sin la foto." });
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nombre: String(nombre || `foto-${Date.now()}.jpg`), base64: limpio, mime: "image/jpeg",
        carpeta: process.env.DRIVE_ORDENES_FOLDER || "", subcarpeta: "Fotos monitoreo" }),
    });
    const texto = await r.text();
    let data;
    try { data = JSON.parse(texto); }
    catch { throw new Error(`El Apps Script no respondió bien (HTTP ${r.status}).`); }
    if (!data.ok) throw new Error(data.error || "El Apps Script no pudo guardar la foto.");
    // El script viejo (sólo PDF) no devuelve "mime": guarda la foto como PDF y no sirve
    if (data.mime !== "image/jpeg") throw new Error("Hay que actualizar el Apps Script para que acepte fotos (ver apps-script/guardar-pdf.gs).");
    return res.status(200).json({ ok: true, fileId: data.fileId, link: data.link });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error subiendo la foto." });
  }
}
