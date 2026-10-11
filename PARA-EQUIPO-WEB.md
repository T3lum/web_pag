# Corpotex — Handoff para el equipo de la página web

Todo lo que la página web necesita del sistema interno para trabajar en conjunto: los servicios (secciones 1 a 9) y los datos de la planta que hay detrás: prendas, etapas y duraciones (secciones 10 a 14).

Estado: **en funcionamiento desde el 2026-10-10**. Los servicios ya responden en la URL de la sección 3. Si algún formato no les calza, avisen antes de programarlo.

---

## 1. Resumen

| # | Qué | Quién lo provee | Cómo |
|---|---|---|---|
| 1 | Lista de productos | Sistema interno | `GET /api/productos` |
| 2 | Tiempo estimado de entrega | Sistema interno | `POST /api/estimar` |
| 3 | Cotización del cliente | Página web | `POST /api/cotizaciones` → devuelve un código |
| 3b | Diseño del cliente | Página web | `POST /api/cotizaciones/{codigo}/diseno` |
| 4 | Código de cotización en el mensaje de WhatsApp | Página web | Texto del mensaje |

Reglas que no cambian:

- **La web no calcula tiempos de entrega.** Siempre los pide al sistema interno, que conoce la carga real de la planta.
- **La web no crea pedidos.** Crea cotizaciones. Una cotización **no entra a la cola de producción** ni ocupa capacidad hasta que el vendedor la carga con su código y la confirma.
- **Los productos se llaman igual en los dos sistemas.** La lista vive en el sistema interno y la web la lee de ahí.

## 2. Flujo completo

1. El cliente arma su pedido en la web (producto, cantidad, tallas, personalización, diseño).
2. La web llama a `POST /api/estimar` y muestra la fecha estimada.
3. El cliente acepta. La web llama a `POST /api/cotizaciones` y recibe un código, por ejemplo `COT-1234`.
   Si el cliente subió un diseño, la web lo envía a `POST /api/cotizaciones/COT-1234/diseno`.
4. La web abre WhatsApp con un mensaje que incluye ese código.
5. Ventas escribe el código en el sistema interno; el pedido se llena solo y el diseño aparece junto a él. Ventas confirma con el cliente y da la fecha en firme. Recién ahí el pedido entra a producción.

## 3. Datos generales

- **URL base:** `https://sistemainterno-production.up.railway.app` (desplegado el 2026-10-10). Ejemplo: `GET https://sistemainterno-production.up.railway.app/api/productos`.
- **Datos de prueba:** por ahora la planta tiene pedidos de demostración cargados, así que `/api/estimar` devuelve plazos más largos que los reales.
- **Formato:** JSON en UTF-8.
- **Fechas:** `AAAA-MM-DD`.
- **Días hábiles:** lunes a sábado.
- **Errores:** código HTTP 400 o 404 con `{ "error": "mensaje legible" }`.
- **Sin clave:** los cuatro servicios `/api` son públicos. El PIN que pide el sistema interno es solo para sus pantallas; la web no lo necesita.
- **CORS:** por ahora abierto a cualquier origen, para que puedan probar. Cuando nos digan el dominio de la web se limita a ese.

## 4. `GET /api/productos`

Devuelve la lista de productos que la planta fabrica o vende.

```json
[
  {
    "id": "polo-camisero",
    "nombre": "Polo camisero",
    "linea": "empresarial",
    "personalizaciones": ["ninguna", "bordado", "dtf", "sublimado", "bordado_dtf"],
    "personalizacion_por_defecto": "bordado",
    "minimo": 12
  }
]
```

| Campo | Significado |
|---|---|
| `id` | Identificador fijo. **Es el que deben enviar** en estimar y cotizaciones. |
| `nombre` | Nombre para mostrar. |
| `linea` | `empresarial`, `chef`, `peregrino`, `agroindustria` o `comercializado`. |
| `personalizaciones` | Opciones válidas para ese producto. |
| `minimo` | Cantidad mínima de pedido. |

