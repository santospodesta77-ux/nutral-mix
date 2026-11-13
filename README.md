# Nutral Mix — Gestión de Campos

App de gestión integral de campos para Nutral Mix (General Pico, La Pampa).

## Deploy
Automático vía Vercel al hacer push a main.

## Actualizar
Reemplazar `src/App.jsx` con la versión nueva → commit → Vercel actualiza solo. deploy

## Variables de entorno en Vercel
- `GOOGLE_CREDENTIALS`: cuenta de servicio con acceso a la planilla LABORES S-MIX 26-27 (labores, borradores, protocolo, precios, monitoreo, lluvias).
- `APPS_SCRIPT_PDF_URL` y `APPS_SCRIPT_PDF_TOKEN`: Apps Script que guarda en el Drive los PDF de las órdenes, las fotos de monitoreo y un Google Doc editable de monitoreos por campo ("Monitoreos – campo", en la carpeta "Monitoreos S-MIX" de Mi unidad, o en `DRIVE_MONITOREOS_FOLDER` si se carga) (`apps-script/guardar-pdf.gs`).
- `DRIVE_ORDENES_FOLDER` (opcional): carpeta del Drive para los PDF; las fotos van a su subcarpeta "Fotos monitoreo".
- `APP_CLAVE` (opcional): si está cargada, la app pide esa clave una vez por equipo para leer y guardar en la planilla.
- Accesos personales: hoja `usuarios` de la planilla (clave | nombre | campos separados por coma, o TODOS | activo si/no | notas | tipo). Cada uno entra con su link `https://<la app>/?acceso=<su clave>`; `?acceso=salir` olvida la clave guardada en ese equipo. Lo controla `api/_acceso.js`:
  - tipo vacío o `encargado`: ve y carga solo rodeos y lluvias de sus campos;
  - tipo `lectura` (ej. el asesor): ve toda la app pero no puede guardar nada.
  Para que nadie entre al resto de la app sin clave, `APP_CLAVE` tiene que estar cargada.
