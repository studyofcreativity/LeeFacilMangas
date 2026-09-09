SUBE A GITHUB SOLAMENTE LOS ARCHIVOS DE ESTA CARPETA.

No subas private.html ni ADMIN-PRIVADO.

ANTES:
1. Ejecuta supabase_setup.sql desde la carpeta ADMIN-PRIVADO en Supabase SQL Editor.
2. En Storage crea un bucket llamado: mangas
3. Márcalo como PUBLIC.
4. Sube index.html, app.js, style.css y config.js a tu repositorio GitHub Pages.

NOTA: config.js contiene la URL y clave pública anon de Supabase. Eso es normal para aplicaciones frontend, pero la seguridad real debe estar protegida mediante RLS/Auth.