Valores de personalización:

| Valor | Significado |
|---|---|
| `ninguna` | Sin logo ni diseño |
| `bordado` | Logo bordado |
| `dtf` | Estampado DTF |
| `sublimado` | Sublimado full color |
| `bordado_dtf` | Bordado y DTF en la misma prenda |

Las fotos, descripciones comerciales y precios son de la web; el sistema interno no los guarda.

## 5. `POST /api/estimar`

Calcula cuándo estaría listo un pedido según la carga actual de la planta. No guarda nada; pueden llamarlo las veces que quieran.

Petición:

```json
{
  "items": [
    { "producto": "polo-camisero", "cantidad": 300, "personalizacion": "bordado" }
  ]
}
```

Respuesta:

```json
{
  "fecha_estimada": "2026-10-22",
  "dias_habiles": 10,
  "detalle": [
    { "area": "Almacén", "inicio": "2026-10-12", "fin": "2026-10-12" },
    { "area": "Corte", "inicio": "2026-10-13", "fin": "2026-10-14" },
    { "area": "Confección", "inicio": "2026-10-13", "fin": "2026-10-19" },
    { "area": "Bordado", "inicio": "2026-10-14", "fin": "2026-10-19" },
    { "area": "Acabados", "inicio": "2026-10-14", "fin": "2026-10-20" }
  ]
}
```

Cómo mostrarlo:

- Usen `fecha_estimada` o `dias_habiles`. El `detalle` es opcional, por si quieren mostrar una línea de tiempo.
- Preséntenlo como **"entrega estimada"**, nunca como fecha garantizada. La fecha en firme la da ventas al confirmar.
- La estimación cambia con la carga de la planta: vuelvan a pedirla justo antes de generar la cotización, no la guarden por horas.

## 6. `POST /api/cotizaciones`

Guarda la cotización del cliente y devuelve el código que ventas usará para cargarla.

Petición:

```json
{
  "cliente": {
    "nombre": "María Torres",
    "empresa": "Restaurante El Puerto",
    "telefono": "999888777"
  },
  "items": [
    {
      "producto": "polo-camisero",
      "cantidad": 300,
      "personalizacion": "bordado",
      "color": "Azul marino",
      "tallas": { "S": 50, "M": 120, "L": 100, "XL": 30 },
      "notas": "Logo en el pecho izquierdo"
    }
  ],
  "precio_total": 9600.00,
  "fecha_estimada": "2026-10-22"
}
```

| Campo | Obligatorio | Nota |
|---|---|---|
| `cliente.nombre`, `cliente.telefono` | Sí | |
| `cliente.empresa` | No | |
| `items[].producto`, `cantidad`, `personalizacion` | Sí | `producto` es el `id` de `/api/productos`. |
| `items[].tallas` | Sí | La suma debe coincidir con `cantidad`. |
| `items[].color`, `items[].notas` | No | Texto libre. |
| `precio_total` | No | El precio lo calcula la web; el sistema interno solo lo muestra a ventas. |
| Otros campos de la cotización | — | **Los definen ustedes.** Cuando fijen qué lleva la cotización (precios por ítem, condiciones, vigencia), nos pasan los campos y los agregamos. |
| `fecha_estimada` | Sí | La que se le mostró al cliente. |

Respuesta:

```json
{ "codigo": "COT-1234" }
```

## 6b. `POST /api/cotizaciones/{codigo}/diseno`

Sube el diseño o logo del cliente y lo vincula a la cotización. El archivo se guarda en la nube del sistema interno (Supabase Storage); ustedes no necesitan claves ni almacenamiento propio.

- Formato: `multipart/form-data` con un campo llamado `archivo`.
- Tipos aceptados: PNG, JPG, WEBP o PDF. Máximo 10 MB.
- Un diseño por cotización: si se envía otro, reemplaza al anterior.
- Se llama **después** de crear la cotización, porque necesita el código.

