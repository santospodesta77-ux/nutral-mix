// api/_clave.js — no es una función: la usan las demás (Vercel ignora los archivos que empiezan con "_").
// Permiso para las partes de la app que no son rodeos ni lluvias (labores, órdenes, monitoreo, precios…):
//   - administrador (APP_CLAVE, o sin APP_CLAVE cargada: la app queda abierta como antes): todo;
//   - solo lectura (hoja "usuarios", tipo "lectura"): puede ver (GET) pero no guardar;
//   - encargado de campo: no entra acá (solo rodeos y lluvias de sus campos, ver ganaderia.js y lluvias.js).
import { acceso } from "./_acceso.js";

export async function claveOk(req, res) {
  const quien = await acceso(req, res);
  if (!quien) return false;
  if (quien.rol === "admin") return true;
  if (quien.rol === "lectura" && req.method === "GET") return true;
  res.status(403).json({ error: quien.rol === "lectura" ? "Acceso de solo lectura: no se puede guardar." : "Tu acceso no incluye esta parte de la app." });
  return false;
}
