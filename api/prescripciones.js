// api/prescripciones.js
// Vercel Serverless Function — prescripciones por lote, leídas del Drive.
//
// En el Drive están así:  AMBIENTACIONES / <campo> / Lote_XX / prescripcion / (informe PDF, mapas PNG, ZIP para el monitor)
// La cuenta de servicio (GOOGLE_CREDENTIALS) tiene que tener la carpeta AMBIENTACIONES compartida como lector.
//
// GET              → { prescripciones: [{ campo, lote, carpeta, archivos:[{id, nombre, tipo, tam, modificado}] }] }
// GET ?id=<archivo> → el archivo (sólo si está en una de esas carpetas "prescripcion")
//
// Lo pueden ver el administrador y los accesos de solo lectura (ver _clave.js).

import { google } from "googleapis";
import { claveOk } from "./_clave.js";

const CARPETA_AMBIENTACIONES = process.env.DRIVE_AMBIENTACIONES_FOLDER || "1VYWCQQsV1SUxMzC0ODsiTMuJvapkJbR5";
const CARPETA = "application/vnd.google-apps.folder";
const CACHE_MS = 5 * 60 * 1000;
let cache = null; // { t, lista }

function getDrive() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/drive.readonly",
  ]);
  return google.drive({ version: "v3", auth });
}

async function listarTodo(drive, q, fields) {
  const out = [];
  let pageToken;
  do {
    const r = await drive.files.list({ q, fields: `nextPageToken, files(${fields})`, pageSize: 1000, pageToken,
      supportsAllDrives: true, includeItemsFromAllDrives: true });
    out.push(...(r.data.files || []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out;
}

// "Lote_01" → "1" · "Lote_13CH" → "13CH"
const loteDeCarpeta = n => String(n || "").replace(/^lote[\s_-]*/i, "").replace(/^0+(?=\w)/, "").trim().toUpperCase();

async function prescripciones(drive) {
  if (cache && Date.now() - cache.t < CACHE_MS) return cache.lista;
  // Campos (carpetas dentro de AMBIENTACIONES) y sus lotes
  const campos = await listarTodo(drive, `'${CARPETA_AMBIENTACIONES}' in parents and mimeType='${CARPETA}' and trashed=false`, "id, name");
  const lista = [];
  for (const campo of campos) {
    const lotes = await listarTodo(drive, `'${campo.id}' in parents and mimeType='${CARPETA}' and trashed=false`, "id, name");
    const porId = new Map(lotes.map(l => [l.id, l]));
    if (!lotes.length) continue;
    // Las carpetas "prescripcion" de todos los lotes del campo, en una sola consulta
    const qPadres = lotes.map(l => `'${l.id}' in parents`).join(" or ");
    const presc = await listarTodo(drive, `(${qPadres}) and mimeType='${CARPETA}' and name contains 'prescrip' and trashed=false`, "id, name, parents");
    for (const p of presc) {
      const lote = porId.get((p.parents || [])[0]);
      if (!lote) continue;
      const archivos = await listarTodo(drive, `'${p.id}' in parents and mimeType!='${CARPETA}' and trashed=false`, "id, name, mimeType, size, modifiedTime");
      if (!archivos.length) continue;
      lista.push({
        campo: campo.name, lote: loteDeCarpeta(lote.name), carpeta: p.id,
        archivos: archivos.map(a => ({ id: a.id, nombre: a.name, tipo: a.mimeType, tam: Number(a.size) || 0, modificado: a.modifiedTime }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      });
    }
  }
  cache = { t: Date.now(), lista };
  return lista;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-clave");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await claveOk(req, res))) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const drive = getDrive();
    const lista = await prescripciones(drive);
    const id = String(req.query?.id || "");
    if (!id) return res.status(200).json({ prescripciones: lista });

    // Sólo se entregan archivos que están en una carpeta de prescripción
    const archivo = lista.flatMap(p => p.archivos).find(a => a.id === id);
    if (!archivo) return res.status(404).json({ error: "Ese archivo no es de una prescripción." });
    const r = await drive.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
    const verEnPantalla = /^image\/|pdf$/.test(archivo.tipo);
    res.setHeader("Content-Type", archivo.tipo || "application/octet-stream");
    res.setHeader("Content-Disposition", `${verEnPantalla ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(Buffer.from(r.data));
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || e);
    const ayuda = /has not been used|is disabled/i.test(msg) ? " (hay que habilitar la Google Drive API en el proyecto de la cuenta de servicio)"
      : /not found|insufficient|permission/i.test(msg) ? " (¿la carpeta AMBIENTACIONES está compartida con la cuenta de servicio?)" : "";
    return res.status(500).json({ error: `No se pudieron leer las prescripciones: ${msg}${ayuda}` });
  }
}
