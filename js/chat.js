'use strict';
/* ===== Corpotex · asistente con inteligencia artificial (flujo B) =====
   Hace por conversación los mismos pasos que el formulario (flujo A): arma la solicitud, pide la fecha al sistema
   interno, la registra como cotización y entrega el código para enviarlo por WhatsApp. Reglas que no se rompen:
   - La fecha siempre sale de /api/estimar (la carga real de la planta). El modelo nunca la inventa.
   - Los precios salen de config.js, que es la lista oficial.
   - El modelo no registra nada: la solicitud se registra solo cuando la persona pulsa el botón.
   Usa las funciones y el estado de app.js (se carga después de ese archivo). */
const Chat = (() => {
  const KEY = C.geminiKey, MODEL = C.geminiModelo || 'gemini-3.5-flash-lite';
  const EJEMPLO = 'Necesito 300 polos camiseros bordados para mi empresa';
  // Zonas donde puede ir el logo: las mismas que ofrece el editor 3D.
  const ZONAS = ['Pecho izquierdo', 'Pecho derecho', 'Centro del pecho', 'Manga', 'Espalda'];
  const POS_3D = { 'Pecho izquierdo': 'pecho', 'Pecho derecho': 'derecho', 'Centro del pecho': 'centro', 'Manga': 'mangaIzq', 'Espalda': 'espalda' };
  const tiene3D = () => !!(C.catalogo[draft.producto] || {}).editor3d;
  const llevaLogo = () => ['bordado', 'dtf', 'bordado_dtf'].includes(draft.personalizacion);
  const blank = () => ({ qid: 'chat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), producto: null, cantidad: null, personalizacion: null, tallas: {}, color: '', ubicacion: '', nombre: '', empresa: '', telefono: '', notas: '' });
  let productos = [], draft = blank(), history = [], busy = false, est = null, estFor = '', registrado = null, logo = null, resumenEl = null, zonaEl = null, tecnicaEl = null;

  const box = () => $('assistantMessages');
  const prod = id => productos.find(p => p.id === id) || null;
  const precio = id => Number((C.catalogo[id] || {}).precioReferencia) || 0;
  const scroll = () => { box().scrollTop = 1e6 };
  function card(html, cls = '') { const d = document.createElement('div'); d.className = 'amsg acard ' + cls; d.innerHTML = html; box().appendChild(d); scroll(); return d }

  /* ---------- Lo que el modelo sabe: catálogo y reglas del sistema interno ---------- */
  function prompt() {
    const lista = productos.map(p => `- ${p.id} | ${p.nombre} | línea ${C.lineas[p.linea] || p.linea} | mínimo ${p.minimo} | personalizaciones: ${p.personalizaciones.join(', ')} (por defecto ${p.personalizacion_por_defecto}) | ${precio(p.id) ? 'precio de referencia S/ ' + precio(p.id) + ' por prenda' : 'precio: lo confirma ventas'}${(C.catalogo[p.id] || {}).editor3d ? ' | tiene editor 3D' : ''}`).join('\n');
    const falta = faltantes();
    return `Eres el asistente de ventas de Corpotex, empresa de Piura (Perú) que confecciona uniformes y prendas personalizadas. Atiendes por chat a clientes que quieren cotizar. Responde en español, con frases cortas y claras, como en WhatsApp. Pide uno o dos datos por mensaje, nunca todos juntos.

CÓMO FUNCIONA CORPOTEX
- El cliente arma su solicitud contigo. El sistema calcula la fecha de entrega según la carga real de la planta. El cliente la registra con el botón «Registrar solicitud», recibe un código (COT-1234) y lo envía por WhatsApp a ventas.
- Ventas revisa, cobra y confirma el pedido. Recién entonces entra a producción. Tú no registras ni confirmas pedidos.
- La planta trabaja de lunes a sábado, de 8:00 a 16:00. Áreas: Almacén → Corte → Confección → Bordado o DTF → Acabados. En sublimado la tela se estampa antes del corte: Almacén → Sublimado → Corte → Confección → Acabados.
- El avance va por bloques de prendas. Confección es el área más lenta: es la que define el plazo.

REGLAS QUE NO PUEDES ROMPER
- Nunca inventes ni acortes una fecha de entrega. La única fecha válida es la de «ESTADO ACTUAL». Si aún no hay, di que la calcularás cuando tengas prenda, cantidad y personalización.
- Si el cliente presiona por una fecha más corta, explica con amabilidad que esa es la fecha que la planta puede cumplir hoy con su carga real, y que prometer menos sería incumplir. Puede pedir a ventas por WhatsApp que evalúe un pedido urgente; lo decide el jefe de producción porque puede retrasar a otros clientes.
- Nunca inventes precios. Usa solo el precio de referencia de la lista. Es una estimación: ventas confirma el importe. Si la prenda no tiene precio en la lista, di que ventas lo confirmará.
- Solo ofrece prendas de la lista. Si piden algo que no está (por ejemplo uniformes escolares o ropa deportiva), dilo y ofrece lo más parecido o pasar con ventas.
- No prometas stock, descuentos ni condiciones de pago.

CAMBIOS DESPUÉS DE REGISTRAR
- Cambio sencillo (texto o tipografía del logo, pequeño ajuste de color o ubicación): sin costo mientras el pedido no haya llegado a Bordado, DTF o Sublimado.
- Cambio detallado (por ejemplo, pasar de cuello redondo a cuello en V, cambiar el modelo o la tela): tiene un cobro adicional y solo se puede mientras el pedido sigue en Almacén. Desde que entra a Corte ya no es posible.
- Los cambios se piden en «Mis solicitudes».

DATOS QUE NECESITAS
1. Prenda (usa el id de la lista). 2. Cantidad (respeta el mínimo). 3. Personalización (una de las permitidas para esa prenda). 4. Tallas: ${C.tallas.join(', ')}; deben sumar exactamente la cantidad. Si el cliente no sabe, propón una distribución razonable y pídele que la confirme. 5. Nombre de contacto y teléfono. Empresa y color son opcionales.
- El polo camisero tiene editor 3D. Cuando ya tengas sus datos, invítalo a pulsar «Ver mi polo en 3D»: verá el polo con su logo en la zona elegida y podrá cambiar colores. Las imágenes de ese modelo son las que reciben ventas y la planta.
- Si la prenda lleva bordado o DTF, pídele que adjunte su logo con el botón «+» y pregúntale en qué zona lo quiere. Ofrece estas opciones: ${ZONAS.join(', ')}. Guarda la elegida en «ubicacion». También puede tocar una de las opciones que aparecen en pantalla.
- Cuando no falte nada, resume y dile que revise la tarjeta y pulse «Registrar solicitud».

LISTA DE PRENDAS (id | nombre | línea | mínimo | personalizaciones | precio)
${lista}

ESTADO ACTUAL DE LA SOLICITUD
${JSON.stringify({ ...draft, qid: undefined })}
Entrega estimada por la planta: ${est ? `${est.fecha_estimada} (${est.dias_habiles} días hábiles)` : 'todavía no calculada'}
Falta: ${falta.length ? falta.join(', ') : 'nada; ya puede registrar'}
${registrado ? `La solicitud YA está registrada con el código ${registrado}. No vuelvas a pedir datos; solo ayuda con dudas.` : ''}

RESPUESTA
Devuelve un JSON. «respuesta» es lo que lee el cliente. En los demás campos escribe SIEMPRE todos los datos de la solicitud que ya conozcas (los del ESTADO ACTUAL más los que el cliente acaba de dar o cambiar): producto con su id de la lista, cantidad, personalizacion, tallas, color, nombre, empresa, telefono. Si el cliente nombra una prenda, pon su id en «producto» aunque falten otros datos. Deja fuera solo lo que todavía no se sabe.`;
  }
  const SCHEMA = () => ({
    // Primero los datos y al final la respuesta: así el modelo extrae antes de redactar.
    type: 'OBJECT', required: ['producto', 'cantidad', 'personalizacion', 'respuesta'],
    propertyOrdering: ['producto', 'cantidad', 'personalizacion', 'tallas', 'color', 'ubicacion', 'nombre', 'empresa', 'telefono', 'notas', 'respuesta'],
    properties: {
      respuesta: { type: 'STRING' },
      producto: { type: 'STRING', enum: productos.map(p => p.id), nullable: true },
      cantidad: { type: 'INTEGER', nullable: true },
      personalizacion: { type: 'STRING', enum: Object.keys(C.personalizaciones), nullable: true },
      tallas: { type: 'OBJECT', nullable: true, properties: Object.fromEntries(C.tallas.map(t => [t, { type: 'INTEGER', nullable: true }])) },
      ubicacion: { type: 'STRING', enum: ZONAS, nullable: true },
      color: { type: 'STRING', nullable: true }, nombre: { type: 'STRING', nullable: true }, empresa: { type: 'STRING', nullable: true },
      telefono: { type: 'STRING', nullable: true }, notas: { type: 'STRING', nullable: true }
    }
  });

  async function gemini() {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, signal: ctrl.signal,
        body: JSON.stringify({ systemInstruction: { parts: [{ text: prompt() }] }, contents: history.slice(-24), generationConfig: { maxOutputTokens: 2048, temperature: 0.2, thinkingConfig: { thinkingLevel: 'minimal' }, responseMimeType: 'application/json', responseSchema: SCHEMA() } })
      });
      const d = await r.json(); if (!r.ok) throw Error((d.error && d.error.message) || `Error ${r.status}`);
      const text = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map(p => p.text || '').join('');
      const out = JSON.parse(text); if (!out || typeof out.respuesta !== 'string') throw Error('Respuesta vacía');
      return { out, text };
    } finally { clearTimeout(t) }
  }

  /* ---------- Solicitud ---------- */
  function merge(o) {
    if (o.producto && prod(o.producto) && o.producto !== draft.producto) { draft.producto = o.producto; if (!prod(o.producto).personalizaciones.includes(draft.personalizacion)) draft.personalizacion = null }
    if (Number.isInteger(o.cantidad) && o.cantidad > 0 && o.cantidad <= 100000) draft.cantidad = o.cantidad;
    const p = prod(draft.producto);
    if (o.personalizacion && (!p || p.personalizaciones.includes(o.personalizacion))) draft.personalizacion = o.personalizacion;
    if (o.tallas && typeof o.tallas === 'object') { const t = {}; for (const k of C.tallas) { const n = Number(o.tallas[k]); if (Number.isInteger(n) && n > 0) t[k] = n } if (Object.keys(t).length) draft.tallas = t }
    if (ZONAS.includes(o.ubicacion)) draft.ubicacion = o.ubicacion;
    for (const k of ['color', 'nombre', 'empresa', 'notas']) if (typeof o[k] === 'string' && o[k].trim()) draft[k] = o[k].trim().slice(0, 200);
    if (typeof o.telefono === 'string' && o.telefono.replace(/\D/g, '').length >= 6) draft.telefono = o.telefono.trim().slice(0, 30);
  }
  // Red de seguridad: lo que se puede leer directo del mensaje no depende de que el modelo lo extraiga bien.
  function leer(t) {
    const o = {}, tallas = {};
    for (const m of t.matchAll(/(\d{1,5})\s*(?:de\s+)?(?:talla\s+)?(XXL|XL|XS|S|M|L)(?![a-z])/gi)) tallas[m[2].toUpperCase()] = Number(m[1]);
    if (Object.keys(tallas).length) o.tallas = tallas;
    const c = t.match(/(\d{1,6})\s+(?!talla)[a-záéíóúñ]{4,}/i); if (c && !draft.cantidad) o.cantidad = Number(c[1]);
    const z = ZONAS.find(x => t.toLowerCase().includes(x.toLowerCase())); if (z) o.ubicacion = z;
    if (/bordad/i.test(t) && /dtf|estampad/i.test(t)) o.personalizacion = 'bordado_dtf'; else if (/bordad/i.test(t)) o.personalizacion = 'bordado'; else if (/sublim/i.test(t)) o.personalizacion = 'sublimado'; else if (/dtf|estampad/i.test(t)) o.personalizacion = 'dtf'; else if (/sin (logo|personaliz|estampad|bordad)/i.test(t)) o.personalizacion = 'ninguna';
    const tel = t.match(/(?:\+?51\s*)?(9\d{2}[\s-]?\d{3}[\s-]?\d{3})/); if (tel) o.telefono = tel[1].replace(/[\s-]/g, '');
    return o;
  }
  function faltantes() {
    const p = prod(draft.producto), f = [];
    if (!p) f.push('prenda');
    if (!draft.cantidad) f.push('cantidad'); else if (p && draft.cantidad < p.minimo) f.push(`cantidad (el mínimo de ${p.nombre} es ${p.minimo})`);
    if (!draft.personalizacion) f.push('personalización');
    if (draft.cantidad && sumTallas(draft.tallas) !== draft.cantidad) f.push(`tallas (suman ${sumTallas(draft.tallas)} y deben sumar ${draft.cantidad})`);
    if (llevaLogo() && !draft.ubicacion) f.push('zona del logo');
    if (!draft.nombre) f.push('nombre de contacto'); if (!draft.telefono) f.push('teléfono');
    return f;
  }
  const estimable = () => { const p = prod(draft.producto); return !!(p && draft.cantidad >= p.minimo && draft.personalizacion) };
  const itemEst = () => [{ producto: draft.producto, cantidad: draft.cantidad, personalizacion: draft.personalizacion }];

  // La fecha se pide al sistema interno cada vez que cambian prenda, cantidad o personalización.
  async function refreshEstimate() {
    if (!estimable()) { est = null; estFor = ''; return }
    const key = JSON.stringify(itemEst()); if (key === estFor && est) return;
    try {
      est = await Intranet.estimar(itemEst()); estFor = key;
      const p = prod(draft.producto), u = precio(p.id);
      card(`<b>Entrega estimada por la planta</b><span class="big">${esc(fmtDate(est.fecha_estimada, true))}</span><span>${est.dias_habiles} días hábiles, según la carga real de hoy. Ventas confirma la fecha en firme.</span>${u ? `<span>Precio estimado: <b>${money(u * draft.cantidad)}</b> (${money(u)} por prenda)</span>` : '<span>Precio: lo confirma ventas.</span>'}`, 'est');
    } catch (e) { est = null; estFor = ''; card(`<b>No pude consultar la planta</b><span>${esc(e.message)} No te doy una fecha sin verificarla.</span>`, 'err') }
  }
  // Opciones para elegir dónde va el logo. Se muestran cuando la prenda lo lleva y falta elegir, y siempre que se
  // adjunta un logo (aunque ya hubiera una zona: con un logo nuevo se vuelve a preguntar).
  function zonas(siempre) {
    if (zonaEl) { zonaEl.remove(); zonaEl = null }
    if (registrado || !(siempre || (prod(draft.producto) && llevaLogo() && !draft.ubicacion))) return;
    zonaEl = card(`<b>¿En qué zona quieres el logo?</b><div class="acts">${ZONAS.map(z => `<button type="button" class="btn ${draft.ubicacion === z ? 'btn-dark' : 'btn-light'} btn-sm" data-chat="zona" data-zona="${esc(z)}">${esc(z)}</button>`).join('')}</div><span>${logo ? `Logo adjunto: ${esc(logo.name)}` : 'Adjunta tu logo con el botón «+».'}</span>`);
  }
  // Con qué técnica se aplica el logo: se pregunta si hay logo y la prenda todavía no tiene una personalización que lo lleve.
  function tecnicas() {
    if (tecnicaEl) { tecnicaEl.remove(); tecnicaEl = null }
    const p = prod(draft.producto); if (registrado || !p || !logo || llevaLogo()) return;
    const ops = p.personalizaciones.filter(x => ['bordado', 'dtf', 'bordado_dtf'].includes(x)); if (!ops.length) return;
    tecnicaEl = card(`<b>¿Cómo quieres aplicar el logo?</b><div class="acts">${ops.map(x => `<button type="button" class="btn btn-light btn-sm" data-chat="tecnica" data-pers="${x}">${esc(persLabel(x))}</button>`).join('')}</div>`);
  }
  const enLista = l => l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0];
  // Después de tocar una opción, el asistente dice de inmediato qué falta para terminar el pedido.
  function decirFalta(hecho) {
    const f = faltantes();
    const texto = f.length ? `Anotado: ${hecho}. Para terminar tu pedido me falta: ${enLista(f)}.` : `Anotado: ${hecho}. Ya tengo todo: revisa la tarjeta y ${tiene3D() ? 'pulsa «Ver mi polo en 3D» o «Registrar sin 3D»' : 'pulsa «Registrar solicitud»'}.`;
    addMsg(texto); history.push({ role: 'model', parts: [{ text: JSON.stringify({ respuesta: texto }) }] });
  }
  async function elegirZona(z) {
    draft.ubicacion = z; addMsg(z, true); history.push({ role: 'user', parts: [{ text: `Quiero el logo en: ${z}.` }] });
    zonas(); tecnicas(); resumen(); decirFalta(`logo en ${z.toLowerCase()}`);
  }
  async function elegirTecnica(x) {
    draft.personalizacion = x; addMsg(persLabel(x), true); history.push({ role: 'user', parts: [{ text: `Personalización: ${persLabel(x)}.` }] });
    tecnicas(); await refreshEstimate(); zonas(); resumen(); decirFalta(persLabel(x).toLowerCase());
  }
  function resumen() {
    if (resumenEl) { resumenEl.remove(); resumenEl = null }
    if (registrado) return;
    const p = prod(draft.producto), ok = !faltantes().length && est;
    if (p && (C.catalogo[p.id] || {}).editor3d && !ok) { resumenEl = card(`<span>El ${esc(p.nombre.toLowerCase())} se puede diseñar en 3D con tus colores y tu logo.</span><div class="acts"><button type="button" class="btn btn-light btn-sm" data-chat="3d">Ver mi polo en 3D</button></div>`); return }
    if (!ok) return;
    const u = precio(p.id);
    resumenEl = card(`<b>Revisa tu solicitud</b>
      <span>${draft.cantidad} × ${esc(p.nombre)} · ${esc(persLabel(draft.personalizacion))}</span>
      <span>Tallas: ${esc(tallasText(draft.tallas))}</span>${draft.color ? `<span>Color: ${esc(draft.color)}</span>` : ''}
      <span>Contacto: ${esc(draft.nombre)}${draft.empresa ? ' · ' + esc(draft.empresa) : ''} · ${esc(draft.telefono)}</span>
      <span>Entrega estimada: <b>${esc(fmtDate(est.fecha_estimada))}</b>${u ? ` · Total estimado: <b>${money(u * draft.cantidad)}</b>` : ''}</span>
      ${draft.ubicacion ? `<span>Logo en: ${esc(draft.ubicacion)}${logo ? ` · ${esc(logo.name)}` : ' · sin archivo adjunto'}</span>` : logo ? `<span>Logo adjunto: ${esc(logo.name)}</span>` : ''}
      ${tiene3D() ? '<span>Mira tu polo en 3D con el logo en su zona: esas imágenes son las que reciben ventas y la planta.</span>' : ''}
      <div class="acts">${tiene3D() ? '<button type="button" class="btn btn-dark btn-sm" data-chat="3d">Ver mi polo en 3D</button><button type="button" class="btn btn-light btn-sm" data-chat="registrar">Registrar sin 3D</button>' : '<button type="button" class="btn btn-dark btn-sm" data-chat="registrar">Registrar solicitud</button>'}</div>`, 'sum');
  }

  // Reporte para WhatsApp de ventas, con el mismo formato que el del formulario.
  function reporte(o) {
    const u = precio(o.item.producto);
    return ['*REPORTE DE SOLICITUD — CORPOTEX*', `Código de solicitud: ${o.id}`, `Fecha de registro: ${fmtDateTime(o.createdAt)}`, 'Canal: asistente de la página web',
      ...reportBlock('DATOS DEL CLIENTE', [['Nombre', o.cliente.nombre], ['Empresa u organización', o.cliente.empresa], ['Teléfono', o.cliente.telefono]]),
      ...reportBlock('DETALLES DEL PEDIDO', [['Tipo de prenda', o.item.nombre], ['Personalización', persLabel(o.item.personalizacion)], ['Cantidad', `${o.item.cantidad} uds. (${tallasText(o.item.tallas)})`], ['Color', o.item.color], ['Ubicación del logo', o.ubicacionLogo], ['Precio base estimado', u ? `${money(u)} / prenda` : ''], ['Precio total estimado', u ? money(u * o.item.cantidad) : ''], ['Fecha estimada de entrega', `${fmtDate(o.fechaEstimada)} (${o.diasHabiles} días hábiles), estimada por la planta; ventas confirma la fecha en firme`], ['Observaciones', o.notasCliente], ['Logo', o.intranet.disenoSubido && 'adjunto a la cotización en el sistema de Corpotex']]),
      '', '*ESTADO*', '• Solicitud registrada correctamente en el sistema de Corpotex.', `• Estado actual: ${ORDER_STATE_TXT}`].join('\n');
  }

  async function registrar(btn) {
    if (busy || registrado || faltantes().length) return;
    const rotulo = btn.textContent; busy = true; btn.disabled = true; btn.textContent = 'Verificando la fecha…';
    const fail = m => { busy = false; btn.disabled = false; btn.textContent = rotulo; card(`<b>No se registró</b><span>${esc(m)}</span>`, 'err') };
    try { est = await Intranet.estimar(itemEst()); estFor = JSON.stringify(itemEst()) } catch (e) { return fail('No pude verificar la fecha con la planta. ' + e.message) }
    const p = prod(draft.producto), u = precio(p.id), cliente = { nombre: draft.nombre, telefono: draft.telefono }; if (draft.empresa) cliente.empresa = draft.empresa;
    const item = { producto: p.id, cantidad: draft.cantidad, personalizacion: draft.personalizacion, tallas: { ...draft.tallas }, notas: ['Solicitud hecha con el asistente de la web.', draft.ubicacion && `Logo en: ${draft.ubicacion}.`, draft.notas].filter(Boolean).join(' ') }; if (draft.color) item.color = draft.color;
    const payload = { cliente, items: [item], fecha_estimada: est.fecha_estimada, origen: 'chatbot', marca: 'CORPOTEX', clave_idempotencia: draft.qid }; if (u) payload.precio_total = Math.round(u * draft.cantidad * 100) / 100;
    let res;
    try { btn.textContent = 'Registrando…'; res = await Intranet.crearCotizacion(payload) } catch (e) { return fail(e.message) }
    if (!res || !res.codigo) return fail('El sistema de Corpotex no devolvió un código.');
    const now = new Date().toISOString();
    const order = { id: res.codigo, v: 3, createdAt: now, estado: 'registrada', canal: 'chatbot', intranet: { codigo: res.codigo, clave: res.clave || null, disenoSubido: null }, cliente: { nombre: draft.nombre, empresa: draft.empresa, telefono: draft.telefono, correo: '' }, item: { producto: p.id, nombre: p.nombre, cantidad: draft.cantidad, personalizacion: draft.personalizacion, tallas: { ...draft.tallas }, color: draft.color }, estilo: null, fechaDeseada: '', fechaEstimada: est.fecha_estimada, diasHabiles: est.dias_habiles, notasCliente: draft.notas, ubicacionLogo: draft.ubicacion, no3D: false, design: null, revision: null, modificaciones: [] };
    if (logo) { try { await Intranet.subirDiseno(res.codigo, logo, logo.name); order.intranet.disenoSubido = true; order.intranet.archivo = logo.name } catch (e) { order.intranet.disenoSubido = false; order.intranet.disenoError = e.message } }
    Store.add(order); registrado = res.codigo; busy = false; if (resumenEl) { resumenEl.remove(); resumenEl = null }
    card(`<b>Solicitud registrada</b><span class="big">${esc(res.codigo)}</span><span>Envía este código a ventas por WhatsApp. Ventas confirma el pedido y el pago; recién entonces entra a producción.</span>${order.intranet.disenoSubido === false ? '<span>Tu logo no se pudo adjuntar; envíalo por WhatsApp.</span>' : ''}
      <div class="acts"><a class="btn btn-dark btn-sm" target="_blank" rel="noopener" href="${esc(waLink(reporte(order)))}">Enviar por WhatsApp</a><button type="button" class="btn btn-light btn-sm" data-chat="ver" data-code="${esc(res.codigo)}">Ver mi solicitud</button><button type="button" class="btn btn-light btn-sm" data-chat="nueva">Nueva solicitud</button></div>`, 'ok');
    history.push({ role: 'user', parts: [{ text: `[Sistema] La solicitud quedó registrada con el código ${res.codigo}.` }] });
  }

  // Pasa lo conversado al formulario y abre el editor 3D con el logo ya puesto en la zona elegida (flujo A).
  // Al registrar desde ahí, la web sube las vistas del modelo: son las imágenes que ven ventas y cada área.
  async function abrir3D() {
    const p = productById(draft.producto); if (!p) return toast('Esa prenda no está en el formulario de la web.');
    await resetNewQuote();
    quote = { ...blankQuote(), qid: draft.qid, origen: 'chatbot', producto: p.id, personalizacion: draft.personalizacion || p.personalizacion_por_defecto, cantidad: draft.cantidad || p.minimo, tallas: { ...draft.tallas }, color: draft.color, cliente: { nombre: draft.nombre, empresa: draft.empresa, telefono: draft.telefono, correo: '' }, notas: ['Solicitud iniciada con el asistente.', draft.notas].filter(Boolean).join(' ') };
    quoteStarted = true;
    if (est) estimate = { state: 'ok', key: estKey(), data: est, error: '', at: Date.now() };
    const hex = Object.keys(COLOR_NAMES).find(k => COLOR_NAMES[k].toLowerCase() === draft.color.toLowerCase()) || '#ffffff';
    try { await Designer.useContext('pedido', { colores: { tejido: hex, cuello: hex, botones: hex }, posKey: POS_3D[draft.ubicacion] || 'pecho', estampado: { logoNombre: logo ? logo.name : '' } }, logo) } catch (e) { console.warn('No se pudo preparar el editor 3D', e) }
    toggleAssistant(false);
    // Si falta algún dato del pedido, la propia página lleva al paso donde se completa.
    nav(p.editor3d ? 'cotizar/diseno/3d/colores' : 'cotizar/pedido');
    if (logo || draft.ubicacion) toast(`Tu polo se abre con ${logo ? 'tu logo' : 'la zona elegida'}${draft.ubicacion ? ' en ' + draft.ubicacion.toLowerCase() : ''}. Al terminar, pulsa «Registrar solicitud».`);
  }

  async function enviar(texto) {
    if (busy) return; const t = texto.trim(); if (!t) return;
    addMsg(t, true);
    if (!KEY || !productos.length) { setTimeout(() => addMsg(answer(t)), 250); return }
    busy = true; history.push({ role: 'user', parts: [{ text: t }] });
    const directo = registrado ? {} : leer(t); merge(directo);
    const espera = document.createElement('div'); espera.className = 'amsg typing'; espera.textContent = 'Escribiendo…'; box().appendChild(espera); scroll();
    try {
      const { out, text } = await gemini(); espera.remove();
      history.push({ role: 'model', parts: [{ text }] });
      // Lo leído directo del mensaje manda sobre lo que interprete el modelo.
      // El modelo a veces inventa tallas sueltas: solo se aceptan las suyas si forman un reparto completo.
      if (out.tallas && !directo.tallas && sumTallas(out.tallas) !== (Number.isInteger(out.cantidad) ? out.cantidad : draft.cantidad)) delete out.tallas;
      if (!registrado) { merge(out); merge(directo) }
      addMsg(out.respuesta);
      if (!registrado) { await refreshEstimate(); zonas(); tecnicas(); resumen() }
    } catch (e) {
      espera.remove(); history.pop();
      addMsg(`No pude responder con el asistente (${e.name === 'AbortError' ? 'tardó demasiado' : e.message}). ${answer(t)}`);
    } finally { busy = false }
  }

  function nueva() { draft = blank(); history = []; est = null; estFor = ''; registrado = null; logo = null; resumenEl = null; zonaEl = null; tecnicaEl = null; box().innerHTML = ''; saludo() }
  function saludo() {
    const b = document.createElement('div'); b.className = 'amvp';
    b.innerHTML = `<b>MODO MVP</b> Pruébalo con: <button type="button" data-chat="ejemplo">«${esc(EJEMPLO)}»</button><span>El diseño 3D solo está en el polo camisero.</span>`;
    box().appendChild(b);
    addMsg(KEY ? '¡Hola! Soy el asistente de Corpotex. Cuéntame qué prenda necesitas y cuántas; te digo la fecha real de entrega según la carga de la planta.' : '¡Hola! Cuéntame qué prenda necesitas, cuántas unidades y para qué tipo de cliente.');
  }

  async function init() {
    const f = $('assistantForm'), input = $('assistantInput');
    // Botón para adjuntar el logo.
    const lab = document.createElement('label'); lab.className = 'aattach'; lab.title = 'Adjuntar logo'; lab.innerHTML = '+<input type="file" accept="image/png,image/jpeg,image/webp" hidden/>';
    f.insertBefore(lab, input);
    lab.querySelector('input').onchange = e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      if (!C.revision.formatos.includes(file.type)) return toast('El logo debe ser PNG, JPG o WEBP.');
      if (file.size > C.revision.maxMb * 1024 * 1024) return toast(`El logo no puede pesar más de ${C.revision.maxMb} MB.`);
      logo = file; card(`<span>Logo adjunto: <b>${esc(file.name)}</b>. Se enviará a Corpotex al registrar la solicitud.</span>`);
      // Con un logo nuevo se vuelve a preguntar dónde va y, si hace falta, cómo se aplica.
      if (!registrado) { draft.ubicacion = ''; zonas(true); tecnicas(); resumen() }
    };
    f.onsubmit = e => { e.preventDefault(); const t = input.value; input.value = ''; enviar(t) };
    box().addEventListener('click', e => {
      const b = e.target.closest('[data-chat]'); if (!b) return; const a = b.dataset.chat;
      if (a === 'ejemplo') enviar(EJEMPLO); else if (a === 'registrar') registrar(b); else if (a === 'zona') elegirZona(b.dataset.zona); else if (a === 'tecnica') elegirTecnica(b.dataset.pers); else if (a === '3d') abrir3D();
      else if (a === 'ver') { toggleAssistant(false); nav('solicitudes/' + b.dataset.code) } else if (a === 'nueva') nueva();
    });
    box().innerHTML = ''; saludo();
    // El asistente conoce todas las prendas del sistema interno, no solo las que tienen foto en la web.
    try { productos = (await Intranet.productos()).list } catch (e) { productos = [] }
  }
  // app.js enlaza sus eventos en DOMContentLoaded; este archivo se carga después, así que su init corre al final.
  document.addEventListener('DOMContentLoaded', init);
  return { enviar, nueva, leer, estado: () => ({ ...draft, estimacion: est && est.fecha_estimada, registrado }) };
})();
