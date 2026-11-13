// api/_acceso.js — no es una función: la usan las demás (Vercel ignora los archivos que empiezan con "_").
// Quién llama a la API:
//   - el administrador: trae la clave APP_CLAVE (o APP_CLAVE no está cargada y la app queda abierta como antes);
//   - un encargado de campo: trae su clave propia, de la hoja "usuarios" de la planilla
//     (clave | nombre | campos separados por coma | activo). Solo ve y carga rodeos y lluvias de sus campos.
// Devuelve {rol:"admin"} | {rol:"encargado", nombre, campos} | null (ya respondió 401).
import { google } from "googleapis";

const PLANILLA_LABORES = "1JpAA6bCl_uhizVO4jOVBEs34RRlNuAVHKr8kSFRm5ro";
let cache = { t: 0, usuarios: [] };

async function leerUsuarios() {
  if (Date.now() - cache.t < 60000) return cache.usuarios;   // se relee cada minuto: sacar a alguien tarda eso
  try {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, ["https://www.googleapis.com/auth/spreadsheets"]);
    await auth.authorize();
    const r = await google.sheets({ version: "v4", auth }).spreadsheets.values.get({ spreadsheetId: PLANILLA_LABORES, range: "usuarios!A2:D200" });
    const usuarios = (r.data.values || []).filter(f => String(f[0] || "").trim()).map(f => ({
      clave: String(f[0]).trim(), nombre: String(f[1] || "").trim(),
      campos: String(f[2] || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean),
      activo: !/^(no|n|0|false)$/i.test(String(f[3] || "").trim()),
    }));
    cache = { t: Date.now(), usuarios };
  } catch { cache = { t: Date.now(), usuarios: [] }; }   // sin hoja: no hay encargados
  return cache.usuarios;
}

export async function acceso(req, res) {
  if (req.method === "OPTIONS") return { rol: "admin" };
  const clave = String(req.headers["x-clave"] || "").trim();
  const admin = process.env.APP_CLAVE;
  if (admin && clave === admin) return { rol: "admin" };
  if (clave) {
    const u = (await leerUsuarios()).find(x => x.activo && x.clave === clave);
    if (u) return { rol: "encargado", nombre: u.nombre, campos: u.campos };
  }
  if (!admin) return { rol: "admin" };
  res.status(401).json({ error: "Clave de la app incorrecta.", clave: true });
  return null;
}
