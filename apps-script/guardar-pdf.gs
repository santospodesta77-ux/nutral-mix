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
//
// Monitoreos en Google Docs (uno por campo, en la subcarpeta "Monitoreos"):
// POST { token, accion:"monitoreo", monitoreo, carpeta? }      → escribe o reescribe (por id) la entrada → { ok, link, doc:true }
// POST { token, accion:"monitoreo_borrar", id, carpeta? }      → la saca del Doc donde esté
// La primera vez que se usa esta versión, Google pide autorizar el permiso de Documentos.
// Al actualizar este script: pegar el código nuevo, dejar la CLAVE que ya tenías, y en
// Implementar → Gestionar implementaciones → lápiz → Versión: "Nueva versión" → Implementar.

const CLAVE = "CAMBIAR_POR_LA_CLAVE";
const CARPETA_POR_DEFECTO = "Ordenes S-MIX"; // se usa si no llega el id de carpeta

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    if (datos.token !== CLAVE) return responder({ ok: false, error: "Clave incorrecta." });
    if (datos.accion === "monitoreo" || datos.accion === "monitoreo_borrar") return responder(monitoreoEnDoc(datos));
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

// ─────────────────────────────────────────────────────────────
// MONITOREOS EN GOOGLE DOCS
// ─────────────────────────────────────────────────────────────
const NIVELES = { ok: "🟢 Sin problemas", atencion: "🟡 Atención", urgente: "🔴 Urgente" };

function monitoreoEnDoc(datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000); // que dos guardados juntos no creen dos Docs del mismo campo
  try {
    const carpeta = subCarpeta(buscarCarpeta(datos.carpeta), "Monitoreos");
    if (datos.accion === "monitoreo_borrar") {
      const docs = carpeta.getFilesByType(MimeType.GOOGLE_DOCS);
      while (docs.hasNext()) {
        const doc = DocumentApp.openById(docs.next().getId());
        if (quitarEntrada(doc.getBody(), String(datos.id)) >= 0) { doc.saveAndClose(); return { ok: true, borrado: true }; }
      }
      return { ok: true, borrado: false };
    }
    const m = datos.monitoreo || {};
    if (!m.id || !m.campo) return { ok: false, error: "Falta el monitoreo." };
    const nombreCampo = String(m.campoNombre || m.campo);
    const doc = docDelCampo(carpeta, nombreCampo);
    const body = doc.getBody();
    let pos = quitarEntrada(body, String(m.id));   // si se editó, va en el mismo lugar
    if (pos < 0) pos = 2;                           // si es nuevo, arriba de todo (debajo del título)
    escribirEntrada(body, pos, m);
    doc.saveAndClose();
    return { ok: true, doc: true, link: doc.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

// Busca (o crea) el Doc "Monitoreos – <campo>" dentro de la carpeta
function docDelCampo(carpeta, nombreCampo) {
  const nombre = "Monitoreos – " + nombreCampo;
  const existentes = carpeta.getFilesByName(nombre);
  if (existentes.hasNext()) return DocumentApp.openById(existentes.next().getId());
  const doc = DocumentApp.create(nombre);
  DriveApp.getFileById(doc.getId()).moveTo(carpeta);
  const body = doc.getBody();
  body.getChild(0).asParagraph().setText(nombre).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph("Se completa solo desde la app Nutral Mix cada vez que se guarda un monitoreo. Los más nuevos van arriba.")
    .setHeading(DocumentApp.ParagraphHeading.NORMAL).editAsText().setItalic(true).setForegroundColor("#777777");
  return doc;
}

// Cada entrada empieza con un título (Encabezado 2) y termina con un renglón "ref <id>".
// Devuelve dónde estaba (índice) o -1 si no estaba.
function quitarEntrada(body, id) {
  const marca = "ref " + id;
  for (let i = body.getNumChildren() - 1; i >= 0; i--) {
    const el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH || el.asParagraph().getText().trim() !== marca) continue;
    let ini = i;
    while (ini > 0) {
      const ant = body.getChild(ini);
      if (ant.getType() === DocumentApp.ElementType.PARAGRAPH && ant.asParagraph().getHeading() === DocumentApp.ParagraphHeading.HEADING2) break;
      ini--;
    }
    if (ini === 0) ini = i; // sin título encontrado: sólo se saca la marca, nunca el encabezado del Doc
    // Docs no deja borrar el último párrafo del documento: se deja uno vacío
    if (i === body.getNumChildren() - 1) body.appendParagraph("");
    for (let k = i; k >= ini; k--) body.removeChild(body.getChild(k));
    return ini;
  }
  return -1;
}

function escribirEntrada(body, pos, m) {
  let i = Math.min(pos, body.getNumChildren());
  const ins = texto => i < body.getNumChildren() ? body.insertParagraph(i++, texto) : (i++, body.appendParagraph(texto));
  const f = String(m.fecha || "").split("-");
  const fecha = f.length === 3 ? f[2] + "/" + f[1] + "/" + f[0] : String(m.fecha || "");
  const titulo = [fecha, "Lote " + (m.loteNombre || m.lote), m.cultivo, NIVELES[m.nivel] || ""].filter(Boolean).join(" · ");
  ins(titulo).setHeading(DocumentApp.ParagraphHeading.HEADING2);

  const linea = (etiqueta, valor) => {
    if (!valor) return;
    const p = ins(etiqueta + ": " + valor).setHeading(DocumentApp.ParagraphHeading.NORMAL);
    p.editAsText().setBold(false).setBold(0, etiqueta.length, true);
  };
  const malezas = m.malezas ? m.malezas + ([m.malezasDensidad, m.malezasTamano].filter(Boolean).length
    ? " (" + [m.malezasDensidad, m.malezasTamano].filter(Boolean).join(", ").toLowerCase() + ")" : "") : "";
  linea("Estadio", m.estado);
  linea("Suelo / humedad", m.suelo);
  linea("Nacimientos", m.nacimiento);
  linea("Malezas", malezas);
  linea("Plagas", m.plagas);
  linea("Enfermedades", m.enfermedades);
  linea("Observaciones", m.observaciones);
  linea("Acción sugerida", m.accion);
  linea("Recorrió", m.autor);

  // Fotos: se meten en el Doc (achicadas) con el link al original
  const links = String(m.fotos || "").split(" ").filter(Boolean);
  if (links.length) {
    const p = ins("").setHeading(DocumentApp.ParagraphHeading.NORMAL);
    links.forEach(link => {
      const id = (link.match(/\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/) || [])[1];
      try {
        const img = p.appendInlineImage(DriveApp.getFileById(id).getBlob());
        const ancho = 220, k = ancho / img.getWidth();
        img.setWidth(ancho).setHeight(Math.round(img.getHeight() * k)).setLinkUrl(link);
        p.appendText("  ");
      } catch (err) {
        p.appendText("📷 " + link + "  ");
      }
    });
  }
  const ref = ins("ref " + m.id).setHeading(DocumentApp.ParagraphHeading.NORMAL);
  ref.editAsText().setBold(false).setFontSize(7).setForegroundColor("#BBBBBB");
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
