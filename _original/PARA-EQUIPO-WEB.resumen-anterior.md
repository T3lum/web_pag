# Corpotex · Documentación para el equipo web

## 1) Alcance y objetivo

Esta web pública de Corpotex consume servicios del sistema interno de la empresa a través de la URL configurada en `js/config.js`:

- `intranetUrl: https://sistemainterno-production.up.railway.app`
- `intranetTimeoutMs: 15000`

La web solo usa los endpoints públicos del backend y no calcula precios ni crea pedidos por sí sola. Su responsabilidad es:

- mostrar catálogo,
- pedir estimación de producción,
- registrar cotizaciones,
- enviar el diseño asociado a la cotización,
- consultar estado si el backend lo publica.

No debe modificarse la lógica comercial de la web ni redefinirse la marca o el flujo del pedido salvo que el backend confirme un cambio real.

## 2) Endpoints utilizados

### 2.1 Catalogo

- `GET /api/productos`
- Debe devolver una lista de productos con el formato que la web espera.
- Si el servicio responde con error, la web usa un caché local para seguir mostrando catálogo.

### 2.2 Estimación de entrega

- `POST /api/estimar`
- Body esperado: `{"items": [...]}`
- Respuesta esperada: `{"fecha_estimada": "..."}` o equivalente con la fecha/etapa que la web pueda renderizar.
- La respuesta se usa para el panel lateral y la estimación de producción antes de registrar.

### 2.3 Registro de cotización

- `POST /api/cotizaciones`
- Body esperado: payload con datos del cliente, producto, cantidades, medidas y el flujo de la solicitud.
- Respuesta esperada: `{"codigo": "COT-XXXX"}` o equivalente con el identificador real de la cotización.
- Si la respuesta falla, la web no abre WhatsApp ni avanza al resumen final.

### 2.4 Subida del diseño

- `POST /api/cotizaciones/{codigo}/diseno`
- Se envía como `multipart/form-data` con un campo `archivo`.
- La web ya hace `FormData` y no añade cabeceras manuales extra.
- La respuesta esperada debe devolver OK para confirmar que el diseño quedó asociado a la cotización.

### 2.5 Estado de la cotización (opcional)

- `GET /api/cotizaciones/{codigo}`
- Este endpoint no está habilitado de forma pública en la configuración actual.
- Cuando esté disponible con una respuesta útil, por ejemplo:

```json
{
  "estado": "confirmada",
  "etapa": "confeccion",
  "precio_confirmado": 250
}
```

la web puede activar `estadoEnLinea: true` en `js/config.js`.

## 3) Reglas de CORS y cabeceras

La API interna debe permitir las solicitudes del origen de la web pública.

Reglas actuales a mantener:

- La web no añade encabezados personalizados a la petición salvo `Content-Type` para JSON y `multipart/form-data` con `FormData`.
- El backend no debe requerir cabeceras adicionales de la web para los endpoints que hoy utiliza.
- Si se quiere introducir idempotencia, debe confirmarse con el backend antes de tocar la client-side.

Importante: no se debe añadir un header propio de idempotencia a `POST /api/cotizaciones` sin validarlo con el equipo backend. El sistema actual solo confirma `Content-Type` como encabezado permitido por CORS.

## 4) Idempotencia y duplicados

El backend debe decidir si admite una clave de idempotencia. La web no debe inventarla sin acuerdo previo.

Riesgo actual:

- si una llamada a `POST /api/cotizaciones` tarda más de 15 s y el servidor la registra igual,
- un reintento sin idempotencia puede duplicar la cotización.

Por eso, hasta que el backend confirme el mecanismo de idempotencia, la web no debe añadir ninguna cabecera ni parámetro inventado.

## 5) Flujos de la web

### 5.1 Flujo de solicitud

1. Usuario elige producto.
2. La web pide estimación.
3. Usuario avanza por el editor 3D y decide personalización.
4. Se registra la cotización en el backend.
5. Se sube el diseño asociado.
6. Se abre WhatsApp con la URL fija de ventas.

### 5.2 Reglas de negocio de la web

- La URL de WhatsApp es fija: `https://wa.me/51983453702?text=Conversando%20con%20Corpotex`
- Se abre solo después de que la cotización haya sido confirmada por el backend.
- La web no duplica solicitudes en el mismo flujo.
- El flujo debe poder cerrarse o regresar con el navegador sin romper la experiencia.
- No se renombran claves de almacenamiento:
  - `corpoFlow_Hackaton_v2`
  - `corpoflow_draft_v3`

## 6) Estado en línea

La web ya incorpora una bandera para activar o desactivar la consulta del estado de fabricación:

- `js/config.js` → `estadoEnLinea: false`

Condición recomendada:

- `true` solo cuando el backend tenga `GET /api/cotizaciones/{codigo}` publicándose y respondiendo con datos estables.
- `false` mientras ese endpoint responda 404 o no esté documentado en producción.

Esto evita errores de consola y peticiones inútiles a endpoints no disponibles.

## 7) Datos de prueba y entorno local

Durante la validación local se puede usar `localhost:8780` para probar la web sin afectar el entorno de producción.

No se deben dejar datos de prueba en el navegador de desarrollo:

- `localStorage['corpoFlow_Hackaton_v2']`
- `IndexedDB` de la base `corpotex`
- `sessionStorage['zz_mock']`

La limpieza debe hacerse solo en entornos de prueba y no en navegadores reales del cliente.

## 8) Pendientes del equipo backend / producto

- Confirmar si `GET /api/cotizaciones/{codigo}` está o estará disponible públicamente.
- Confirmar si se usará una clave de idempotencia y definir la política formal.
- Confirmar la estructura exacta de la respuesta de `POST /api/cotizaciones` y `POST /api/estimar`.
- Confirmar qué campos del producto y la cotización son obligatorios para cada flujo de la web.
- Confirmar si el diseño puede subirse siempre en el mismo endpoint o si habrá variantes por tipo de producto.

## 9) Checklist de implementación

Antes de activar la consulta de estado o tocar cabeceras adicionales, verificar:

- [ ] Existe `GET /api/cotizaciones/{codigo}` documentado.
- [ ] La respuesta incluye `etapa` o `estado` y el precio si aplica.
- [ ] CORS admite la web pública sin headers extra.
- [ ] La API confirma la política de idempotencia.
- [ ] La bandera `estadoEnLinea` en `js/config.js` se actualiza según el estado real.

## 10) Nota final

Este documento sirve como referencia para la integración web. Si el backend cambia el contrato, la web debe ajustarse con la mínima diferencia posible y documentando el cambio claro en este archivo.
