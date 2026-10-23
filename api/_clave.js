// api/_clave.js — no es una función: la usan las demás (Vercel ignora los archivos que empiezan con "_").
// Clave compartida de la app: si la env APP_CLAVE está cargada en Vercel, cada llamada tiene que traerla
// en el header "x-clave" (la app la manda sola una vez que se ingresó). Si APP_CLAVE no está cargada,
// las funciones quedan abiertas como antes.
export function claveOk(req, res) {
  const clave = process.env.APP_CLAVE;
  if (!clave || req.method === "OPTIONS") return true;
  if (req.headers["x-clave"] === clave) return true;
  res.status(401).json({ error: "Clave de la app incorrecta.", clave: true });
  return false;
}
