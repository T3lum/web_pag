# Corpotex · Informe de implementación

Fecha: 2026-10-11. Carpeta: `C:\Claude\servicios\corpotex`.

Cada punto indica su estado:

- **Hecho y probado**: está implementado y lo probé en el navegador.
- **Hecho, sin probar**: está implementado, pero no lo pude probar aquí.
- **Depende del sistema interno**: la web está lista, pero falta un servicio del sistema interno (ver `PARA-SISTEMA-INTERNO.md`).
- **Lo decide Corpotex**: falta un dato o una aprobación de la empresa.

---

## 1. Diseño responsive

**Hecho y probado.**

- **Menú en celulares y tablets.** Antes, por debajo de 900 px no había forma de ir a Servicios, Nosotros o Contacto. Ahora un botón ☰ en la cabecera abre un panel con todas las opciones. Se cierra al elegir una opción, con Escape o al tocar fuera. Entre 900 y 1099 px también se usa este menú, porque antes los siete enlaces se partían en dos líneas. El menú completo en una sola línea aparece desde 1100 px.
- **Primera pantalla del celular.** En 375 × 667 se ven la cabecera, el héroe y la primera fila de productos destacados. Para lograrlo bajé el título del héroe de 34 a 31 px (27 px en 320), dejé las tres ventajas en una sola fila deslizable y saqué del héroe la frase de WhatsApp.
- **Editor 3D en 320 px.** El botón «Siguiente: Estampado →» desbordaba la pantalla y ahora pasa a dos líneas. En pantallas de poca altura, como 320 × 568, el modelo ocupa el 36 % del alto, así que el modelo y los controles se ven a la vez.
- **Catálogo:** 2 columnas en celular, 3 en tablet, 4 en escritorio y 5 desde 1100 px.
- **Caché:** los CSS y JS se cargan con `?v=20261011`, para que los navegadores tomen la versión nueva. Hay que cambiar ese número en cada publicación.

## 2. Alineación y espacios en blanco

**Hecho y probado.** Encontré y corregí cuatro causas reales de contenido «desfasado»:

1. **Columna vacía en «Mis solicitudes».** El detalle de una solicitud, las modificaciones y su resumen usaban la rejilla del pedido, que en escritorio reserva 340 px para el panel lateral. Como ese panel no existe ahí, el contenido quedaba corrido a la izquierda. Ahora esas vistas usan una sola columna centrada (`.flow.wide`, máximo 920 px).
2. **Salto horizontal al cambiar de vista.** Al pasar de una vista con barra de desplazamiento a otra sin ella, todo se movía unos 8 px. Ahora se reserva siempre el espacio de la barra (`scrollbar-gutter: stable`).
3. **«Inicio» no hacía nada si ya estabas en Inicio.** Ahora vuelve arriba.
4. **Salto a las secciones.** Antes usaba `scrollIntoView` mientras corría la animación de entrada de la vista, que tenía un `translateY`, y no corregía nada si una imagen o la fuente cambiaba el alto de la página. Ahora `scrollToSection()` calcula la posición con el alto real de la cabecera y desplaza solo en vertical. Al terminar, la corrige si la página cambió, salvo que la persona haya movido la página mientras tanto. La animación de las vistas ahora solo cambia la opacidad. Las imágenes declaran `width` y `height`, así que reservan su espacio antes de cargar.

En 375 y en 1920 px, cada sección queda exactamente 10 px por debajo de la cabecera, también cuando se llega desde otra vista. El menú marca la sección que se está viendo.

**Espacios:** reduje el relleno de las secciones (32 → 26 px en celular y 44 → 38 px en escritorio), los márgenes de los títulos, la altura de los recuadros de servicios (190 → 170 px) y el pie de página. En celular, las ventajas de Nosotros pasaron de tres filas a fichas en línea, y los recuadros de marcas y servicios son más bajos.

## 3. Nuevo modelo gráfico

**No se recibió.** El archivo adjunto `index.html#inicio.html` es el código fuente de la página actual, guardado desde «Ver código fuente». Lo comparé línea por línea con `index.html` y es idéntico, así que no trae ningún diseño nuevo que integrar.

Dentro del sistema visual actual se hizo lo siguiente: fotos limpias y de mejor calidad (punto 8), tarjetas de producto donde la foto llena el recuadro, ventajas con ✓ en el héroe y tarjetas de categoría como las de la imagen de referencia. **Pendiente:** cuando envíen el modelo gráfico (HTML, Figma o capturas), se integra sobre esta base.

