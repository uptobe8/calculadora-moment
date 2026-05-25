Moment Energía App Completa con BBDD interna.

Almacenamiento:
- Usa IndexedDB como base de datos interna del navegador.
- En GitHub Pages los datos quedan asociados al dominio publicado.
- No necesita servidor ni backend.
- Incluye exportación CSV, exportación JSON de la BBDD e importación JSON para copias de seguridad.

Archivos principales:
- index.html
- servicios.html
- packs.html
- calculadora.html
- reserva.html
- panel.html
- faq.html
- assets/css/app.css
- assets/js/app.js
- assets/data/app-data.json

Nota: IndexedDB es local al navegador/dispositivo. Para datos compartidos entre varios dispositivos haría falta backend, Google Sheets, Supabase o Firebase.
