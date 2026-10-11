# Corpotex · Lo que la web necesita del sistema interno

Fecha: 2026-10-11. De: equipo de la página web. Para: equipo del sistema interno (`sistemainterno-production.up.railway.app`).

La web ya usa los cuatro servicios de `PARA-EQUIPO-WEB.md` (productos, estimar, cotizaciones y diseño). Para que funcionen de verdad las modificaciones, la revisión del diseñador y la validación de fechas en el servidor, faltan los servicios de abajo. La web ya está preparada para casi todos: basta con activar una opción en `js/config.js`.

Todos los formatos son propuestas: si les conviene otro, avísennos antes de programarlo.

## 1. Validar la fecha deseada en `POST /api/cotizaciones`

**Hoy:** la web envía `fecha_deseada` (AAAA-MM-DD, opcional) y lo valida en el navegador: no puede ser anterior a la `fecha_estimada` ni caer en domingo. Antes de registrar, vuelve a pedir `/api/estimar`. Comprobamos que el servidor no rechaza ese campo, pero tampoco lo valida.

**Pedido:** que el servidor recalcule la fecha mínima al recibir la cotización y responda `400 { "error": "…" }` si:

- `fecha_deseada` es anterior a la fecha mínima recalculada, o
- `fecha_deseada` no es un día de entrega (lunes a sábado; y feriados, si el sistema los conoce).

Así la regla se cumple aunque alguien llame a la API sin pasar por la web. La web ya muestra el `error` que devuelvan.

## 2. Estado de una cotización: `GET /api/cotizaciones/{codigo}`

Sirve para tres cosas: mostrar la etapa real, habilitar o bloquear las modificaciones según esa etapa y calcular el recargo porcentual sobre un valor de referencia real.

```json
{
  "codigo": "COT-1234",
  "estado": "confirmada",
  "etapa": "Confección",
  "precio_confirmado": 9600.00,
  "fecha_comprometida": "2026-10-24",
  "actualizado": "2026-10-15T10:20:00-05:00"
}
```

| Campo | Uso en la web |
|---|---|
| `estado` | `registrada` (cotización sin confirmar) o `confirmada` (pedido en producción). |
| `etapa` | Mismos nombres que `detalle` de `/api/estimar`: Almacén, Corte, Confección, Bordado, Sublimado, DTF, Acabados, y además «Listo» y «Entregado». |
| `precio_confirmado` | Valor de referencia para el recargo de las categorías 2 y 3. Si falta, la web muestra «importe pendiente de validación». |
| `fecha_comprometida` | La fecha en firme que dio ventas. Si falta, la web sigue mostrando la estimada. |

**Privacidad:** los códigos `COT-1234` se pueden adivinar. Proponemos que `POST /api/cotizaciones` devuelva también una clave aleatoria (`{ "codigo": "COT-1234", "clave": "k8f…" }`) y que este servicio la exija como parámetro (`?clave=k8f…`), sin cabeceras nuevas, para no tocar CORS. La respuesta no debe incluir datos personales.

**En la web:** poner `estadoEnLinea: true` en `js/config.js`. Las reglas de qué categoría se acepta en cada etapa están en `modificaciones.categorias[].permitidoAntesDe`.

## 3. Modificaciones: `POST /api/cotizaciones/{codigo}/modificaciones`

**Hoy:** la modificación se guarda en el dispositivo del cliente (con su versión nueva del diseño) y se envía a ventas como texto por WhatsApp. El sistema interno no la recibe.

**Pedido:** `multipart/form-data` con:

| Campo | Contenido |
|---|---|
| `datos` | JSON: `{ "categoria": 2, "descripcion": "…", "cambios": [{ "campo": "Logo", "antes": "…", "despues": "…" }], "version_base": 1, "version_nueva": 2 }` |
| `archivo` | Opcional: ficha PDF o PNG de la versión nueva del diseño. |

Respuesta: `{ "id": "MOD-1234-1", "estado": "solicitada" }`. Estados: `solicitada` → `aprobada` o `rechazada` → `aplicada` (cuando producción ya trabaja con la versión nueva). La versión original nunca se borra.

`GET /api/cotizaciones/{codigo}` podría devolver además `modificaciones: [{ id, estado }]` para que el cliente vea si se aprobó.

## 4. Revisión del diseñador

**Hoy:** la solicitud de revisión (motivo, descripción e imágenes de referencia) viaja dentro de la cotización: va en `items[].notas` como «REVISIÓN DEL DISEÑADOR REV-…», y las imágenes van dentro de la ficha PDF que se sube a `/diseno`. No llega ningún aviso al diseñador y no tiene pantalla propia.

**Pedido:**

1. `POST /api/cotizaciones/{codigo}/revision` (`multipart/form-data`): `datos` = `{ "motivo": "…", "descripcion": "…" }` y hasta 3 `referencias` (PNG, JPG o WEBP de máximo 10 MB). Respuesta: `{ "id": "REV-…", "estado": "Pendiente de revisión" }`.
2. Una pantalla «Revisiones de diseño» en el sistema interno, protegida con el mismo PIN o con usuarios: lista de pendientes, referencias, cotización vinculada, descripción del cliente, observaciones del diseñador y cambio de estado.
3. Estados: Pendiente de revisión, En evaluación, Requiere información, Viable, No viable y Propuesta preparada. Son los de `revision.estados` en `js/config.js`.
4. Un aviso al diseñador cuando entra una revisión nueva (correo o WhatsApp Business).

Una revisión no es un diseño aprobado para fabricar: solo pasa a producción cuando ventas lo confirma.

La web no puede crear esta pantalla por su cuenta: ocultar una ruta en el navegador no la protege, y la web no tiene usuarios ni servidor propio.

## 5. Evitar cotizaciones duplicadas

Si `POST /api/cotizaciones` tarda más de 15 s, el navegador corta la espera. Si el servidor igual la guardó y el cliente reintenta, puede quedar duplicada.

**Pedido:** aceptar `clave_idempotencia` en el cuerpo JSON (no como cabecera, para no tocar CORS). Si llega una clave ya usada en las últimas 24 h, el servicio devuelve el mismo `codigo` sin crear otra. La web enviará el identificador interno de cada solicitud (`quote.qid`).

## 6. Lista de productos

- La web solo muestra los productos que tienen foto en `js/config.js → catalogo`: hoy son 11 de los 26 de `/api/productos`.
- No hay uniformes escolares ni en `/api/productos` ni en la web. Si algún día se agregan al sistema interno, no aparecerán en la web hasta que tengan foto.

## 7. Dominio para CORS

Cuando la web tenga dominio propio se lo pasamos para limitar CORS (sección 8 de `PARA-EQUIPO-WEB.md`).
