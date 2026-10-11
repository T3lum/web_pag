Actúa como estratega de pitch para una hackatón. Ayúdanos a preparar el pitch de nuestra solución para el reto Corpotex–UniCrack de la Hackathon Piura Innova 2026 (bloque «Producción por pedido»). Abajo está todo lo que construimos. Usa solo estos datos: si algo falta o lo marco como [confirmar], no lo inventes y pregúntamelo o déjalo indicado. Escribe en español de Perú, claro y sin jerga técnica innecesaria.

Duración del pitch: [X minutos] · Criterios del jurado: [pegar si los tenemos] · Equipo: [nombres y roles]

## 1. La empresa y el problema (según el caso entregado por la empresa)

- Corpotex (11 años): indumentaria industrial y uniformes corporativos para empresas de agroindustria, refinería y minería, con crédito corporativo y licitaciones con gobiernos locales. UniCrack (5 años): UniCrack Sport (ropa deportiva) y UniCrack Uniformes (escolares en Piura). Las dos comparten personal de producción y parte de los materiales.
- El 80 % de las ventas es presencial y el 20 % virtual. Solo dos personas atienden la parte comercial de ambas empresas. Usan WhatsApp Business, que no cubre sus necesidades.
- Problema central: la información de pedidos, inventario, materiales y avance de producción no está actualizada ni conectada entre producción y comercial. Para saber cuánto tarda un pedido, comercial llama a producción, y la respuesta depende de que producción tenga tiempo.
- Efectos: fechas de entrega poco realistas al cerrar contratos, retrasos y quejas, tiempo perdido en llamadas, cuello de botella en el cierre comercial, muestras físicas con cambios sin límite y sobrecarga de ambos equipos.
- Formulación del reto: ¿cómo conectar la información de inventario y avance de producción para que comercial responda más rápido y con más precisión sobre la viabilidad y el tiempo de entrega de cada pedido?

## 2. Nuestra solución: dos piezas conectadas por un mismo registro

La solución es una sola cadena: el cliente arma y diseña su pedido en la web, la planta calcula la entrega con su carga real, ventas confirma con un código y producción registra el avance por área. La cotización que nace en la web es el mismo registro que luego sigue la planta.

### Pieza A: página web pública de Corpotex (para el cliente; funciona en celular y en computadora)

- **Catálogo en vivo:** los productos vienen del sistema interno, con las fotos y descripciones de la web. Cada ficha muestra el pedido mínimo, las personalizaciones posibles y la entrega estimada calculada en ese momento.
- **Solicitud en 3 pasos:**
  1. **Pedido:** prenda, personalización (sin personalizar, bordado, DTF, sublimado, o bordado + DTF), cantidad (mínimo 12), reparto por tallas que debe sumar la cantidad, datos de contacto y fecha deseada. La web muestra la **entrega estimada según la carga real de la planta**. Si la fecha deseada es anterior a la estimada, no la acepta.
  2. **Diseño:**
     - Estilo base (clásico, dinámico o minimalista).
     - Para el polo camisero, un **editor 3D integrado** en 4 pasos:
       - **Colores:** tejido, cuello y puños, y botones. El polo siempre lleva 2 botones, como lo fabrica Corpotex.
       - **Estampado:** logo solo en PNG, validado por extensión, tipo y firma real del archivo, más un texto opcional.
       - **Ubicación:** 7 zonas (pecho izquierdo, centro, pecho derecho, espalda, nuca y ambas mangas), con ajuste fino en centímetros.
       - **Vista previa:** se generan 4 vistas (frente, 3/4, lateral y espalda), que se pueden descargar sueltas, en lámina o en .zip.
     - Para lo que el editor no cubre, el cliente puede pedir una **revisión del diseñador**: elige el motivo, describe el diseño y adjunta hasta 3 imágenes de referencia.
  3. **Resumen y registro:**
     - La web vuelve a pedir la estimación justo antes de registrar.
     - Crea la cotización en el sistema interno, que devuelve un código (COT-…).
     - Adjunta una **ficha PDF del diseño**: vistas, especificaciones, logo original y referencias.
     - Recién con el registro confirmado abre WhatsApp de ventas con el mensaje «Conversando con Corpotex». El cliente menciona su código.
     - No se puede duplicar una solicitud aunque se pulse varias veces.
- **Mis solicitudes:** el cliente ve sus pedidos registrados y el historial de versiones de su diseño (la original se conserva siempre). También puede **pedir modificaciones con reglas claras**:
  - 3 categorías:
    - Ajuste leve: recargo desde S/ 0.
    - Cambio moderado: +10 % (rango de 5 a 15 %).
    - Rediseño mayor: +25 % (rango de 20 a 40 %).
  - Estos porcentajes son una propuesta para que la empresa la valide.
  - Cada categoría solo se permite antes de cierta etapa de fabricación: las dos primeras, antes del bordado o estampado; el rediseño, antes del corte.
  - La web compara el antes y el después del diseño y exige la categoría mínima que corresponde al cambio. Por ejemplo, cambiar el color de la tela es un rediseño mayor.
- **Extras:** asistente de preguntas frecuentes, barra de navegación inferior en el celular, botón Atrás del navegador funcional en todo el flujo y borrador que se recupera si se recarga la página.

### Pieza B: sistema interno «Corpotex Planta» (para el equipo; web instalable en celular o tablet)

