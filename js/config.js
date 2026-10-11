/* Configuración de Corpotex. La empresa puede editar este archivo sin tocar el resto del código. */
window.CORPOTEX_CONFIG = {
  // Sistema interno (ver PARA-EQUIPO-WEB.md). La web solo usa sus servicios públicos /api.
  intranetUrl: 'https://sistemainterno-production.up.railway.app',
  intranetTimeoutMs: 15000,
  // El sistema interno publica la etapa de cada cotización en GET /api/cotizaciones/{codigo}?clave=…
  // «Mis solicitudes» la consulta con la clave que se recibió al registrar.
  estadoEnLinea: true,

  // Asistente con inteligencia artificial (js/chat.js). La clave va en js/config.local.js, que no se sube al repositorio.
  geminiModelo: 'gemini-3.5-flash-lite',

  // WhatsApp de ventas: 983 453 702 en formato internacional de Perú (51 + número), sin «+».
  whatsapp: '51983453702',

  // Fotos y textos comerciales de la web para cada producto del sistema interno (el «id» debe existir en /api/productos).
  // Solo se muestran en la web los productos que tienen foto aquí. Las fotos salen del catálogo empresarial 2026 de
  // Corpotex (assets/catalogo/), sin marca de agua.
  catalogo: {
    'polo-camisero':       { fotos: ['catalogo/polo-camisero.jpg', 'catalogo/polo-camisero-combinado.jpg'], descripcion: 'Polo con cuello camisero y 2 botones para equipos de trabajo.', editor3d: true, precioReferencia: 48 },
    'polo-cuello-redondo': { fotos: ['catalogo/polo-algodon.jpg'], descripcion: 'Polo básico de cuello redondo para uso diario.', precioReferencia: 42 },
    'polo-sublimado':      { fotos: ['catalogo/polo-deportivo.jpg'], descripcion: 'Polo con sublimación a todo color.', precioReferencia: 46 },
    'camisa-corporativa':  { fotos: ['catalogo/camisa-oxford.jpg'], descripcion: 'Camisa para personal administrativo y comercial.', precioReferencia: 54 },
    'pantalon-industrial': { fotos: ['catalogo/pantalon-drill.jpg'], descripcion: 'Pantalón drill de trabajo.', precioReferencia: 58 },
    'chaleco-industrial':  { fotos: ['catalogo/chaleco-drill.jpg'], descripcion: 'Chaleco drill con bolsillos.', precioReferencia: 52 },
    'casaca-corporativa':  { fotos: ['catalogo/casaca-impermeable.jpg'], descripcion: 'Casaca de trabajo, impermeable o térmica.', precioReferencia: 78 },
    'mameluco':            { fotos: ['catalogo/mameluco.jpg'], descripcion: 'Uniforme enterizo para trabajo industrial.', precioReferencia: 86 },
    'uniforme-medico':     { fotos: ['catalogo/bata-quirurgica.jpg'], descripcion: 'Ropa para personal de salud.', precioReferencia: 64 },
    'chaqueta-chef':       { fotos: ['catalogo/chaqueta-chef.jpg'], descripcion: 'Chaqueta de cocina con botones.', precioReferencia: 92 },
    'mandil':              { fotos: ['catalogo/mandil.jpg'], descripcion: 'Mandil con bolsillo para cocina y atención.', precioReferencia: 36 }
  },
  // Calendario de entregas: días de la semana en que se puede pedir la entrega (0 = domingo … 6 = sábado).
  // La planta y los locales atienden de lunes a sábado (PARA-EQUIPO-WEB.md, secciones 3 y 12).
  diasEntrega: [1, 2, 3, 4, 5, 6],
  lineas: { empresarial: 'Empresarial', chef: 'Chef', peregrino: 'Peregrino', agroindustria: 'Agroindustria', comercializado: 'Comercializado' },
  personalizaciones: { ninguna: 'Sin personalización', bordado: 'Bordado', dtf: 'Estampado DTF', sublimado: 'Sublimado full color', bordado_dtf: 'Bordado + DTF' },
  tallas: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],

  // Etapas de fabricación del sistema interno (sección 11 de PARA-EQUIPO-WEB.md), en orden.
  // «decoracion» agrupa Bordado, DTF y Sublimado: a partir de ahí el estampado ya está aplicado.
  etapas: [
    { id: 'registrada',  nombre: 'Cotización registrada' },
    { id: 'confirmada',  nombre: 'Pedido confirmado por ventas' },
    { id: 'almacen',     nombre: 'Almacén' },
    { id: 'corte',       nombre: 'Corte' },
    { id: 'confeccion',  nombre: 'Confección' },
    { id: 'decoracion',  nombre: 'Bordado, DTF o sublimado' },
    { id: 'acabados',    nombre: 'Acabados' },
    { id: 'listo',       nombre: 'Listo para entrega' },
    { id: 'entregado',   nombre: 'Entregado' }
  ],

  // Categorías de modificación (imagen de referencia de la empresa: 1 «Desde S/ 0», 2 «+ S/ 40», 3 «+ S/ 120»).
  // Las categorías 2 y 3 se cobran como porcentaje del valor de referencia del pedido. 10 % y 25 % son una propuesta
  // inicial, no una tarifa oficial: el razonamiento y las fuentes están en INFORME-IMPLEMENTACION.md (sección 6).
  // La empresa debe validarlos y puede cambiarlos aquí («valor» y «rango»).
  // «permitidoAntesDe»: etapa de fabricación desde la cual esa categoría ya no se acepta.
  modificaciones: {
    categorias: [
      // Regla de la empresa (2026-10-11): el cambio sencillo no cuesta y se acepta hasta antes de Bordado, DTF o
      // Sublimado. El cambio detallado tiene un cobro adicional y solo se acepta mientras el pedido sigue en Almacén:
      // desde que entra a Corte ya no se puede.
      { id: 1, nombre: 'Cambio sencillo', descripcion: 'Texto o tipografía del logo, pequeños ajustes de color o de ubicación, sin rehacer el diseño.',
        recargo: { tipo: 'fijo', desde: 0 }, permitidoAntesDe: 'decoracion' },
      { id: 2, nombre: 'Cambio detallado', descripcion: 'Cambiar parte de los elementos gráficos o de la composición del diseño.',
        recargo: { tipo: 'porcentaje', valor: 10, rango: [5, 15] }, permitidoAntesDe: 'corte' },
      { id: 3, nombre: 'Cambio de modelo', descripcion: 'Cambiar el cuello (por ejemplo, de redondo a cuello en V), el patronaje o la tela.',
        recargo: { tipo: 'porcentaje', valor: 25, rango: [20, 40] }, permitidoAntesDe: 'corte' }
    ],
    // Cada modificación aprobada se calcula por separado sobre el valor de referencia (no se suman porcentajes).
    acumulacion: 'separada'
  },

  // Revisión del diseñador: formatos que acepta el sistema interno para adjuntos.
  revision: {
    formatos: ['image/png', 'image/jpeg', 'image/webp'],
    maxArchivos: 3,
    maxMb: 10,
    motivos: ['Necesito varios logos o ubicaciones', 'Franjas, cortes o combinaciones de color', 'Sublimado o diseño a todo color', 'Bordado con detalles especiales', 'Otro motivo'],
    // Estados de una revisión. Hoy solo se usa el primero: los demás los asignará el diseñador cuando el sistema
    // interno tenga su pantalla de revisiones (ver PARA-SISTEMA-INTERNO.md).
    estados: ['Pendiente de revisión', 'En evaluación', 'Requiere información', 'Viable', 'No viable', 'Propuesta preparada']
  }
};