```js
const datos = new FormData();
datos.append("archivo", archivoDelCliente);
await fetch(`${URL_BASE}/api/cotizaciones/${codigo}/diseno`, { method: "POST", body: datos });
```

Respuesta: `{ "codigo": "COT-1234", "diseno": "guardado" }`. Si el código no existe, 404.

## 7. Mensaje de WhatsApp

El código debe ir en el texto, en una línea fácil de ubicar. Ejemplo:

```
Hola, quiero confirmar mi cotización.
Código: COT-1234
300 polos camiseros bordados
Entrega estimada: 22/10/2026
```

Ventas solo necesita el código; el resto es para que el cliente y el vendedor se entiendan.

## 8. Lo que necesitamos de ustedes

1. **Dominio de la web**, para habilitar CORS.
2. **Los campos de la cotización** cuando los fijen (sección 6), y confirmar el resto de formatos.
3. **Nombres de productos:** si en la web van a ofrecer algo que no esté en `/api/productos`, avísennos para agregarlo; sin eso no podemos estimarlo.

## 9. Lo que todavía no está

- La lista final de productos: la de la sección 10 es la primera versión, sacada de los catálogos Empresarial, Chef, Peregrino y Productos comercial.
- Los campos de precio de la cotización, que definen ustedes.
- El sistema interno no maneja precios ni pagos.

## 10. Prendas

Lista completa al 2026-10-10. La fuente viva es `GET /api/productos`: léanla de ahí en vez de copiar esta tabla, porque puede crecer.

Las tres últimas columnas son los **minutos de trabajo por prenda** en cada etapa; sirven para entender por qué una prenda demora más que otra.

| `id` | Nombre | Línea | Personalizaciones | Por defecto | Mínimo | Corte | Confección | Acabados |
|---|---|---|---|---|---|---|---|---|
| `polo-cuello-redondo` | Polo cuello redondo | empresarial | ninguna, bordado, dtf, sublimado, bordado_dtf | dtf | 12 | 1 | 10 | 3 |
| `polo-camisero` | Polo camisero | empresarial | ninguna, bordado, dtf, sublimado, bordado_dtf | bordado | 12 | 1,2 | 16 | 3 |
| `polo-manga-larga` | Polo manga larga | empresarial | ninguna, bordado, dtf, sublimado, bordado_dtf | dtf | 12 | 1,2 | 13 | 3 |
| `camisa-corporativa` | Camisa corporativa | empresarial | ninguna, bordado | bordado | 12 | 1,5 | 28 | 5 |
| `pantalon-industrial` | Pantalón industrial | empresarial | ninguna, bordado | ninguna | 12 | 1,5 | 26 | 4 |
| `chaleco-industrial` | Chaleco industrial | empresarial | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 2 | 32 | 4 |
| `casaca-corporativa` | Casaca corporativa | empresarial | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 2,5 | 55 | 6 |
| `mameluco` | Mameluco / overol | empresarial | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 3 | 50 | 6 |
| `uniforme-camisa-pantalon` | Uniforme camisa + pantalón | empresarial | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 3 | 54 | 9 |
| `uniforme-medico` | Uniforme médico | empresarial | ninguna, bordado | bordado | 12 | 1,5 | 30 | 5 |
| `guardapolvo` | Guardapolvo | agroindustria | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 1,5 | 30 | 5 |
| `canguro` | Canguro | agroindustria | ninguna, bordado, dtf, bordado_dtf | dtf | 12 | 0,8 | 9 | 2 |
| `cofia` | Cofia | agroindustria | ninguna, bordado | ninguna | 12 | 0,5 | 7 | 1,5 |
| `chaqueta-chef` | Chaqueta de chef | chef | ninguna, bordado | bordado | 12 | 1,5 | 30 | 5 |
| `pantalon-cocina` | Pantalón de cocina | chef | ninguna, bordado | ninguna | 12 | 1,5 | 26 | 4 |
| `mandil` | Mandil | chef | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 0,8 | 9 | 2 |
| `delantal` | Delantal | chef | ninguna, bordado, dtf, bordado_dtf | bordado | 12 | 0,8 | 9 | 2 |
| `gorro-cocina` | Gorro de cocina | chef | ninguna, bordado | ninguna | 12 | 0,5 | 7 | 1,5 |
| `polo-sublimado` | Polo sublimado full color | peregrino | sublimado | sublimado | 12 | 1 | 10 | 3 |
| `polo-manga-larga-sublimado` | Polo manga larga sublimado | peregrino | sublimado | sublimado | 12 | 1,2 | 13 | 3 |
| `casaca-cortaviento` | Casaca cortaviento | peregrino | sublimado, dtf | sublimado | 12 | 2,5 | 55 | 6 |
| `buzo` | Buzo | peregrino | ninguna, sublimado | sublimado | 12 | 3 | 60 | 8 |
| `chaleco-peregrino` | Chaleco peregrino | peregrino | sublimado, dtf | sublimado | 12 | 2 | 32 | 4 |
| `accesorio-textil` | Vincha / banderola / morral | peregrino | sublimado, dtf | sublimado | 12 | 0,5 | 5 | 1,5 |
| `epp` | EPP (casco, botas, lentes, guantes) | comercializado | ninguna | ninguna | 1 | — | — | 1 |
| `merchandising` | Merchandising | comercializado | ninguna, dtf, bordado | ninguna | 12 | — | — | 1 |

