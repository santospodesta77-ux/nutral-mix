// apps-script/guardar-pdf.gs
// Google Apps Script que guarda en Drive los PDF de las órdenes.
//
// Por qué existe: la cuenta de servicio de Vercel no tiene espacio propio en Drive
// ("Service Accounts do not have storage quota"), así que no puede subir archivos
// a una carpeta de un Gmail común. Este script corre con la cuenta de Santos y guarda
// el PDF usando su espacio. api/guardar-pdf.js le reenvía el PDF.
//
// Cómo instalarlo (una sola vez):
//   1. Entrar a https://script.google.com con la cuenta dueña de la carpeta → "Nuevo proyecto".
//   2. Borrar lo que haya y pegar este archivo entero.
//   3. Cambiar CLAVE por la misma clave que se carga en Vercel como APPS_SCRIPT_PDF_TOKEN.
//   4. Implementar → Nueva implementación → tipo "Aplicación web".
//      Ejecutar como: "Yo".  Quién tiene acceso: "Cualquier usuario".
//   5. Autorizar los permisos que pide y copiar la URL que termina en /exec.
//      Esa URL va en Vercel como APPS_SCRIPT_PDF_URL.
//
// POST { token, nombre, base64, carpeta?, mime?, subcarpeta? } → { ok:true, link, fileId, mime }  |  { ok:false, error }
// mime: "application/pdf" (órdenes, por defecto) o "image/jpeg" (fotos de monitoreo, van a la subcarpeta).
// Al actualizar este script: pegar el código nuevo, dejar la CLAVE que ya tenías, y en
// Implementar → Gestionar implementaciones → lápiz → Versión: "Nueva versión" → Implementar.

const CLAVE = "CAMBIAR_POR_LA_CLAVE";
const CARPETA_POR_DEFECTO = "Ordenes S-MIX"; // se usa si no llega el id de carpeta

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    if (datos.token !== CLAVE) return responder({ ok: false, error: "Clave incorrecta." });
    if (!datos.base64) return responder({ ok: false, error: "Falta el archivo." });

    const mime = datos.mime === "image/jpeg" ? "image/jpeg" : "application/pdf";
    let nombre = String(datos.nombre || "archivo-" + Date.now()).replace(/[\\/]/g, "-");
    if (mime === "application/pdf" && !/\.pdf$/i.test(nombre)) nombre += ".pdf";

    const blob = Utilities.newBlob(Utilities.base64Decode(datos.base64), mime, nombre);
    let carpeta = buscarCarpeta(datos.carpeta);
    if (datos.subcarpeta) carpeta = subCarpeta(carpeta, String(datos.subcarpeta));
    const archivo = carpeta.createFile(blob);

    return responder({ ok: true, fileId: archivo.getId(), link: archivo.getUrl(), mime: mime });
  } catch (err) {
    return responder({ ok: false, error: String(err && err.message || err) });
  }
}

// Usa la carpeta pedida; si no llega, busca (o crea) una con nombre fijo en Mi unidad.
function buscarCarpeta(id) {
  if (id) return DriveApp.getFolderById(id);
  const existentes = DriveApp.getFoldersByName(CARPETA_POR_DEFECTO);
  return existentes.hasNext() ? existentes.next() : DriveApp.createFolder(CARPETA_POR_DEFECTO);
}

// Busca (o crea) una subcarpeta adentro de la carpeta dada
function subCarpeta(padre, nombre) {
  const existentes = padre.getFoldersByName(nombre);
  return existentes.hasNext() ? existentes.next() : padre.createFolder(nombre);
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