## 4. Reporte por WhatsApp

**Hecho y probado** (con el registro simulado; ver punto 10).

- Se eliminó el mensaje fijo «Conversando con Corpotex».
- Después del registro, WhatsApp se abre en `https://wa.me/51983453702?text=…` con el reporte codificado con `encodeURIComponent`. Así se ve:

```
*REPORTE DE SOLICITUD — CORPOTEX*
Código de solicitud: COT-…
Fecha de registro: 11/10/2026, 12:35 a. m.

*DATOS DEL CLIENTE*
• Nombre / Empresa u organización / Teléfono / Correo

*DETALLES DEL PEDIDO*
• Tipo de prenda / Personalización / Estilo / Cantidad (con tallas) / Color
• Fecha deseada de entrega / Fecha estimada de entrega (días hábiles, «estimada por la planta»)

*DISEÑO PERSONALIZADO*
• Diseño 3D / Colores / Estampados (con su ubicación) / Revisión del diseñador / Observaciones
• Vista previa: ficha del diseño adjunta a la cotización en el sistema de Corpotex (nombre del archivo)

*ESTADO*
• Solicitud registrada correctamente en el sistema de Corpotex.
• Estado actual: cotización registrada, pendiente de confirmación de ventas (todavía no entra a producción).
```

- Solo aparecen las líneas que tienen dato. Si el cliente no dejó correo, no hay línea «Correo». Todos los valores vienen del pedido registrado y del código que devuelve el sistema interno.
- **Vista previa:** el sistema interno guarda la ficha del diseño, pero no publica un enlace para verla. Por eso el reporte dice dónde está y no incluye un enlace inventado.
- El orden de los pasos no cambió: la pestaña se abre en el clic, primero se registra la cotización y recién entonces se dirige a WhatsApp. Si el registro falla, la pestaña se cierra. Con doble clic se crea **una sola** cotización.
- El texto ya no dice que el mensaje «se envió». Dice: «Abrimos WhatsApp con el reporte… pulsa «Enviar» en WhatsApp», y aclara que la solicitud queda registrada aunque no se envíe.
- En «Mis solicitudes», el botón «Enviar reporte por WhatsApp» arma el mismo reporte con la etapa real cuando el sistema interno la publique.
- Las modificaciones también se envían con su detalle («Enviar detalle por WhatsApp»). Antes había que copiarlo y pegarlo.
- **Envío automático:** un enlace `wa.me` no envía nada por sí solo. Para que el reporte llegue sin que el cliente toque «Enviar» hace falta la API de WhatsApp Business Platform desde un servidor. La web no tiene servidor propio, así que eso le tocaría al sistema interno.

## 5. Modificaciones durante la fabricación

**Hecho.** Ya existía desde la sesión anterior. En esta sesión se revisó, se ajustó y se probó.

- **Cuándo se habilita:** según la etapa real de fabricación y la regla configurable `permitidoAntesDe` de cada categoría (`js/config.js`). Hoy las categorías 1 y 2 se aceptan antes de Bordado/DTF/Sublimado, y la 3 antes de Corte. Si el pedido ya no admite ninguna, el botón «Solicitar modificación» se desactiva y se muestra el motivo, por ejemplo: «Tu pedido ya está en «Acabados»…».
  - *Probado* simulando la etapa: en «Acabados», todo bloqueado; en «Corte», la categoría 3 bloqueada con su motivo y las categorías 1 y 2 disponibles.
  - **Depende del sistema interno:** hoy no publica la etapa (`GET /api/cotizaciones/{codigo}` responde 404). Mientras tanto, la modificación sale como **«consulta de modificación»** y ventas verifica la etapa antes de aprobarla. La web no da por hecho que el pedido admite cambios.
- **Diseño original y versiones:** el editor 3D carga la última versión del pedido (colores, logo, ubicación, escala y desplazamiento) y no un polo genérico. Las modificaciones se guardan como versiones nuevas y la original nunca se sobrescribe. Además hay una comparación «antes y después» y una lista de cambios campo por campo. *Hecho, sin probar en esta sesión:* el código no cambió y ya se había probado en la sesión anterior.
- **Estados:** *consulta*, *solicitada · pendiente de aprobación*, *aprobada*, *aplicada a producción* y *no aprobada*. Ninguna versión nueva pasa a producción sin aprobación.
- **Límite actual:** las modificaciones se guardan en el dispositivo del cliente y llegan a ventas por WhatsApp. **Depende del sistema interno:** que las reciba por API (`PARA-SISTEMA-INTERNO.md`, sección 3).

