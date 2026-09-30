// api/guardar-pdf.js
// Vercel Serverless Function — recibe el PDF de una orden (base64) y lo sube a una
// carpeta de Google Drive, para que quede archivado y lo vean Santos y Andrés.
//
// POST { nombre, base64, id }  → { ok:true, link, fileId }
//
// Envs:
//   GOOGLE_CREDENTIALS      (la misma del resto)
//   DRIVE_ORDENES_FOLDER    id de la carpeta de Drive donde se guardan los PDF
// La carpeta tiene que estar compartida como EDITOR con el mail del service account.

import { google } from "googleapis";
import { Readable } from "stream";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.JWT(creds.client_email, null, creds.private_key, [
    "https://www.googleapis.com/auth/drive.file",
  ]);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const carpeta = process.env.DRIVE_ORDENES_FOLDER;
  if (!carpeta) return res.status(500).json({ error: "Falta configurar DRIVE_ORDENES_FOLDER." });

  try {
    const { nombre, base64 } = req.body || {};
    if (!base64) return res.status(400).json({ error: "Falta el PDF." });

    const buffer = Buffer.from(base64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: "El PDF pesa más de 8 MB." });

    const auth = getAuth();
    await auth.authorize();
    const drive = google.drive({ version: "v3", auth });

    const archivo = await drive.files.create({
      requestBody: {
        name: (nombre || `orden-${Date.now()}`).replace(/[\\/]/g, "-") + (nombre?.endsWith(".pdf") ? "" : ".pdf"),
        parents: [carpeta],
        mimeType: "application/pdf",
      },
      media: { mimeType: "application/pdf", body: Readable.from(buffer) },
      fields: "id, webViewLink",
    });

    return res.status(200).json({ ok: true, fileId: archivo.data.id, link: archivo.data.webViewLink });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Error subiendo el PDF." });
  }
}
