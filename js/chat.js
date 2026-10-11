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
- El polo camisero tiene editor 3D. Al pulsar «Registrar solicitud» se generan solas las imágenes 3D del polo con su logo en la zona elegida; son las que reciben ventas y la planta. Si quiere cambiar colores o mover el logo antes, puede pulsar «Ver y ajustar en 3D».
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
    const texto = f.length ? `Anotado: ${hecho}. Para terminar tu pedido me falta: ${enLista(f)}.` : `Anotado: ${hecho}. Ya tengo todo: revisa la tarjeta y pulsa «Registrar solicitud».`;
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
      ${tiene3D() ? '<span>Al registrar se generan las imágenes 3D de tu polo, con el logo en su zona: son las que reciben ventas y la planta.</span>' : ''}
      <div class="acts">${tiene3D() ? '<button type="button" class="btn btn-dark btn-sm" data-chat="registrar3d">Registrar solicitud</button><button type="button" class="btn btn-light btn-sm" data-chat="3d">Ver y ajustar en 3D</button><button type="button" class="btn btn-light btn-sm" data-chat="registrar">Registrar con dibujo simple</button>' : '<button type="button" class="btn btn-dark btn-sm" data-chat="registrar">Registrar solicitud</button>'}</div>`, 'sum');
  }

  /* ---------- Maqueta del modelo cuando no se pasa por el editor 3D ----------
     Las vistas 3D solo existen si la persona abre el editor. Para que ventas y la planta siempre reciban una imagen
     del modelo, aquí se dibuja una maqueta plana: el polo en el color pedido, con el logo en la zona elegida.
     Para las demás prendas se usa la foto del catálogo como referencia. */
  const ZONA_2D = { 'Pecho izquierdo': ['f', .635, .345, .15, .1], 'Pecho derecho': ['f', .365, .345, .15, .1], 'Centro del pecho': ['f', .5, .5, .36, .2], 'Manga': ['f', .835, .3, .1, .07], 'Espalda': ['b', .5, .42, .42, .26] };
  const hexDe = nombre => Object.keys(COLOR_NAMES).find(k => COLOR_NAMES[k].toLowerCase() === String(nombre || '').trim().toLowerCase()) || '#ffffff';
  const cargarImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src });
  function pie(g, W, H, texto) { g.fillStyle = '#0d2547'; g.fillRect(0, H - 44, W, 44); g.fillStyle = '#fff'; g.font = '600 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, W / 2, H - 22, W - 20) }
  function dibujarPolo(g, W, H, color, frente) {
    const x = v => v * W, y = v => v * H, oscuro = /^#(f|e|d|c)/i.test(color) ? 'rgba(20,30,45,.45)' : 'rgba(0,0,0,.45)';
    g.fillStyle = '#f3f4f8'; g.fillRect(0, 0, W, H); g.lineJoin = 'round'; g.lineWidth = 2.5; g.strokeStyle = oscuro; g.fillStyle = color;
    // Cuerpo y mangas.
    g.beginPath(); g.moveTo(x(.395), y(.16)); g.lineTo(x(.25), y(.195)); g.lineTo(x(.085), y(.33)); g.lineTo(x(.175), y(.415)); g.lineTo(x(.29), y(.345)); g.lineTo(x(.29), y(.88));
    g.lineTo(x(.71), y(.88)); g.lineTo(x(.71), y(.345)); g.lineTo(x(.825), y(.415)); g.lineTo(x(.915), y(.33)); g.lineTo(x(.75), y(.195)); g.lineTo(x(.605), y(.16));
    g.quadraticCurveTo(x(.5), y(frente ? .23 : .19), x(.395), y(.16)); g.closePath(); g.fill(); g.stroke();
    // Costuras de las mangas y dobladillo.
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(x(.25), y(.195)); g.lineTo(x(.29), y(.345)); g.moveTo(x(.75), y(.195)); g.lineTo(x(.71), y(.345)); g.moveTo(x(.29), y(.86)); g.lineTo(x(.71), y(.86)); g.stroke(); g.lineWidth = 2.5;
    if (frente) {
      // Cuello camisero y tapeta con 2 botones.
      for (const s of [1, -1]) { const c = v => x(.5 + s * v); g.beginPath(); g.moveTo(c(.105), y(.16)); g.lineTo(c(.012), y(.215)); g.lineTo(c(.06), y(.285)); g.lineTo(c(.135), y(.2)); g.closePath(); g.fill(); g.stroke() }
      g.beginPath(); g.rect(x(.478), y(.215), x(.044), y(.17)); g.fill(); g.stroke();
      g.fillStyle = '#fff'; for (const b of [.26, .33]) { g.beginPath(); g.arc(x(.5), y(b), 4, 0, 7); g.fill(); g.stroke() } g.fillStyle = color;
    } else { g.beginPath(); g.moveTo(x(.395), y(.16)); g.quadraticCurveTo(x(.5), y(.13), x(.605), y(.16)); g.quadraticCurveTo(x(.5), y(.2), x(.395), y(.16)); g.closePath(); g.fill(); g.stroke() }
  }
  async function ponerLogo(g, W, H, z, img) {
    const [, cx, cy, w, h] = z, bw = w * W, bh = h * H;
    if (img) { const k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k; g.drawImage(img, cx * W - iw / 2, cy * H - ih / 2, iw, ih); return }
    g.save(); g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeStyle = '#f5b301'; g.strokeRect(cx * W - bw / 2, cy * H - bh / 2, bw, bh); g.fillStyle = '#f5b301'; g.font = '700 13px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LOGO', cx * W, cy * H); g.restore();
  }
  const aBlob = c => new Promise(res => c.toBlob(res, 'image/jpeg', .9));
  // Devuelve las vistas listas para subir: [{ vista, blob, url }]. Nunca lanza: sin maqueta, el pedido igual se registra.
  async function maqueta() {
    const p = prod(draft.producto), W = 480, H = 600, out = []; if (!p) return out;
    try {
      const img = logo ? await cargarImg(URL.createObjectURL(logo)).catch(() => null) : null, z = llevaLogo() ? ZONA_2D[draft.ubicacion] : null, color = hexDe(draft.color);
      const lienzo = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c };
      const detalle = [p.nombre, draft.color || 'color por confirmar', z ? 'logo: ' + draft.ubicacion.toLowerCase() : ''].filter(Boolean).join(' · ');
      if (isPolo(p)) {
        for (const [k, vista, rot] of [['f', 'frente', 'Frente'], ['b', 'espalda', 'Espalda']]) {
          const c = lienzo(), g = c.getContext('2d'); dibujarPolo(g, W, H - 44, color, k === 'f'); if (z && z[0] === k) await ponerLogo(g, W, H - 44, z, img);
          pie(g, W, H, `Maqueta de referencia · ${rot} · ${detalle}`); out.push({ vista, blob: await aBlob(c), url: c.toDataURL('image/jpeg', .8) });
        }
      } else if ((C.catalogo[p.id] || {}).fotos) {
        const foto = await cargarImg(ASSET + C.catalogo[p.id].fotos[0]), c = lienzo(), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        const k = Math.min(W / foto.naturalWidth, (H - 44) / foto.naturalHeight), iw = foto.naturalWidth * k, ih = foto.naturalHeight * k; g.drawImage(foto, (W - iw) / 2, (H - 44 - ih) / 2, iw, ih);
        pie(g, W, H, `Foto de catálogo · ${detalle}`); out.push({ vista: 'frente', blob: await aBlob(c), url: c.toDataURL('image/jpeg', .8) });
      }
    } catch (e) { console.warn('No se pudo preparar la maqueta del modelo', e) }
    return out;
  }

  // Reporte para WhatsApp de ventas, con el mismo formato que el del formulario.
  function reporte(o) {
    const u = precio(o.item.producto);
    return ['*REPORTE DE SOLICITUD — CORPOTEX*', `Código de solicitud: ${o.id}`, `Fecha de registro: ${fmtDateTime(o.createdAt)}`, 'Canal: asistente de la página web',
      ...reportBlock('DATOS DEL CLIENTE', [['Nombre', o.cliente.nombre], ['Empresa u organización', o.cliente.empresa], ['Teléfono', o.cliente.telefono]]),
      ...reportBlock('DETALLES DEL PEDIDO', [['Tipo de prenda', o.item.nombre], ['Personalización', persLabel(o.item.personalizacion)], ['Cantidad', `${o.item.cantidad} uds. (${tallasText(o.item.tallas)})`], ['Color', o.item.color], ['Ubicación del logo', o.ubicacionLogo], ['Precio base estimado', u ? `${money(u)} / prenda` : ''], ['Precio total estimado', u ? money(u * o.item.cantidad) : ''], ['Fecha estimada de entrega', `${fmtDate(o.fechaEstimada)} (${o.diasHabiles} días hábiles), estimada por la planta; ventas confirma la fecha en firme`], ['Observaciones', o.notasCliente], ['Logo', o.intranet.disenoSubido && 'adjunto a la cotización en el sistema de Corpotex'], ['Modelo', o.intranet.vistas ? 'maqueta de referencia adjunta a la cotización' : '']]),
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
    btn.textContent = 'Enviando el modelo…';
    const vistas = await maqueta(); let subidas = 0;
    for (const v of vistas) { try { await Intranet.subirVista(res.codigo, v.blob, v.vista); subidas++ } catch (e) { console.warn('No se pudo subir la vista', v.vista, e) } }
    order.intranet.vistas = subidas;
    if (logo) { try { await Intranet.subirDiseno(res.codigo, logo, logo.name); order.intranet.disenoSubido = true; order.intranet.archivo = logo.name } catch (e) { order.intranet.disenoSubido = false; order.intranet.disenoError = e.message } }
    Store.add(order); registrado = res.codigo; busy = false; if (resumenEl) { resumenEl.remove(); resumenEl = null }
    card(`<b>Solicitud registrada</b><span class="big">${esc(res.codigo)}</span><span>Envía este código a ventas por WhatsApp. Ventas confirma el pedido y el pago; recién entonces entra a producción.</span>${order.intranet.disenoSubido === false ? '<span>Tu logo no se pudo adjuntar; envíalo por WhatsApp.</span>' : ''}${subidas ? `<div class="amaq">${vistas.map(v => `<img src="${v.url}" alt="Maqueta, ${esc(v.vista)}"/>`).join('')}</div><span>Esta maqueta ya la tienen ventas y la planta.</span>` : ''}
      <div class="acts"><a class="btn btn-dark btn-sm" target="_blank" rel="noopener" href="${esc(waLink(reporte(order)))}">Enviar por WhatsApp</a><button type="button" class="btn btn-light btn-sm" data-chat="ver" data-code="${esc(res.codigo)}">Ver mi solicitud</button><button type="button" class="btn btn-light btn-sm" data-chat="nueva">Nueva solicitud</button></div>`, 'ok');
    history.push({ role: 'user', parts: [{ text: `[Sistema] La solicitud quedó registrada con el código ${res.codigo}.` }] });
  }

  // Pasa lo conversado al formulario y deja el editor 3D con el color, el logo y la zona elegidos (flujo A).
  // Al registrar desde ahí, la web sube las vistas del modelo: son las imágenes que ven ventas y cada área.
  async function preparar3D() {
    const p = productById(draft.producto); if (!p) { toast('Esa prenda no está en el formulario de la web.'); return null }
    await resetNewQuote();
    quote = { ...blankQuote(), qid: draft.qid, origen: 'chatbot', producto: p.id, personalizacion: draft.personalizacion || p.personalizacion_por_defecto, cantidad: draft.cantidad || p.minimo, tallas: { ...draft.tallas }, color: draft.color, cliente: { nombre: draft.nombre, empresa: draft.empresa, telefono: draft.telefono, correo: '' }, notas: ['Solicitud iniciada con el asistente.', draft.ubicacion && `Logo en: ${draft.ubicacion}.`, draft.notas].filter(Boolean).join(' ') };
    quoteStarted = true;
    if (est) estimate = { state: 'ok', key: estKey(), data: est, error: '', at: Date.now() };
    const hex = hexDe(draft.color);
    try { await Designer.useContext('pedido', { colores: { tejido: hex, cuello: hex, botones: hex }, posKey: POS_3D[draft.ubicacion] || 'pecho', estampado: { logoNombre: logo ? logo.name : '' } }, logo) } catch (e) { console.warn('No se pudo preparar el editor 3D', e) }
    return p;
  }
  async function abrir3D() {
    const p = await preparar3D(); if (!p) return;
    toggleAssistant(false);
    // Si falta algún dato del pedido, la propia página lleva al paso donde se completa.
    nav(p.editor3d ? 'cotizar/diseno/3d/colores' : 'cotizar/pedido');
    if (logo || draft.ubicacion) toast(`Tu polo se abre con ${logo ? 'tu logo' : 'la zona elegida'}${draft.ubicacion ? ' en ' + draft.ubicacion.toLowerCase() : ''}. Al terminar, pulsa «Registrar solicitud».`);
  }
  const hasta = async (listo, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (listo()) return true; await new Promise(res => setTimeout(res, 700)) } return false };
  // Registra con las imágenes 3D reales sin que la persona recorra el editor: lo abre en la vista previa, espera a
  // que el visor genere las vistas, acepta el diseño y registra. Es el mismo camino del formulario, hecho solo.
  async function registrar3D(btn) {
    if (busy || registrado || faltantes().length) return;
    busy = true; btn.disabled = true; btn.textContent = 'Preparando tu polo…';
    const soltar = aviso => { busy = false; if (aviso) toast(aviso) };
    const p = await preparar3D(); if (!p) { btn.disabled = false; btn.textContent = 'Registrar solicitud'; return soltar() }
    toggleAssistant(false); nav('cotizar/diseno/3d/vista-previa');
    if (currentRoute.view !== 'editor') return soltar('Falta completar un dato del pedido. Revísalo aquí y pulsa «Continuar».');
    toast('Estoy generando las imágenes de tu polo en 3D. Mantén esta pestaña a la vista; tarda unos segundos.');
    if (!(await hasta(() => currentRoute.view !== 'editor' || Designer.viewsReady(), 150000)) || currentRoute.view !== 'editor') return soltar('No pude generar las imágenes solo. Pulsa «Usar este diseño» y después «Registrar solicitud».');
    $('d3Next').click();
    // Al entrar al resumen la página vuelve a pedir la fecha a la planta. Hay que esperar esa respuesta: si se
    // registra mientras está «consultando», la validación falla y la página regresa al primer paso.
    if (!(await hasta(() => currentRoute.view === 'cotizar' && currentRoute.step === 2 && designReady() && estimate.state === 'ok', 45000))) return soltar('Tu diseño está listo. Pulsa «Registrar solicitud» en esta página.');
    await new Promise(res => setTimeout(res, 400));
    await saveQuote(); busy = false;
    if (!savedId) return toast('No se pudo registrar solo. Revisa los datos y pulsa «Registrar solicitud» en esta página.');
    registrado = savedId; if (resumenEl) { resumenEl.remove(); resumenEl = null }
    // WhatsApp no se puede abrir solo: el navegador solo lo permite tras un toque directo. Se deja el botón a la mano.
    const o = Store.find(savedId), wa = o ? waLink(orderReport(o)) : '';
    card(`<b>Solicitud registrada</b><span class="big">${esc(savedId)}</span><span>Se registró con las imágenes 3D de tu polo. Falta un paso: envía el reporte a ventas por WhatsApp.</span><div class="acts">${wa ? `<a class="btn btn-dark btn-sm" target="_blank" rel="noopener" href="${esc(wa)}">Enviar por WhatsApp</a>` : ''}<button type="button" class="btn btn-light btn-sm" data-chat="ver" data-code="${esc(savedId)}">Ver mi solicitud</button><button type="button" class="btn btn-light btn-sm" data-chat="nueva">Nueva solicitud</button></div>`, 'ok');
    toggleAssistant(true);
    history.push({ role: 'user', parts: [{ text: `[Sistema] La solicitud quedó registrada con el código ${savedId}.` }] });
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
      if (a === 'ejemplo') enviar(EJEMPLO); else if (a === 'registrar') registrar(b); else if (a === 'registrar3d') registrar3D(b); else if (a === 'zona') elegirZona(b.dataset.zona); else if (a === 'tecnica') elegirTecnica(b.dataset.pers); else if (a === '3d') abrir3D();
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