Reglas que la web debe respetar al armar el pedido:

- Solo ofrecer las personalizaciones que el producto trae en `personalizaciones`. Si se envía otra, el servicio responde 400.
- No aceptar cantidades menores a `minimo`.
- Los comercializados (EPP y merchandising) se compran hechos: no pasan por Corte ni Confección.
- Varias prendas distintas van como varios ítems en la misma llamada; no hay que estimarlas por separado.

## 11. Etapas de producción

Un pedido recorre estas etapas. Son las mismas que devuelve `detalle` en `/api/estimar`, con esos nombres.

| Etapa | Qué se hace |
|---|---|
| Almacén | Se separa la tela y los insumos de todo el pedido. |
| Corte | Se corta la tela. |
| Confección | Se cose la prenda. Es la etapa más lenta de todas. |
| Bordado | Logo bordado. |
| Sublimado | Estampado full color sobre la tela. |
| DTF | Estampado DTF sobre la prenda terminada. |
| Acabados | Limpieza de hilos, planchado, control de calidad y embolsado. |

El orden depende de la personalización:

| Personalización | Recorrido |
|---|---|
| `ninguna` | Almacén → Corte → Confección → Acabados |
| `bordado` | Almacén → Corte → Confección → Bordado → Acabados |
| `dtf` | Almacén → Corte → Confección → DTF → Acabados |
| `bordado_dtf` | Almacén → Corte → Confección → Bordado → DTF → Acabados |
| `sublimado` | Almacén → Sublimado → Corte → Confección → Acabados |
| Comercializados | Almacén → (Bordado o DTF si lleva logo) → Acabados |

El pedido no avanza entero de una etapa a otra: se divide en **bloques** de 25, 50 o 100 prendas que avanzan por separado. Por eso en `detalle` las etapas se solapan (Bordado puede empezar antes de que Confección termine).

## 12. Duraciones

**La web no debe calcular fechas con estos números.** Están aquí para que entiendan los resultados; el cálculo real depende de cuántos pedidos tiene la planta en ese momento y solo lo conoce `/api/estimar`. Además, el jefe de producción puede ajustar estos valores desde el sistema interno.

