// api/yo.js
// Vercel Serverless Function — dice con qué acceso entra la app: administrador o encargado de campo
// (y en ese caso su nombre y sus campos). La app lo usa para mostrar la versión completa o la reducida.
// Al administrador le pasa también la lista de accesos (sin las claves), para el "Ver como…".
import { acceso, leerUsuarios } from "./_acceso.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-clave");
  if (req.method === "OPTIONS") return res.status(200).end();
  const quien = await acceso(req, res);
  if (!quien) return;
  if (quien.rol !== "admin") return res.status(200).json(quien);
  const usuarios = (await leerUsuarios()).filter(u => u.activo).map(u => ({ nombre: u.nombre, campos: u.campos, rol: u.rol }));
  return res.status(200).json({ ...quien, usuarios });
}
