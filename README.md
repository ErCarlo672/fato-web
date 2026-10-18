# FATO · Nueva web (estática)

Web de la Federación Andaluza de Tiro Olímpico. HTML + CSS + JavaScript, sin dependencias ni paso de compilación para publicarla.

## Publicar
Sube **todo el contenido de esta carpeta** (incluido `.htaccess`) a la raíz del hosting (Hostinger, cPanel, Netlify…).
Las carpetas `_src/` y `tools/` no son necesarias en el servidor (el `.htaccess` las bloquea igualmente).

## Páginas
| Archivo | Contenido |
|---|---|
| `index.html` | Portada: próximas competiciones en vivo, especialidades, cifras, seguro, noticias |
| `calendario.html` | Calendario 2026 con buscador, filtros, vista mensual y exportación `.ics` / Google Calendar |
| `clubes.html` | Directorio de 72 clubes con búsqueda y filtros por provincia |
| `especialidades.html` | Las 6 especialidades, con nº de pruebas y enlaces a normativa |
| `federacion.html` | Delegaciones, comités de jueces y técnicos, Escuela, Transparencia |
| `seguro.html` | Protocolo de accidente paso a paso y teléfono 24 h |
| `noticias.html` | Noticias y rankings, filtrables |
| `contacto.html` | Formulario validado (abre el correo con copia a la delegación), horario «abierto ahora», mapa |
| `creditos.html` | Licencias de las fotografías |

## Delegaciones
- `delegaciones.html`: tablero con las 8 delegaciones (clubes, próximas competiciones, siguiente prueba) y gráfico de actividad.
- `delegacion-<provincia>.html`: agenda provincial (tiradas de club, pruebas oficiales, entrenamientos controlados y cursos) con buscador, filtros, resultados en PDF, detalles de inscripción, exportación a calendario, cuenta atrás para la próxima prueba, instalaciones, clubes, delegados de jueces y técnicos, y contacto.
- **Datos en directo**: cada página consulta la API de eventos de fato.es (`/wp-json/tribe/events/v1/events`) y muestra «En directo · fato.es». Si no responde, usa la copia local de `assets/data/deleg-<provincia>.js` y lo indica con la fecha de esa copia.
- **Actualizar la copia local**: `python tools/build_delegaciones.py` (descarga todo y regenera los archivos).
- Si el WordPress actual se retira, cambia `API` a `''` al inicio de `assets/js/delegacion.js` y mantén la copia local actualizada (o apunta `API` a donde se migre el calendario).
- Datos de contacto y delegados de cada provincia: `_src/delegaciones.json`; plantilla: `_src/templates/delegacion.html`. Después, `python tools/build.py`.

## Editar
- **Textos de una página**: edita `_src/pages/<página>.html` y ejecuta `python tools/build.py` (regenera los HTML de la raíz con cabecera y pie comunes, y actualiza el `?v=` anti-caché).
- **Cabecera / pie / iconos**: `_src/partials/`.
- **Calendario y clubes**: datos en `tools/cal.json` y `tools/clubs_raw.json`; regenera con `python tools/build_data.py assets/js/data.js`.
- **Estilos**: `assets/css/styles.css` (colores en `:root`).

## Pendiente por parte de la FATO
- Los PDFs del seguro (protocolo, resumen, cuadro médico y póliza) dan error 404 en el servidor actual; por eso la web ofrece solicitarlos por email. Cuando se vuelvan a subir, basta con cambiar esos enlaces en `_src/pages/seguro.html` e `index.html`.
- El formulario usa `mailto:`; si se quiere envío directo sin abrir el correo, conectar a un servicio de formularios o a un script PHP del hosting.
- Sustituir las fotos de stock (Wikimedia Commons, con licencia CC) por fotografías propias de la federación cuando estén disponibles.
