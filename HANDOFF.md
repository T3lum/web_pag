# Handoff · Web de Corpotex

Fecha: 2026-10-11. Carpeta: `C:\Claude\servicios\corpotex`. El detalle de la última sesión está en `INFORME-IMPLEMENTACION.md`.

## 1. Estructura

- `index.html` carga `css/site.css`, `js/config.js`, `js/intranet.js`, `js/store.js`, `js/designer.js` y `js/app.js`, todos con `?v=20261011`. **Cambia ese número en cada publicación.**
- Sistema interno (Railway, `config.js → intranetUrl`): `GET /api/productos`, `POST /api/estimar`, `POST /api/cotizaciones` y `POST /api/cotizaciones/{codigo}/diseno`. El contrato oficial está en `PARA-EQUIPO-WEB.md`, y lo que todavía falta pedirle al sistema interno, en `PARA-SISTEMA-INTERNO.md`.
- Las fotos están en `assets/catalogo/` y salen del Catálogo Empresarial 2026, sin marca de agua. Las fotos con marca de agua están en `_original/fotos-con-marca-de-agua/`. No se deben volver a usar.

## 2. Reglas que deben mantenerse

- La marca es «Corpotex», sin textos de prototipo.
- El editor 3D está integrado y tiene 4 pasos. El polo lleva 2 botones. El logo solo puede ser PNG, validado por extensión, por tipo y por la firma real del archivo.
- Las fotos de producto se muestran completas (`object-fit: contain`). Las de ambiente (marcas, servicios y clientes) pueden recortarse (`cover`).
- **WhatsApp (cambió el 2026-10-11):** después del registro se abre `https://wa.me/51983453702?text=` con el **reporte estructurado** de la solicitud (`orderReport()` en `app.js`). Ya no se usa el mensaje fijo «Conversando con Corpotex». WhatsApp se abre solo después de que el sistema interno confirme el registro, sin duplicar solicitudes. Nunca se dice que el mensaje «se envió»: el cliente tiene que pulsar «Enviar» en WhatsApp. Las modificaciones también se mandan con su detalle (`modReport()`).
- En Inicio no hay ningún botón de consulta por WhatsApp.
- No hay uniformes escolares: no existen en `/api/productos` ni tienen foto. La web solo muestra los productos que tienen foto en `config.js → catalogo`.
- «Cotizar mi prenda» siempre empieza desde cero. El botón Atrás del navegador funciona en todo el flujo.
- No se renombran las claves `corpoFlow_Hackaton_v2` (localStorage) ni `corpoflow_draft_v3` (sessionStorage).
- Cabecera: `.hdr-in` usa `--hdr-h` y `--hdr` lo mide `app.js`. No hay que mezclarlas, porque se crea un bucle.
- El salto a las secciones de Inicio usa `scrollToSection()`, que corrige la posición al terminar. No vuelvas a `scrollIntoView` ni pongas `transform` en la animación `.view`.

## 3. Pruebas

- Servidor: `python -m http.server 8780 --directory corpotex`. En esta máquina, el puerto 8780 suele estar ocupado por un `http.server` que sirve `C:\Claude\servicios`. En ese caso, la web está en `http://localhost:8780/corpotex/`.
- **No registres pedidos contra producción sin simular el POST.** El código para simularlo está al final de `INFORME-IMPLEMENTACION.md`.
- En el navegador integrado, `requestAnimationFrame` y el desplazamiento suave no avanzan mientras no se pinta la página. Para medir usa `scrollTo({ behavior: 'instant' })`. Para recargar los JS y CSS sin caché, ejecuta `fetch('js/app.js?v=20261011', { cache: 'reload' })` antes de `location.reload()`.

## 4. Pendientes

1. Que el sistema interno publique el estado y la etapa de cada cotización. Entonces hay que poner `estadoEnLinea: true` en `config.js`. También falta que valide `fecha_deseada` en el servidor, que reciba modificaciones y revisiones, que tenga una pantalla para el diseñador y que acepte una clave contra duplicados (`PARA-SISTEMA-INTERNO.md`).
2. Corpotex debe validar los porcentajes de las categorías 2 y 3 (10 % y 25 %), definir los feriados y decidir la foto del polo sublimado (hoy se muestra el polo deportivo del catálogo).
3. El «nuevo modelo gráfico» no llegó: el `index.html#inicio.html` adjunto era el código actual. Hay que integrarlo cuando lo envíen.
4. La licencia Standard del modelo 3D de Sketchfab no está comprada.
