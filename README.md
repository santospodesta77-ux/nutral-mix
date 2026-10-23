# Nutral Mix — Gestión de Campos

App de gestión integral de campos para Nutral Mix (General Pico, La Pampa).

## Deploy
Automático vía Vercel al hacer push a main.

## Actualizar
Reemplazar `src/App.jsx` con la versión nueva → commit → Vercel actualiza solo. deploy

## Variables de entorno en Vercel
- `GOOGLE_CREDENTIALS`: cuenta de servicio con acceso a la planilla LABORES S-MIX 26-27 (labores, borradores, protocolo, precios, monitoreo, lluvias).
- `APPS_SCRIPT_PDF_URL` y `APPS_SCRIPT_PDF_TOKEN`: Apps Script que guarda en el Drive los PDF de las órdenes, las fotos de monitoreo y un Google Doc de monitoreos por campo ("Monitoreos – campo", en la subcarpeta Monitoreos) (`apps-script/guardar-pdf.gs`).
- `DRIVE_ORDENES_FOLDER` (opcional): carpeta del Drive para los PDF; las fotos van a su subcarpeta "Fotos monitoreo".
- `APP_CLAVE` (opcional): si está cargada, la app pide esa clave una vez por equipo para leer y guardar en la planilla.