- **Jornada:** lunes a sábado, 8 horas. Domingos no se trabaja.
- **Capacidad por día:** Almacén 300 prendas; Corte 300 minutos; Confección 900; Bordado 1 200; Sublimado 450; DTF 300; Acabados 600.
- **Personalización, minutos por prenda:** Bordado 8; Sublimado 3; DTF 1,5.
- **Minutos por prenda en Corte, Confección y Acabados:** tabla de la sección 10.
- **Margen de seguridad:** a lo que demora la producción se le suma un 20 %, con un mínimo de 2 días hábiles. Ya viene incluido en `fecha_estimada`.
- **Tela:** la web siempre estima como si hubiera tela. Si no hay, ventas suma 3 días hábiles al confirmar.

Ejemplo de lectura: Confección tiene 900 minutos al día y un polo camisero pide 16, así que salen unos 56 polos camiseros por día.

## 13. Tiempos de referencia

Días hábiles que devuelve `/api/estimar` con la **planta vacía** y los valores de la sección 12; es el mínimo posible. Con pedidos en cola el plazo sube.

| Pedido | Días hábiles |
|---|---|
| 50 polos cuello redondo con DTF | 4 |
| 300 polos cuello redondo con DTF | 7 |
| 100 polos camiseros bordados | 6 |
| 300 polos camiseros bordados | 10 |
| 100 polos sublimados full color | 5 |
| 100 camisas corporativas bordadas | 7 |
| 100 uniformes camisa + pantalón bordados | 10 |
| 50 casacas corporativas bordadas | 7 |
| 200 mandiles bordados | 6 |
| 100 EPP sin personalizar | 3 |

Dos de estos coinciden con los plazos que la empresa da a sus clientes: 300 polos y 100 uniformes en 10 días hábiles.

## 14. Cómo probar

```bash
curl https://sistemainterno-production.up.railway.app/api/productos

curl -X POST https://sistemainterno-production.up.railway.app/api/estimar \
  -H "Content-Type: application/json" \
  -d '{"items":[{"producto":"polo-camisero","cantidad":300,"personalizacion":"bordado"}]}'
```

- `/api/estimar` no guarda nada: pueden llamarlo todas las veces que quieran.
- `/api/cotizaciones` **sí guarda** en la base real. Para pruebas usen el teléfono `PRUEBA` en `cliente.telefono`, así se pueden ubicar y borrar.
- Mientras la planta tenga pedidos de demostración, los plazos salen más largos que los de la sección 13.

## 15. Cambios del 2026-10-11

- `POST /api/estimar` ignora `urgente` y `hay_tela`. Responde solo `fecha_estimada`, `dias_habiles` y `detalle`.
- `POST /api/cotizaciones` acepta además, todos opcionales: `precio_total` (número), `fecha_deseada` (AAAA-MM-DD; se rechaza con 400 si es domingo o anterior a lo que la planta puede cumplir), `clave_idempotencia` (texto; si se repite, devuelve la misma cotización), `origen` (`web` o `chatbot`), `marca` y `campana`.
- `POST /api/cotizaciones` responde `{ "codigo": "COT-1234", "clave": "…" }`. La clave hay que guardarla: es la que permite consultar la cotización.
- Nuevo `GET /api/cotizaciones/{codigo}?clave=…`:

```json
{
  "codigo": "COT-1234",
  "estado": "confirmada",
  "etapa": "Confección",
  "fecha_estimada": "2026-10-22",
  "fecha_comprometida": "2026-10-24",
  "precio_confirmado": 14400,
  "cambios": { "sencillo": true, "detallado": false }
}
```

  `estado` es `registrada` mientras ventas no la confirma (entonces `etapa` es `null`) y `confirmada` después. `etapa` es la del bloque más atrasado: Almacén, Sublimado, Corte, Confección, Bordado, DTF, Acabados, Listo o Entregado. Sin clave, o con una clave equivocada, responde 404.
- Regla de cambios: sencillo (texto o tipografía del logo) mientras ningún bloque haya llegado a Bordado, DTF o Sublimado; detallado (cuello, modelo, tela) solo mientras el pedido sigue en Almacén.