## 6. Categorías de cambio y porcentajes

**Categorías:** las de la imagen de referencia, con sus nombres y descripciones exactos. Las tarjetas se ven como en la imagen: bolita de color, título centrado y precio arriba a la derecha en escritorio.

| Categoría | En la imagen | En la web |
|---|---|---|
| 1 · Ajuste leve | Desde S/ 0 | Desde S/ 0 (sin cambios) |
| 2 · Cambio moderado | + S/ 40 | **+10 % del valor del pedido** (rango orientativo 5–15 %) |
| 3 · Rediseño mayor | + S/ 120 | **+25 % del valor del pedido** (rango orientativo 20–40 %) |

**Cálculo:** adicional = valor de referencia × porcentaje; total estimado = valor de referencia + adicional. Ejemplo probado con un valor de referencia simulado: S/ 1 000 → +S/ 100 → S/ 1 100. Cada modificación se calcula por separado sobre el valor de referencia y los porcentajes no se suman entre sí (`acumulacion: 'separada'`). Mientras el sistema interno no publique un valor de referencia confiable (`precio_confirmado`), la web muestra **«Importe: pendiente de validación»** y no inventa un total.

**Fuentes externas.** No encontré ninguna referencia pública que fije un porcentaje estándar por cambios en pedidos textiles. Esto es lo que sí encontré:

- Los ajustes menores suelen ser gratis, y un cambio de alcance o un arte nuevo después de aprobar se cobra aparte ([Digit-IT](https://knowledgebase.digit-it.com/index.php/knowledge-base/article/revisions-and-charges-policy); [Arena Prints](https://arenaprints.com/apps/docs/custom-apparel-orders/how-many-sample-revisions-do-i-get): si hay que reemplazar el diseño, el proceso empieza de nuevo y se vuelven a cobrar los costos de preparación).
- Los cambios de bordado se cobran con una tarifa fija: unos US$ 40 por editar el logo ([LogoUp](https://support.logoup.com/hc/en-us/articles/360024813314-Are-there-extra-fees-if-you-have-to-tweak-my-logo-for-embroidery)) y US$ 35 por un archivo de bordado nuevo si se agregan elementos o se cambia el tamaño ([Corporate Casuals](https://support.corporatecasuals.com/hc/en-us/articles/4405446437140)).
- Hay recargos como porcentaje del pedido, pero para devoluciones o cancelaciones y no para cambios: entre 15 y 25 %, y entre 30 y 50 % en prendas bordadas que ya están en producción. Esta es una fuente secundaria ([Zigaflow](https://zigaflow.com/resources/glossary/restocking-fee)). Otro ejemplo: una tarifa fija de US$ 250 por cambio aprobado más un 15 % por cancelación ([Stylex](https://stylex.bynder.com/m/23b6aab6dc5913f3/original/Change-Order-Policy.pdf)).
- Muchos proveedores no aceptan cambios una vez que el pedido entra en producción ([Palmetto Blended](https://palmettoblended.com/pages/terms-and-policies-faq); [Marzare](https://marzare.notion.site/Marzare-Terms-Conditions-9fa34ac150e8480081d3b62ad7d21a7d)), o aceptan cada vez menos a medida que avanza ([Reyrr Athletics](https://intercom.help/reyrr-athletics/es/articles/14152955-podemos-cambiar-o-cancelar-un-pedido-b2b-despues-de-realizarlo)).

**Cómo llegué a cada porcentaje** (son estimaciones propias):

- **Categoría 2 · 10 % (5–15 %).** Se acepta solo antes de bordar o estampar, así que no se pierde ninguna prenda. El costo es de preparación: horas de diseño, nuevo archivo de bordado, nuevas láminas DTF o pantallas, y reprogramación. Esos costos son casi fijos, y por eso el porcentaje está en la parte baja. Como referencia, el +S/ 40 de la imagen equivale al 10 % de un pedido de S/ 400.
- **Categoría 3 · 25 % (20–40 %).** Puede requerir nuevo patronaje, otra muestra, otra tela o insumos ya separados en Almacén, y diseño y preparación completos. Se acepta solo antes de Corte, así que no se pierde tela cortada. Por eso queda en la franja de los recargos por cancelación (15–25 %) y no en la de las prendas que ya están en producción (30–50 %). El +S/ 120 de la imagen equivale al 25 % de un pedido de S/ 480.

**Límites.** Las fuentes son de proveedores de Estados Unidos y Europa, en dólares, y no reflejan los costos internos de Corpotex. Los porcentajes **no son una tarifa oficial**. **Lo decide Corpotex:** conviene validarlos con 3 a 5 cambios reales del pasado y ajustarlos en `js/config.js → modificaciones.categorias[].recargo` (`valor` y `rango`). Una posibilidad, que no está implementada: cobrar el porcentaje con un mínimo igual a los montos fijos de la imagen (S/ 40 y S/ 120), para que los pedidos chicos cubran la preparación.

## 7. Sistema interno y validación de fechas

**Hecho y probado** con el sistema interno real (`/api/productos` y `/api/estimar`).

- **Datos que se usan:** la web no calcula plazos, tal como pide `PARA-EQUIPO-WEB.md`. Usa `fecha_estimada`, `dias_habiles` y `detalle` de `/api/estimar`, que ya incluye la carga real de la planta, los bloques, el margen del 20 % y los días hábiles de lunes a sábado. La estimación se recalcula cuando cambian la prenda, la cantidad o la personalización, al llegar al resumen y justo antes de registrar.
- **Fecha mínima:** el calendario no deja elegir una fecha anterior (`min`), y si aun así se ingresa una, se rechaza con el mensaje pedido, más la fecha disponible. *Probado:* 24 polos cuello redondo con DTF dieron 30/10/2026 (17 días hábiles). El 29/10 se rechaza y el 02/11 se acepta.
- **Calendario:** nuevo. Rechaza los domingos («El domingo no hay entregas: elige un día de lunes a sábado.»), según la jornada y los horarios de la empresa. Los días se configuran en `js/config.js → diasEntrega`. Las fechas se comparan como texto `AAAA-MM-DD`, así que la zona horaria del navegador no influye. **Lo decide Corpotex:** los feriados no se validan porque el sistema interno no publica un calendario de feriados.
- **Validación en dos niveles:** en el navegador, antes de cada paso; y otra vez justo antes de registrar, con una estimación nueva del servidor. Si la planta se cargó mientras tanto y la fecha deseada ya no es viable, no se registra. **Depende del sistema interno:** que `POST /api/cotizaciones` también rechace una `fecha_deseada` inválida. Comprobé con pedidos inválidos (el sistema no guardó nada) que el servidor valida el cliente y las tallas y no rechaza el campo `fecha_deseada`, pero no lo valida (`PARA-SISTEMA-INTERNO.md`, sección 1).
- **Sin conexión:** si `/api/estimar` falla, la web dice «No ha sido posible verificar la disponibilidad» con un botón «Reintentar», y no deja continuar ni registrar con una fecha sin verificar. *Probado* simulando la caída.
- **Datos obligatorios:** se marcan el producto, la cantidad (mínimo del sistema interno), las tallas que deben sumar la cantidad, el nombre, el teléfono, el correo si se escribe y la fecha. Lo mismo valida el servidor. No se pidió ningún campo nuevo.
- **Estimada o comprometida:** siempre dice «entrega estimada… ventas confirma la fecha en firme». Cuando el sistema interno publique `fecha_comprometida`, se podrá mostrar la fecha en firme (`PARA-SISTEMA-INTERNO.md`, sección 2).

## 8. Revisión del diseñador

**Hecho y probado** en la web. **Depende del sistema interno** para la gestión interna.

- El botón «Solicitar revisión del diseñador» está en el paso 2, junto al editor 3D, y también en la cabecera del editor. Se presenta como un servicio para diseños especiales, no como un error.
- El formulario pide motivo, descripción (mínimo 20 caracteres) e imágenes PNG, JPG o WEBP de hasta 10 MB, con un máximo de 3. Las imágenes se validan por su contenido real, no por la extensión. Los datos del paso 1 se reutilizan y no se vuelven a pedir.
- Se genera un identificador `REV-…` que queda unido a la cotización. Viaja en las notas de la cotización, en la ficha PDF (con las imágenes de referencia) y en el reporte de WhatsApp, y aparece en «Mis solicitudes» con su estado.
- **Lo que no existe y no se simuló:** el aviso automático al diseñador, la vista interna con estados y la protección de esa vista. La web es estática, sin usuarios ni servidor, y ocultar una ruta no la protege. Por eso no creé una «vista del diseñador» falsa. La propuesta para el sistema interno, que ya tiene acceso con PIN, está en `PARA-SISTEMA-INTERNO.md`, sección 4. Los estados propuestos están en `js/config.js → revision.estados`.

## 9. Fotos sin marca de agua y uniformes escolares

**Fotos: hecho y probado.** Las 17 fotos que mostraba la web llevaban la marca de agua de la propia Corpotex («C CORPOTEX · Vestimos a todas las industrias»), repetida en diagonal. No borré la marca: recorté las mismas prendas y fotos del **Catálogo Empresarial Corpotex 2026** (el PDF de la empresa, cuyas páginas no tienen marca de agua).

- Las 19 fotos nuevas están en `assets/catalogo/`, en JPG de unos 760 px de alto (1,1 MB en total; las 17 anteriores sumaban 4,1 MB). Las 17 fotos con marca de agua, más otras 3 que no se usaban, se movieron a `_original/fotos-con-marca-de-agua/` sin borrarlas.
- Reemplazos que conviene revisar:
  - **Polo sublimado:** la foto anterior (con marca) no está en el catálogo empresarial. Ahora se muestra el «Polo deportivo» del catálogo (página 10). **Lo decide Corpotex:** si prefieren una foto real de un polo sublimado sin marca de agua, se cambia en `config.js`.
  - **Segunda foto del polo camisero:** el «Polo camisero combinado» (página 11) reemplaza al «Polo personalizado», que tenía la marca impresa sobre la foto.
  - **Clientes:** la foto del chef no está en el catálogo. Se usó la de «Restaurante y hotelería» (página 28).
  - **Servicios:** «Confección» y «Bordado» usan las fotos de la planta (página 3), y «Estampado» usa el polo rib combinado (página 10).

**Uniformes escolares: ya no estaban.** No hay uniformes escolares en `/api/productos` (26 productos), ni en el catálogo de la web, los menús, los filtros, los formularios, el editor o las imágenes. Solo queda la etiqueta «Prenda retirada del catálogo» para mostrar solicitudes antiguas guardadas en el navegador, y se deja así a propósito. Si algún día se agregan al sistema interno, no aparecerán en la web hasta que tengan foto en `config.js`.

**Botón de WhatsApp en Inicio: ya no estaba.** El botón «WhatsApp corporativo ↗» de Contacto se había quitado en una sesión anterior, y lo confirmé: en Inicio no queda ningún enlace a WhatsApp. El botón redondo dorado de abajo a la derecha es el **asistente de ayuda** de la web y no abre WhatsApp. Además se quitó «Te acompañamos por WhatsApp» del héroe.

## 10. Pruebas realizadas

En el navegador integrado, con el sitio servido en `http://localhost:8780/corpotex/`. Para no crear cotizaciones reales, **simulé solo** `POST /api/cotizaciones`, `/diseno` y `window.open`. El catálogo y `/api/estimar` fueron los reales.

| Prueba | Resultado |
|---|---|
| Sin desborde horizontal en 13 vistas (inicio, catálogo, ficha, pedido, diseño con revisión, editor en sus 4 pasos, solicitudes, detalle, modificación y su resumen) en 320×568, 375×667, 390×844, 768×1024, 1366×768 y 1920×1080 | ✅ (se corrigió el pie del editor a 320 px) |
| Salto a secciones desde el menú, en la misma vista y desde otra; «Inicio» vuelve arriba; menú móvil | ✅ |
| Mismo eje en todas las vistas; sin salto por la barra de desplazamiento | ✅ |
| Sin botón de WhatsApp en Inicio | ✅ |
| Registro con doble clic: 1 sola cotización; WhatsApp solo después, con el reporte | ✅ |
| Reporte con datos reales, sin líneas vacías ni inventadas | ✅ |
| La solicitud queda en «Mis solicitudes» aunque no se envíe WhatsApp | ✅ |
| Categorías y porcentajes; cálculo S/ 1 000 → S/ 1 100; «pendiente de validación» sin valor de referencia | ✅ |
| Bloqueo por etapa (simulando Acabados y Corte) | ✅ |
| Modificación guardada como consulta y enviada por WhatsApp con su detalle | ✅ |
| Fecha anterior a la mínima rechazada; domingo rechazado; fecha válida aceptada | ✅ |
| `/api/estimar` caído: aviso, «Reintentar» y bloqueo del avance; al reintentar, OK | ✅ |
| Revisión del diseñador: validación, identificador y envío en la cotización y en el reporte | ✅ |
| Logo: rechaza un `.png` falso y un JPG; acepta un PNG real | ✅ |
| Editor 3D: carga y muestra los 4 pasos, los controles y el pie | ✅ (el visor WebGL de Sketchfab no se pinta en las capturas de este navegador; el modelo ya se había comprobado en la sesión anterior) |
| Consola sin errores | ✅ |
| Recuperación del diseño original en una modificación con editor 3D | No se repitió (código sin cambios) |
| Registro real contra producción | **No se hizo**, a propósito: crearía una cotización real |

Los datos de prueba (incluidos `COT-PRUEBA1` de la sesión anterior) se borraron del navegador integrado.

## 11. Archivos

| Archivo | Cambio |
|---|---|
| `index.html` | Botón de menú, héroe más corto, fotos nuevas con `width`/`height`, texto del paso 4, `page-mid` en «Mis solicitudes» y `?v=` en CSS y JS. |
| `css/site.css` | Menú desplegable, espaciados, héroe, tarjetas de categoría, `scrollbar-gutter`, animación sin desplazamiento, `.flow.wide`, editor en 320 px y catálogo de 5 columnas. |
| `js/app.js` | `orderReport()` y `waLink()` para el reporte; modificaciones por WhatsApp; `scrollToSection()`, `smoothTo()`, `markSections()` y `toggleMenu()`; `dateError()` con días de entrega; bloqueo del botón «Solicitar modificación» por etapa. |
| `js/config.js` | Fotos de `assets/catalogo/`, `diasEntrega` y `revision.estados`; comentarios sobre los porcentajes. |
| `assets/catalogo/*.jpg` | 19 fotos nuevas, recortadas del catálogo oficial. |
| `_original/fotos-con-marca-de-agua/` | Las 20 fotos anteriores con marca de agua (17 en uso y 3 sin usar), movidas aquí. |
| `PARA-EQUIPO-WEB.md` | Ahora es el documento oficial del sistema interno (el que adjuntaste). El resumen anterior pasó a `_original/PARA-EQUIPO-WEB.resumen-anterior.md`. |
| `PARA-SISTEMA-INTERNO.md` | Nuevo: lo que la web necesita del sistema interno. |
| `INFORME-IMPLEMENTACION.md` | Este informe. |

`js/intranet.js`, `js/store.js` y `js/designer.js` no cambiaron.

## 12. Pendientes e infraestructura

1. **Sistema interno** (`PARA-SISTEMA-INTERNO.md`): validar `fecha_deseada` en el servidor; publicar el estado, la etapa y el precio de cada cotización; recibir modificaciones y revisiones por API; ofrecer una pantalla para el diseñador con avisos; y aceptar una clave contra duplicados.
2. **Corpotex:** aprobar o ajustar los porcentajes 10 % y 25 %; definir los feriados; decidir la foto del polo sublimado; enviar el **modelo gráfico** (punto 3).
3. **Envío automático por WhatsApp:** requiere la API de WhatsApp Business Platform en un servidor.
4. **Licencia del modelo 3D:** el modelo de Sketchfab usa la licencia Standard, que no está comprada (pendiente de antes).

## Cómo iniciar y probar

```bash
python -m http.server 8780 --directory corpotex
```

Ejecútalo desde `C:\Claude\servicios` y abre `http://localhost:8780/`. Si el puerto está ocupado, usa otro.

- **No registres pedidos contra producción sin simular el POST:** cada «Registrar solicitud» crea una cotización real. Para simularlo, pega esto en la consola del navegador antes de registrar:

```js
const realFetch = fetch.bind(window);
window.fetch = async (u, o = {}) => o.method === 'POST' && /\/api\/cotizaciones/.test(u)
  ? new Response(JSON.stringify(/diseno$/.test(u) ? { ok: true } : { codigo: 'COT-PRUEBA' }), { status: 201, headers: { 'content-type': 'application/json' } })
  : realFetch(u, o);
```

- Para probar el bloqueo por etapa sin el sistema interno, abre «Mis solicitudes», entra en una solicitud y ejecuta `stateCache.set('COT-PRUEBA', { known: true, etapa: 'corte', precio: 1000 })`. Luego vuelve a entrar en la solicitud.
- Al publicar una versión nueva, cambia `?v=20261011` en `index.html`.