- Desplegado en Railway con base de datos y archivos en Supabase. URL: https://sistemainterno-production.up.railway.app
- **Entrada por área con PIN**: Ventas, Jefe de producción, Gerencia, Administrador/TI, Almacén, Corte, Confección, Bordado, Sublimado, DTF y Acabados. Cada persona ve solo lo de su área.
  - Qué hace cada pantalla: [confirmar con el equipo de la intranet: registro de avance por área, tablero del jefe, indicadores de gerencia, almacén y Kardex].
- **Ventas:** escribe el código COT, el pedido se llena solo con los datos y el diseño del cliente, confirma con el cliente y da la fecha en firme. **Una cotización no ocupa capacidad hasta que ventas la confirma.** Recién ahí entra a la cola de producción.
- **Motor de planificación (calcula la entrega estimada):**
  - Capacidad diaria por área:
    - Almacén: 300 prendas.
    - Corte: 300 minutos.
    - Confección: 900 minutos.
    - Bordado: 1 200 minutos.
    - Sublimado: 450 minutos.
    - DTF: 300 minutos.
    - Acabados: 600 minutos.
  - Minutos de trabajo por prenda en cada etapa. Por ejemplo, un polo camisero toma 16 minutos de confección, así que salen unos 56 al día.
  - El recorrido depende de la personalización. En bordado: Almacén → Corte → Confección → Bordado → Acabados. En sublimado, la tela se estampa antes del corte.
  - El pedido avanza en **bloques de 25, 50 o 100 prendas**, así que las etapas se solapan.
  - Jornada de lunes a sábado, 8 horas. Margen de seguridad del 20 %, con un mínimo de 2 días hábiles. Si falta tela, ventas suma 3 días.
  - El jefe de producción puede ajustar estos parámetros desde el sistema.
- **Catálogo:** 26 productos en 5 líneas (empresarial, chef, peregrino, agroindustria y comercializado). Los productos comercializados (EPP y merchandising) no pasan por corte ni confección.
- **Tiempos de referencia con la planta vacía:**
  - 100 polos camiseros bordados: 6 días hábiles.
  - 300 polos camiseros bordados: 10 días hábiles.
  - 100 uniformes de camisa + pantalón: 10 días hábiles.
  - Los dos de 10 días coinciden con lo que la empresa promete hoy a sus clientes.
- **Servicios abiertos a la web:**
  - Lista de productos.
  - Estimación de entrega (no guarda nada).
  - Creación de cotizaciones.
  - Subida del diseño (PNG, JPG, WEBP o PDF, hasta 10 MB).

## 3. Cómo responde al caso

- **Comercial y producción descoordinados:** la estimación sale del sistema al instante, con la carga real de la planta, sin llamar a producción.
- **Cuello de botella de 2 comerciales:** el cliente llega con el pedido completo, el diseño y la fecha estimada. Ventas solo confirma un código.
- **WhatsApp poco efectivo:** se mantiene como canal, pero la conversación empieza con una cotización ordenada y con código.
- **Muestras y cambios sin límite:** la vista previa 3D reduce las muestras físicas, y las modificaciones tienen categorías, recargos y límites por etapa.
- **Pedidos y avance desactualizados:** cada área registra lo suyo en el sistema interno [confirmar el detalle].
- **Kardex e inventario:** [confirmar qué cubre hoy la pantalla de Almacén].
- **Responsabilidad social:** no está abordada en esta versión.
- Relación con los casos del bloque: cubre «Torre de control de producción» (capacidad y fecha que se puede prometer) y «Del WhatsApp al taller» (toma de pedido guiada, maqueta automática con el logo del cliente y versiones del diseño). No cubre pagos ni rentabilidad, ni la red de talleres.

## 4. Límites honestos y siguientes pasos

- La web todavía no muestra precios, y el sistema interno no maneja precios ni pagos. Los campos de precio de la cotización están por definir con la empresa.
- El sistema interno aún no publica hacia la web la etapa de fabricación de cada pedido. Por eso las modificaciones se envían como «consulta» y Corpotex verifica si son posibles.
- La planta tiene pedidos de demostración cargados, así que los plazos salen más largos que los reales.
- Para producción falta:
  - Limitar el acceso a los servicios al dominio de la web.
  - Comprar la licencia del modelo 3D del polo (Sketchfab, licencia Standard) o usar un modelo propio.
  - Una foto del uniforme escolar.
- El personal externo de los picos de demanda no tendría acceso al sistema.

## 5. Demo sugerida (ajústala al flujo real de la intranet)

1. En el celular, el cliente elige el polo camisero, pone 300 unidades con bordado y ve la entrega estimada.
2. Lo diseña en 3D con su logo y genera la vista previa.
3. Registra la solicitud: aparece su código COT y se abre WhatsApp.
4. En «Corpotex Planta», ventas escribe el código, ve el pedido y el diseño, y lo confirma.
5. El pedido entra a la cola, y [confirmar: un área registra avance y el jefe lo ve en su tablero].

## Lo que te pido

1. Estructura del pitch con tiempos por bloque: problema, solución, demo, impacto, implementación y siguiente paso.
2. Guion hablado por diapositiva y texto breve para cada diapositiva.
3. Guion de la demo en vivo, con un plan B si falla internet.
4. Indicadores de impacto para medir en un piloto: tiempo de respuesta de una cotización, llamadas entre comercial y producción, porcentaje de pedidos a tiempo, rondas de muestras por pedido. **No inventes cifras de resultados**: plantéalos como metas o como lo que mediríamos.
5. Las 10 preguntas más probables del jurado, con respuestas cortas.
6. Lista de datos que debemos confirmar antes de presentar.
