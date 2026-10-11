'use strict';
/* ===== Corpotex · aplicación principal ===== */
const C = window.CORPOTEX_CONFIG, ASSET = 'assets/', DRAFT = 'corpoflow_draft_v3'; // clave histórica del borrador
const $ = id => document.getElementById(id), QA = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STYLES = [{ name: 'Clásico', desc: 'Sobrio y corporativo', img: 'estilo_clasico.png', icon: '▣' }, { name: 'Dinámico', desc: 'Franjas y contraste', img: 'estilo_dinamico.png', icon: '◩' }, { name: 'Minimalista', desc: 'Líneas limpias', img: 'estilo_minimalista.png', icon: '□' }];
const DATE_MSG = 'La fecha seleccionada es anterior al plazo mínimo estimado de entrega. Selecciona una fecha igual o posterior a la fecha disponible.';
const COLOR_NAMES = { '#ffffff': 'Blanco', '#1e2225': 'Negro', '#243c5c': 'Azul marino', '#2f55b8': 'Azul rey', '#8fb8de': 'Celeste', '#aa3232': 'Rojo', '#6d1f2f': 'Vino', '#426044': 'Verde', '#e9c367': 'Amarillo', '#e0702c': 'Naranja', '#b5b6b7': 'Gris', '#d6c8b3': 'Beige' };
const colorName = c => COLOR_NAMES[String(c).toLowerCase()] ? `${COLOR_NAMES[String(c).toLowerCase()]} (${c})` : String(c);
const persLabel = k => C.personalizaciones[k] || k;

/* ---------- Estado ---------- */
// qid identifica cada solicitud en el historial del navegador (ver popstate).
const blankQuote = () => ({ qid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), producto: null, personalizacion: null, cantidad: null, tallas: {}, color: '', cliente: { nombre: '', empresa: '', telefono: '', correo: '' }, fechaDeseada: '', notas: '', estilo: 0, threeD: null, no3D: false, revision: null });
let quote = blankQuote(), catalog = [], catalogState = 'loading', catalogError = '', lineFilter = 'todos', flowLine = 'todos';
let savedId = null, saving = false, quoteStarted = false, lastView = '', designLogo = null, reviewFiles = [], estimate = { state: 'idle', key: '', data: null, error: '' }, estT = 0;
let modSession = null; const modLoaded = new Set();

/* ---------- Utilidades ---------- */
let toastT = 0; function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 3200) }
window.toast = toast;
function fmtDate(iso, long) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-PE', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }
const fmtDateTime = iso => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const money = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const productById = id => catalog.find(p => p.id === id) || null;
const product = () => productById(quote.producto);
const isPolo = p => !!p && /^polo/.test(p.id);
const needs3D = () => { const p = product(); return !!(p && p.editor3d && !quote.revision && !quote.no3D) };
const designReady = () => !!(quote.threeD && quote.threeD.previews && quote.threeD.previews.f);
const sumTallas = t => Object.values(t || {}).reduce((a, n) => a + (Number(n) || 0), 0);
const tallasText = t => Object.entries(t || {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${k}: ${n}`).join(' · ');
// WhatsApp de ventas con un texto ya preparado. El cliente todavía tiene que pulsar «Enviar» dentro de WhatsApp.
const waLink = text => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(text)}`;
function autoSaveDraft() { if (savedId) return; try { const { threeD } = quote; sessionStorage.setItem(DRAFT, JSON.stringify({ ...quote, threeD: threeD ? { ...threeD, logoFile: undefined } : null })) } catch (e) {} }
function photoOf(p, i = 0) { const f = p && p.fotos && p.fotos[i]; return f ? ASSET + f : null }
function imgTag(src, alt, cls = '') { return src ? `<img src="${src}" alt="${esc(alt)}" loading="lazy"${cls ? ` class="${cls}"` : ''}/>` : '<span class="muted small">Sin foto</span>' }
function sniff(head) { const h = [...head]; if ([0x89, 0x50, 0x4E, 0x47].every((b, i) => h[i] === b)) return 'image/png'; if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return 'image/jpeg'; if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 && h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50) return 'image/webp'; return '' }
const dataUrlToBlob = async d => (await fetch(d)).blob();

/* ---------- Catálogo en vivo desde el sistema interno ---------- */
async function loadCatalog() {
  catalogState = 'loading'; renderCatalogViews();
  try {
    const { list, cached, error } = await Intranet.productos();
    // Solo se ofrecen los productos del sistema interno que tienen foto en la web.
    catalog = list.filter(p => C.catalogo[p.id]).map(p => ({ ...p, ...C.catalogo[p.id], nombre: p.nombre }));
    catalogState = cached ? 'cached' : 'ok'; catalogError = cached && error ? error.message : '';
  } catch (e) { catalogState = 'error'; catalogError = e.message; }
  renderCatalogViews();
}
function renderCatalogViews() { renderFeatured(); if (lastView === 'catalogo') renderCatalog(); if (lastView === 'producto') renderProduct(currentRoute.id); if (lastView === 'cotizar' && currentRoute.step === 0) renderStep0(); if (lastView === 'cotizar') renderAside(); }
const lineCounts = () => { const c = { todos: catalog.length }; for (const p of catalog) c[p.linea] = (c[p.linea] || 0) + 1; return c };
function lineChips(active, attr) { const c = lineCounts(); return ['todos', ...Object.keys(C.lineas).filter(l => c[l])].map(l => `<button class="chip ${active === l ? 'on' : ''}" type="button" role="tab" aria-selected="${active === l}" ${attr}="${l}">${l === 'todos' ? 'Todos' : esc(C.lineas[l])}<span class="n">${c[l] || 0}</span></button>`).join('') }
function pcard(p, sel, act) { return `<button type="button" class="pcard${sel ? ' sel' : ''}" ${act}><span class="tile">${imgTag(photoOf(p), p.nombre)}</span><b>${esc(p.nombre)}</b><small>${esc(C.lineas[p.linea] || p.linea)} · mín. ${p.minimo} uds.</small></button>` }
function catalogStatus() { if (catalogState === 'loading') return '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'; if (catalogState === 'error') return `<div class="empty" style="grid-column:1/-1">No pudimos cargar el catálogo desde el sistema de Corpotex.<br/><small>${esc(catalogError)}</small><br/><br/><button class="btn btn-dark btn-sm" type="button" onclick="loadCatalog()">Reintentar</button></div>`; return '' }
function renderFeatured() { const el = $('featured'); if (!el) return; el.innerHTML = catalogStatus() || catalog.slice(0, 6).map(p => pcard(p, false, `data-product="${p.id}"`)).join('') }
function renderCatalog() { $('lineChips').innerHTML = catalog.length ? lineChips(lineFilter, 'data-line') : ''; const n = $('catalogNotice'); n.hidden = catalogState !== 'cached'; n.textContent = 'Sin conexión con el sistema de Corpotex: mostramos el último catálogo disponible. Para cotizar se necesita conexión.';
  $('catalogGrid').innerHTML = catalogStatus() || catalog.filter(p => lineFilter === 'todos' || p.linea === lineFilter).map(p => pcard(p, false, `data-product="${p.id}"`)).join('') || '<div class="empty" style="grid-column:1/-1">No hay productos en esta línea.</div>' }
let galleryIdx = 0;
async function renderProduct(id) {
  const el = $('productBody'), p = productById(id);
  if (!p) { el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" data-back aria-label="Regresar">←</button><h1>Detalle de prenda</h1><span class="page-head-sp"></span></div>${catalogStatus() ? `<div class="pgrid">${catalogStatus()}</div>` : '<div class="empty">Esta prenda no está disponible en el catálogo.</div>'}`; return }
  galleryIdx = Math.min(galleryIdx, p.fotos.length - 1);
  el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" data-back aria-label="Regresar">←</button><h1>Detalle de prenda</h1><span class="page-head-sp"></span></div>
  <div class="detail"><div><div class="detail-hero">${imgTag(photoOf(p, galleryIdx), p.nombre)}</div>${p.fotos.length > 1 ? `<div class="gallery-dots">${p.fotos.map((f, i) => `<button type="button" aria-label="Foto ${i + 1}" class="${i === galleryIdx ? 'on' : ''}" data-gal="${i}"></button>`).join('')}</div>` : ''}</div>
  <div class="detail-card"><span class="line">${esc(C.lineas[p.linea] || p.linea)}</span><h2>${esc(p.nombre)}</h2><p>${esc(p.descripcion || '')}</p>
   <div class="facts"><div><small>Línea</small><b>${esc(C.lineas[p.linea] || p.linea)}</b></div><div><small>Pedido mínimo</small><b>${p.minimo} uds.</b></div><div><small>Personalización sugerida</small><b>${esc(persLabel(p.personalizacion_por_defecto))}</b></div><div><small>Entrega estimada (${p.minimo} uds.)</small><b id="detailEta">Calculando…</b></div></div>
   <small class="muted">Personalizaciones disponibles</small><div class="tags">${p.personalizaciones.map(k => `<span>${esc(persLabel(k))}</span>`).join('')}</div>
   ${p.editor3d ? '<p class="pill-ok">✦ Diseño en 3D disponible</p>' : ''}
   <div class="detail-actions"><button class="circle-btn" type="button" data-route="catalogo" aria-label="Ver catálogo">▦</button><button class="btn btn-dark" type="button" data-choose="${p.id}">Personalizar y cotizar</button></div></div></div>`;
  try { const r = await Intranet.estimar([{ producto: p.id, cantidad: p.minimo, personalizacion: p.personalizacion_por_defecto }]); const e = $('detailEta'); if (e) e.textContent = `${fmtDate(r.fecha_estimada)} · ${r.dias_habiles} días háb.` } catch (e) { const x = $('detailEta'); if (x) x.textContent = 'No disponible ahora' }
}

/* ---------- Navegación con historial del navegador ---------- */
const STEP_SLUG = ['pedido', 'diseno', 'resumen'], D3_SLUG = ['colores', 'estampado', 'ubicacion', 'vista-previa'];
let currentRoute = { view: 'inicio' }, lastFlow = null;
function parseRoute(h) {
  const p = String(h || '').replace(/^#\/?/, '').split('/').map(x => { try { return decodeURIComponent(x) } catch (e) { return x } });
  switch (p[0]) {
    case 'catalogo': return { view: 'catalogo' };
    case 'producto': return { view: 'producto', id: p[1] || '' };
    case 'cotizar': if (p[1] === 'diseno' && p[2] === '3d') return { view: 'editor', ctx: 'pedido', d3: Math.max(0, D3_SLUG.indexOf(p[3] || 'colores')) };
      return { view: 'cotizar', step: Math.max(0, STEP_SLUG.indexOf(p[1] || 'pedido')), review: p[2] === 'revision' };
    case 'solicitudes': if (!p[1]) return { view: 'solicitudes' };
      if (p[2] === 'modificar') { if (p[3] === '3d') return { view: 'editor', ctx: 'mod', code: p[1], d3: Math.max(0, D3_SLUG.indexOf(p[4] || 'colores')) }; return { view: 'solicitudes', code: p[1], mod: p[3] === 'resumen' ? 'resumen' : 'inicio' } }
      return { view: 'solicitudes', code: p[1] };
    default: return { view: 'inicio' };
  }
}
function routeStr(r) {
  if (r.view === 'producto') return 'producto/' + encodeURIComponent(r.id);
  if (r.view === 'cotizar') return 'cotizar/' + STEP_SLUG[r.step || 0] + (r.review && r.step === 1 ? '/revision' : '');
  if (r.view === 'editor') return r.ctx === 'pedido' ? 'cotizar/diseno/3d/' + D3_SLUG[r.d3 || 0] : `solicitudes/${encodeURIComponent(r.code)}/modificar/3d/${D3_SLUG[r.d3 || 0]}`;
  if (r.view === 'solicitudes') return 'solicitudes' + (r.code ? '/' + encodeURIComponent(r.code) + (r.mod ? '/modificar' + (r.mod === 'resumen' ? '/resumen' : '') : '') : '');
  return r.view;
}
// Corrige rutas no válidas: no se reabre un pedido registrado ni se salta un paso obligatorio.
function guard(r) {
  r = { ...r };
  if (r.view === 'cotizar' || (r.view === 'editor' && r.ctx === 'pedido')) {
    if (savedId) return { view: 'cotizar', step: 2 };
    const step = r.view === 'editor' ? 1 : r.step;
    if (step >= 1 && !validStep0(false).ok) return { view: 'cotizar', step: 0, msg: !!product() && estimate.state === 'ok' };
    if (r.view === 'editor' && !(product() && product().editor3d)) return { view: 'cotizar', step: 1 };
    if (r.view === 'cotizar' && r.step === 2 && needs3D() && !designReady()) return { view: 'cotizar', step: 1, need3D: true };
  }
  if (r.view === 'editor' && r.ctx === 'mod') { const o = Store.find(r.code); if (!o || !o.design || !modSession || modSession.code !== r.code) return { view: 'solicitudes', code: r.code, mod: o ? 'inicio' : undefined } }
  if (r.view === 'solicitudes' && r.mod === 'resumen' && (!modSession || modSession.code !== r.code || !modSession.categoria)) return { view: 'solicitudes', code: r.code, mod: 'inicio' };
  return r;
}
const navIdx = () => (history.state && Number.isInteger(history.state.i)) ? history.state.i : 0;
const isFlow = r => r.view === 'cotizar' || (r.view === 'editor' && r.ctx === 'pedido');
const navState = (r, i) => isFlow(r) ? { i, q: quote.qid } : { i };
let lastIdx = 0;
function nav(route, { replace = false } = {}) { const r = guard(typeof route === 'string' ? parseRoute(route) : route), s = routeStr(r); if (replace || ('#' + s) === location.hash) history.replaceState(navState(r, navIdx()), '', '#' + s); else history.pushState(navState(r, navIdx() + 1), '', '#' + s); lastIdx = navIdx(); render(r) }
// Al ir hacia atrás se saltan los pasos de una solicitud ya registrada (salvo su resumen) o de una solicitud descartada,
// para volver a la página donde se empezó en vez de repetir el mismo resumen en cada pulsación.
window.addEventListener('popstate', () => {
  const raw = parseRoute(location.hash), i = navIdx(), back = i < lastIdx, q = history.state && history.state.q; lastIdx = i;
  if (back && i > 0 && isFlow(raw) && (q !== quote.qid || (savedId && raw.step !== 2))) { history.back(); return }
  const r = guard(raw), s = routeStr(r); if (s !== routeStr(raw)) history.replaceState(navState(r, i), '', '#' + s); render(r);
});
function goBack(fallback) { navIdx() > 0 ? history.back() : nav(fallback || 'inicio') }

/* Desplazamiento a las secciones de Inicio. Se calcula con el alto real de la cabecera y solo en vertical, y se
   corrige al terminar por si alguna imagen o fuente cambió el alto de la página durante el desplazamiento. */
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let scrollFix = 0;
function scrollToY(y) { window.scrollTo({ top: Math.max(0, y), left: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }) }
function sectionY(id) { const el = $(id); return el ? el.getBoundingClientRect().top + window.scrollY - $('hdr').offsetHeight - 10 : null }
function scrollToSection(id) { if (currentRoute.view !== 'inicio') nav('inicio'); smoothTo(() => sectionY(id)) }
function smoothTo(getY) {
  const y = getY(); if (y === null) return; scrollToY(y);
  clearTimeout(scrollFix); let tries = 0;
  const fix = () => { const t = getY(); if (t !== null && Math.abs(window.scrollY - Math.min(t, document.documentElement.scrollHeight - innerHeight)) > 3) { if (++tries < 3) { window.scrollTo({ top: t, left: 0, behavior: 'instant' }); scrollFix = setTimeout(fix, 250) } } };
  scrollFix = setTimeout(fix, reduceMotion() ? 50 : 900);
  // Si la persona mueve la página mientras tanto, no se le corrige la posición.
  const cancel = () => { clearTimeout(scrollFix); removeEventListener('wheel', cancel); removeEventListener('touchstart', cancel) };
  addEventListener('wheel', cancel, { passive: true, once: true }); addEventListener('touchstart', cancel, { passive: true, once: true });
}
// Menú desplegable de la cabecera en celulares y tablets.
function toggleMenu(force) { const h = $('hdr'), open = force ?? !h.classList.contains('open'); h.classList.toggle('open', open); $('menuBtn').setAttribute('aria-expanded', String(open)); $('menuBtn').setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú') }
// Marca en el menú la sección de Inicio que se está viendo: la última cuyo inicio ya pasó el 40 % superior de la pantalla.
const SPY = ['proceso', 'servicios', 'nosotros', 'contacto'];
function markSections() {
  let cur = null;
  if (currentRoute.view === 'inicio') { for (const i of SPY) { const el = $(i); if (el && el.getBoundingClientRect().top <= innerHeight * .4) cur = i } if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 4) cur = SPY[SPY.length - 1] }
  QA('.topnav [data-scroll]').forEach(b => b.classList.toggle('on', b.dataset.scroll === cur)); QA('.topnav [data-route="inicio"]').forEach(b => b.classList.toggle('on', currentRoute.view === 'inicio' && !cur));
}
function watchSections() { let pending = false; addEventListener('scroll', () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; markSections() }) }, { passive: true }) }
function render(r) {
  const prev = currentRoute; currentRoute = r; const view = r.view; if (isFlow(r)) lastFlow = r;
  QA('main > .view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  const tab = view === 'producto' ? 'catalogo' : view === 'editor' ? (r.ctx === 'pedido' ? 'cotizar' : 'solicitudes') : view;
  QA('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); QA('.topnav [data-route]').forEach(b => b.classList.toggle('on', b.dataset.route === tab)); markSections(); toggleMenu(false);
  document.body.classList.toggle('in-editor', view === 'editor'); document.body.dataset.view = view; if (view !== 'inicio' && view !== 'catalogo') toggleAssistant(false);
  if (view !== 'editor') Designer.pause();
  if (view !== lastView || view === 'producto' || view === 'solicitudes') window.scrollTo({ top: 0, behavior: 'instant' });
  lastView = view;
  if (view === 'catalogo') renderCatalog();
  if (view === 'producto') { if (prev.id !== r.id) galleryIdx = 0; renderProduct(r.id) }
  if (view === 'cotizar') showStep(r, prev);
  if (view === 'editor') showEditor(r);
  if (view === 'solicitudes') renderSolicitudes(r);
}

/* ---------- Paso 1: pedido ---------- */
function showStep(r, prev) {
  const i = r.step || 0;
  for (let j = 0; j < 3; j++) { $('orderStep' + j).classList.toggle('show', j === i); $('progress' + j).classList.toggle('on', j === i); $('progress' + j).classList.toggle('done', j < i || !!savedId) }
  $('flowTitle').textContent = ['Tu pedido', 'Diseño', 'Resumen'][i];
  if (i === 0) { renderStep0(); if (r.msg) validStep0(true) }
  if (i === 1) { renderDesign(); if (r.need3D) showMsg('designMsg', 'Completa tu diseño en 3D y su vista previa, o solicita la revisión del diseñador, antes de revisar la solicitud.'); if (r.review) openReview() }
  if (i === 2) renderSummary();
  renderAside();
  if (prev.view === 'cotizar' && prev.step !== i) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderStep0() {
  if (catalogState === 'loading' || catalogState === 'error') { $('flowLines').innerHTML = ''; $('garmentGrid').innerHTML = catalogStatus(); return }
  if (quote.producto && !product()) quote.producto = null;
  $('flowLines').innerHTML = lineChips(flowLine, 'data-flowline');
  $('garmentGrid').innerHTML = catalog.filter(p => flowLine === 'todos' || p.linea === flowLine || p.id === quote.producto).map(p => pcard(p, p.id === quote.producto, `data-garment="${p.id}" role="radio" aria-checked="${p.id === quote.producto}"`)).join('');
  const p = product();
  $('personalizacion').innerHTML = p ? p.personalizaciones.map(k => `<option value="${k}">${esc(persLabel(k))}</option>`).join('') : '<option value="">Elige primero una prenda</option>';
  $('personalizacion').disabled = !p; if (p) $('personalizacion').value = quote.personalizacion;
  $('quantity').min = p ? p.minimo : 1; $('quantity').value = quote.cantidad ?? ''; $('minHint').textContent = p ? `Pedido mínimo: ${p.minimo} unidades.` : 'Elige una prenda para ver el pedido mínimo.';
  if (!$('sizes').children.length) $('sizes').innerHTML = C.tallas.map(t => `<label>${t}<input type="number" inputmode="numeric" min="0" max="100000" data-talla="${t}" aria-label="Unidades talla ${t}"/></label>`).join('');
  QA('[data-talla]').forEach(inp => { const v = quote.tallas[inp.dataset.talla]; inp.value = v ? v : '' });
  updateSizeSum();
  $('colorField').hidden = !!(p && p.editor3d);
  $('garmentColor').value = quote.color; $('customer').value = quote.cliente.nombre; $('company').value = quote.cliente.empresa; $('phone').value = quote.cliente.telefono; $('email').value = quote.cliente.correo; $('desiredDate').value = quote.fechaDeseada; $('notes').value = quote.notas;
  renderEstimate();
}
function selectGarment(id) {
  if (savedId) resetNewQuote(); const p = productById(id); if (!p) return;
  if (quote.producto !== id) { quote.producto = id; quote.personalizacion = p.personalizacion_por_defecto; if (!quote.cantidad || quote.cantidad < p.minimo) quote.cantidad = p.minimo; if (!p.editor3d) { quote.threeD = null } }
  quoteStarted = true; clearErr('producto'); renderStep0(); renderAside(); autoSaveDraft(); scheduleEstimate(0);
}
function updateSizeSum() { const s = sumTallas(quote.tallas), q = Number(quote.cantidad) || 0; $('sizeSum').textContent = `Suma: ${s} de ${q}`; $('sizeSum').style.color = s === q && q ? 'var(--ok)' : '' }
function syncStep0(e) {
  const t = e && e.target; if (!t) return;
  if (t.dataset.talla) { const n = Math.max(0, Math.floor(Number(t.value) || 0)); if (n) quote.tallas[t.dataset.talla] = n; else delete quote.tallas[t.dataset.talla]; updateSizeSum(); clearErr('tallas') }
  else switch (t.id) {
    case 'personalizacion': quote.personalizacion = t.value; scheduleEstimate(); break;
    case 'quantity': quote.cantidad = t.value === '' ? null : Math.floor(Number(t.value)); updateSizeSum(); clearErr('cantidad'); scheduleEstimate(); break;
    case 'garmentColor': quote.color = t.value.trim(); break;
    case 'customer': quote.cliente.nombre = t.value; clearErr('contacto'); break;
    case 'company': quote.cliente.empresa = t.value; break;
    case 'phone': quote.cliente.telefono = t.value; clearErr('contacto'); break;
    case 'email': quote.cliente.correo = t.value.trim(); clearErr('contacto'); break;
    case 'desiredDate': quote.fechaDeseada = t.value; checkDate(true); break;
    case 'notes': quote.notas = t.value; break;
    default: return;
  }
  quoteStarted = true; renderAside(); autoSaveDraft();
}
function setErr(k, msg) { const e = $('err-' + k); if (!e) return; e.textContent = msg; e.hidden = !msg; const map = { cantidad: 'quantity', contacto: null, fecha: 'desiredDate', tallas: null }; if (map[k]) $(map[k]).closest('.field').classList.toggle('invalid', !!msg); if (k === 'tallas') $('sizes').classList.toggle('invalid', !!msg) }
const clearErr = k => setErr(k, '');

/* Entrega estimada (sistema interno) */
const estKey = () => `${quote.producto}|${quote.cantidad}|${quote.personalizacion}`;
function scheduleEstimate(delay = 650) { clearTimeout(estT); estT = setTimeout(runEstimate, delay) }
async function runEstimate() {
  const p = product(), q = Number(quote.cantidad);
  if (!p || !quote.personalizacion || !(q >= p.minimo) || q > 100000) { estimate = { state: 'idle', key: '', data: null, error: '' }; renderEstimate(); return null }
  const key = estKey(); if (estimate.state === 'ok' && estimate.key === key && Date.now() - estimate.at < 5 * 60e3) return estimate.data;
  estimate = { state: 'loading', key, data: null, error: '' }; renderEstimate();
  try { const d = await Intranet.estimar([{ producto: p.id, cantidad: q, personalizacion: quote.personalizacion }]); if (estKey() !== key) return null; estimate = { state: 'ok', key, data: d, error: '', at: Date.now() } }
  catch (e) { if (estKey() !== key) return null; estimate = { state: 'error', key, data: null, error: e.message } }
  renderEstimate(); checkDate(false); renderAside(); return estimate.data;
}
function estimateHTML(st) {
  if (st.state === 'loading') return '<div class="estimate wait">Consultando la entrega estimada con la planta…</div>';
  if (st.state === 'error') return `<div class="estimate err">No ha sido posible verificar la disponibilidad: ${esc(st.error)} <button class="btn btn-light btn-sm" type="button" data-retry-estimate>Reintentar</button></div>`;
  if (st.state !== 'ok') { const p = product(); return `<div class="estimate wait">${p ? `Indica al menos ${p.minimo} unidades para calcular la entrega estimada.` : 'Elige una prenda y la cantidad para calcular la entrega estimada.'}</div>` }
  const d = st.data; return `<div class="estimate">Entrega estimada<b class="date">${esc(fmtDate(d.fecha_estimada, true))}</b>${d.dias_habiles} días hábiles según la carga actual de la planta. Es una estimación: ventas confirma la fecha en firme.${Array.isArray(d.detalle) && d.detalle.length ? `<details><summary class="small" style="cursor:pointer;margin-top:6px">Ver etapas</summary><ul class="timeline">${d.detalle.map(x => `<li><span>${esc(x.area)}</span><span>${fmtDate(x.inicio)} – ${fmtDate(x.fin)}</span></li>`).join('')}</ul></details>` : ''}</div>`;
}
function renderEstimate() { const b = $('estimateBox'); if (b) b.innerHTML = estimateHTML(estimate); const ok = estimate.state === 'ok'; $('desiredDate').min = ok ? estimate.data.fecha_estimada : ''; }
// Las fechas se comparan como texto AAAA-MM-DD (el formato del sistema interno), sin pasar por la zona horaria del navegador.
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const weekday = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
function deliveryDaysText() { const d = [...C.diasEntrega].sort(); const run = d.every((x, i) => !i || x === d[i - 1] + 1); return run && d.length > 2 ? `de ${DAY_NAMES[d[0]]} a ${DAY_NAMES[d[d.length - 1]]}` : d.map(x => DAY_NAMES[x]).join(', ') }
function dateError(iso, est) {
  if (!iso) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(weekday(iso))) return 'Ingresa una fecha válida.';
  if (est && iso < est.fecha_estimada) return DATE_MSG + ` Fecha disponible: ${fmtDate(est.fecha_estimada)}.`;
  if (!C.diasEntrega.includes(weekday(iso))) return `El ${DAY_NAMES[weekday(iso)]} no hay entregas: elige un día ${deliveryDaysText()}.`;
  return '';
}
function checkDate() { const msg = dateError(quote.fechaDeseada, estimate.state === 'ok' ? estimate.data : null); setErr('fecha', msg); return !msg }
// Valida todos los datos del pedido. Con show=true marca cada campo con su mensaje.
function validStep0(show) {
  const p = product(), errs = {}, q = Number(quote.cantidad);
  if (!p) errs.producto = 'Selecciona el tipo de prenda.';
  else {
    if (!p.personalizaciones.includes(quote.personalizacion)) errs.producto = 'Elige una personalización disponible para esta prenda.';
    if (!Number.isInteger(q) || q < p.minimo || q > 100000) errs.cantidad = `La cantidad debe ser un número entero entre ${p.minimo} y 100 000.`;
    else if (sumTallas(quote.tallas) !== q) errs.tallas = `Las tallas suman ${sumTallas(quote.tallas)} y la cantidad es ${q}. Ajusta la distribución para que coincidan.`;
  }
  const c = quote.cliente, digits = String(c.telefono).replace(/\D/g, '');
  if (String(c.nombre).trim().length < 2) errs.contacto = 'Ingresa tu nombre de contacto.';
  else if (digits.length < 7 || digits.length > 15) errs.contacto = 'Ingresa un teléfono válido (al menos 7 dígitos).';
  else if (c.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.correo)) errs.contacto = 'Revisa el correo electrónico o déjalo vacío.';
  if (p && !errs.cantidad && !errs.producto) {
    if (estimate.state !== 'ok' || estimate.key !== estKey()) errs.fecha = estimate.state === 'error' ? 'No ha sido posible verificar la disponibilidad. Reintenta el cálculo de la entrega estimada.' : 'Esperando la entrega estimada de la planta.';
    else { const m = dateError(quote.fechaDeseada, estimate.data); if (m) errs.fecha = m }
  }
  if (show) { ['producto', 'cantidad', 'tallas', 'contacto', 'fecha'].forEach(k => setErr(k, errs[k] || '')); const first = Object.keys(errs)[0]; const v = $('validationMsg'); v.hidden = !first; v.textContent = first ? 'Revisa los campos marcados antes de continuar.' : ''; if (first) { const target = { producto: 'garmentGrid', cantidad: 'quantity', tallas: 'sizes', contacto: 'customer', fecha: 'estimateBox' }[first]; $(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } }
  return { ok: !Object.keys(errs).length, errs };
}
async function goDesign() { if (product() && estimate.state !== 'ok') await runEstimate(); if (!validStep0(true).ok) return; nav('cotizar/diseno') }

/* ---------- Paso 2: diseño ---------- */
function renderDesign() {
  const p = product(), polo = isPolo(p); $('designMsg').hidden = true;
  $('designDesc').textContent = p.editor3d ? 'Elige un estilo base y diseña tu polo en 3D con tus colores y tu logo.' : `Elige un estilo base. Nuestro equipo preparará la propuesta de tu ${p.nombre.toLowerCase()}.`;
  $('styleChoices').innerHTML = STYLES.map((s, i) => `<button type="button" role="radio" aria-checked="${quote.estilo === i}" class="style${quote.estilo === i ? ' sel' : ''}" data-style="${i}">${polo ? `<img src="${ASSET + s.img}" alt="Polo estilo ${s.name}" loading="lazy"/>` : `<span class="sicon" aria-hidden="true">${s.icon}</span>`}<strong>${s.name}</strong><span>${s.desc}</span></button>`).join('');
  const e = $('design3dEntry');
  if (p.editor3d) { const prev = designReady() ? quote.threeD.previews.f : null;
    e.innerHTML = `<div class="entry3d">${prev ? `<img src="${prev}" alt="Vista previa de tu diseño 3D"/>` : '<span class="ico">✦</span>'}<div class="txt"><b>${prev ? 'Tu diseño 3D está listo' : 'Diseña tu polo en 3D'}</b><span>${prev ? 'Puedes revisarlo o cambiarlo antes de registrar tu solicitud.' : 'Colores, logo PNG, ubicación del estampado y vista previa final del polo camisero con 2 botones.'}${quote.personalizacion === 'ninguna' ? ' Tu pedido es «Sin personalización»: solo podrás elegir colores.' : ''}</span></div><button class="btn ${prev ? 'btn-light' : 'btn-dark'}" type="button" data-route="cotizar/diseno/3d/colores">${prev ? 'Editar diseño 3D' : 'Abrir editor 3D →'}</button></div>` }
  else e.innerHTML = '';
  renderReview(); updateDesignNext();
}
function updateDesignNext() { $('designNext').textContent = needs3D() && !designReady() ? 'Personalizar en 3D →' : 'Revisar mi solicitud →' }
function designNext() { if (!$('reviewForm').hidden) { showMsg('designMsg', 'Guarda o cancela la solicitud de revisión del diseñador antes de continuar.'); return } if (needs3D() && !designReady()) { nav('cotizar/diseno/3d/colores'); return } nav('cotizar/resumen') }
function showMsg(id, t) { const m = $(id); m.textContent = t; m.hidden = !t; if (t) m.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

/* Revisión del diseñador */
function renderReview() {
  const r = quote.revision, p = product();
  $('reviewSummary').innerHTML = r ? `<p class="pill-ok">✓ Revisión solicitada · ${esc(r.id)}</p><dl class="kv"><dt>Motivo</dt><dd>${esc(r.motivo)}</dd><dt>Descripción</dt><dd>${esc(r.descripcion)}</dd><dt>Referencias</dt><dd>${r.archivos.length ? r.archivos.map(a => esc(a.nombre)).join(', ') : 'Sin imágenes'}${r.archivos.length && !reviewFiles.length ? ' (vuelve a adjuntarlas: se perdieron al recargar la página)' : ''}</dd></dl><button class="link-btn" type="button" id="rmReview">Quitar solicitud de revisión</button>` : '';
  $('reviewOpen').textContent = r ? 'Editar solicitud de revisión' : 'Solicitar revisión del diseñador';
  $('reviewFor').textContent = p ? `Para: ${p.nombre} · ${quote.cantidad || '—'} uds. · ${quote.cliente.nombre || 'cliente'} (${quote.cliente.telefono || 'sin teléfono'}). Usamos los datos del paso 1, no hace falta repetirlos.` : '';
  $('reviewMotivo').innerHTML = C.revision.motivos.map(m => `<option>${esc(m)}</option>`).join('');
}
function openReview() { const r = quote.revision; $('reviewForm').hidden = false; $('reviewOpen').hidden = true; $('reviewMotivo').value = r ? r.motivo : C.revision.motivos[0]; $('reviewDesc').value = r ? r.descripcion : ''; renderRefList(); $('reviewForm').scrollIntoView({ behavior: 'smooth', block: 'start' }) }
function closeReview() { $('reviewForm').hidden = true; $('reviewOpen').hidden = false; $('err-review').hidden = true }
function renderRefList() { $('reviewList').innerHTML = reviewFiles.map((f, i) => `<figure><img src="${URL.createObjectURL(f)}" alt=""/><figcaption>${esc(f.name)}</figcaption><button class="link-btn" type="button" data-rmref="${i}">Quitar</button></figure>`).join('') }
async function addReviewFiles(list) {
  const errs = [];
  for (const f of list) {
    if (reviewFiles.length >= C.revision.maxArchivos) { errs.push(`Máximo ${C.revision.maxArchivos} imágenes.`); break }
    if (f.size > C.revision.maxMb * 1048576) { errs.push(`«${f.name}» supera ${C.revision.maxMb} MB.`); continue }
    const kind = sniff(new Uint8Array(await f.slice(0, 12).arrayBuffer()));
    if (!C.revision.formatos.includes(kind)) { errs.push(`«${f.name}» no es una imagen PNG, JPG o WEBP válida.`); continue }
    reviewFiles.push(f);
  }
  $('reviewFiles').value = ''; renderRefList(); const e = $('err-review'); e.textContent = errs.join(' '); e.hidden = !errs.length;
}
function saveReview(ev) {
  ev.preventDefault(); const desc = $('reviewDesc').value.trim(), e = $('err-review');
  if (desc.length < 20) { e.textContent = 'Describe el diseño con al menos 20 caracteres para que el diseñador pueda evaluarlo.'; e.hidden = false; $('reviewDesc').closest('.field').classList.add('invalid'); return }
  $('reviewDesc').closest('.field').classList.remove('invalid');
  quote.revision = { id: quote.revision ? quote.revision.id : 'REV-' + Date.now().toString(36).toUpperCase().slice(-6), motivo: $('reviewMotivo').value, descripcion: desc, archivos: reviewFiles.map(f => ({ nombre: f.name, tipo: f.type, tamano: f.size })), estado: 'Pendiente de revisión', creada: new Date().toISOString() };
  autoSaveDraft(); closeReview(); renderReview(); updateDesignNext(); toast('Solicitud de revisión guardada: se enviará junto con tu pedido.');
}
function removeReview() { quote.revision = null; reviewFiles = []; autoSaveDraft(); renderReview(); updateDesignNext() }

/* ---------- Vista lateral (escritorio) ---------- */
function renderAside() {
  const a = $('flowAside'); if (!a) return; const p = product();
  if (!p) { a.innerHTML = '<div class="card"><h2 class="card-t">Tu prenda</h2><p class="muted small">Elige una prenda para ver aquí el resumen.</p></div>'; return }
  const prev = designReady() ? quote.threeD.previews.f : photoOf(p);
  a.innerHTML = `<div class="card"><div class="detail-hero" style="padding:10px">${imgTag(prev, p.nombre)}</div><h2 class="card-t" style="margin-top:10px">${esc(p.nombre)}</h2><dl class="kv"><dt>Personalización</dt><dd>${esc(persLabel(quote.personalizacion))}</dd><dt>Cantidad</dt><dd>${quote.cantidad || '—'} uds.</dd><dt>Estilo</dt><dd>${STYLES[quote.estilo].name}</dd><dt>Entrega estimada</dt><dd>${estimate.state === 'ok' ? fmtDate(estimate.data.fecha_estimada) : '—'}</dd></dl></div>`;
}

/* ---------- Paso 3: resumen, registro y WhatsApp ---------- */
function designSpec(t) { if (!t || !t.colores) return ''; return `Diseño 3D: polo camisero, 2 botones. Tejido ${colorName(t.colores.tejido)}; cuello y puños ${colorName(t.colores.cuello)}; botones ${colorName(t.colores.botones)}. Estampado: ${t.resumenEstampado}${t.estampado && (t.estampado.logo || t.estampado.texto) ? ' · ' + t.ubicacion : ''}.` }
function summaryRows(q, est) {
  const p = productById(q.producto) || { nombre: q.producto }, rows = [['Prenda', p.nombre], ['Personalización', persLabel(q.personalizacion)], ['Cantidad', `${q.cantidad} uds.`], ['Tallas', tallasText(q.tallas)], ['Estilo base', STYLES[q.estilo].name]];
  if (q.color) rows.push(['Color', q.color]);
  if (q.threeD && q.threeD.colores) { rows.push(['Colores (3D)', `Tejido ${colorName(q.threeD.colores.tejido)} · cuello y puños ${colorName(q.threeD.colores.cuello)} · botones ${colorName(q.threeD.colores.botones)}`], ['Estampado', q.threeD.resumenEstampado + (q.threeD.estampado && (q.threeD.estampado.logo || q.threeD.estampado.texto) ? ' · ' + q.threeD.ubicacion : '')]) }
  if (q.no3D) rows.push(['Diseño 3D', 'No disponible: el equipo de diseño preparará la propuesta']);
  if (q.revision) rows.push(['Revisión del diseñador', `${q.revision.id} · ${q.revision.motivo}`]);
  rows.push(['Contacto', [q.cliente.nombre, q.cliente.empresa].filter(Boolean).join(' · ')], ['Teléfono', q.cliente.telefono]); if (q.cliente.correo) rows.push(['Correo', q.cliente.correo]);
  if (q.fechaDeseada) rows.push(['Fecha deseada', fmtDate(q.fechaDeseada)]);
  rows.push(['Entrega estimada', est ? `${fmtDate(est.fecha_estimada)} (${est.dias_habiles} días háb.)` : '—']);
  if (q.notas) rows.push(['Detalles', q.notas]);
  return rows;
}
function previewsHTML(prev, fallbackSrc, alt) { if (prev && prev.f) { const figs = [['f', 'Frente'], ['b', 'Espalda']].filter(([k]) => prev[k]); return `<div class="previews${figs.length < 2 ? ' one' : ''}">${figs.map(([k, l]) => `<figure><img src="${prev[k]}" alt="Diseño · ${l}"/><figcaption>${l}</figcaption></figure>`).join('')}</div>` } return `<div class="previews one"><figure>${imgTag(fallbackSrc, alt)}<figcaption>${esc(alt)}</figcaption></figure></div>` }
async function renderSummary() {
  const p = product(); if (!p) return;
  $('summaryPreview').innerHTML = previewsHTML(quote.threeD && quote.threeD.previews, photoOf(p), p.nombre);
  const draw = () => { $('quoteSummary').innerHTML = summaryRows(quote, estimate.state === 'ok' ? estimate.data : null).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(''); $('summaryEstimate').innerHTML = estimateHTML(estimate) };
  draw();
  const done = !!savedId; $('summaryActions').hidden = done; $('saveMsg').hidden = true; if (done) return;
  $('saveOrderButton').disabled = saving;
  // La estimación cambia con la carga de la planta: se vuelve a pedir al llegar al resumen.
  estimate.at = 0; await runEstimate(); draw(); const dm = dateError(quote.fechaDeseada, estimate.state === 'ok' ? estimate.data : null); if (dm) showMsg('saveMsg', dm + ' Vuelve al paso 1 para elegir otra fecha.');
}
function buildNotes(q) {
  const parts = [`Estilo base: ${STYLES[q.estilo].name}.`]; if (q.threeD) parts.push(designSpec(q.threeD)); if (q.no3D) parts.push('El editor 3D no estuvo disponible para el cliente.');
  if (q.fechaDeseada) parts.push(`Fecha deseada por el cliente: ${q.fechaDeseada}.`); if (q.cliente.correo) parts.push(`Correo: ${q.cliente.correo}.`);
  if (q.revision) parts.push(`REVISIÓN DEL DISEÑADOR ${q.revision.id} (${q.revision.motivo}): ${q.revision.descripcion}`);
  if (q.notas) parts.push(`Notas del cliente: ${q.notas}`);
  return parts.join(' ');
}
function buildPayload(q, est) {
  const p = product(), tallas = Object.fromEntries(Object.entries(q.tallas).filter(([, n]) => Number(n) > 0).map(([k, n]) => [k, Number(n)]));
  const color = q.threeD ? (COLOR_NAMES[q.threeD.colores.tejido] || q.threeD.colores.tejido) : q.color;
  const cliente = { nombre: q.cliente.nombre.trim(), telefono: q.cliente.telefono.trim() }; if (q.cliente.empresa.trim()) cliente.empresa = q.cliente.empresa.trim();
  const item = { producto: p.id, cantidad: Number(q.cantidad), personalizacion: q.personalizacion, tallas, notas: buildNotes(q) }; if (color) item.color = color;
  const payload = { cliente, items: [item], fecha_estimada: est.fecha_estimada };
  if (q.fechaDeseada) payload.fecha_deseada = q.fechaDeseada; // propuesto al sistema interno para validarlo también en su servidor
  return payload;
}
// Ficha PDF del diseño (vistas, especificaciones, logo original y referencias): es el archivo que recibe la cotización.
function loadScript(src, test) { return new Promise((res, rej) => { if (test()) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s) }) }
async function imgData(blob, maxW = 1400) { const url = URL.createObjectURL(blob); try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url }); const w = Math.min(maxW, img.naturalWidth), h = Math.round(w * img.naturalHeight / img.naturalWidth), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); return { data: c.toDataURL('image/jpeg', .88), w, h } } finally { URL.revokeObjectURL(url) } }
async function buildDesignFile(order, logoBlob, refs) {
  const t = order.design && order.design.versions[0].config; if (!t && !refs.length) return null;
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf);
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 14; let y = M;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text('Corpotex · Ficha de diseño', M, y + 4); pdf.setFontSize(11); pdf.text(`Cotización ${order.id}`, W - M, y + 4, { align: 'right' }); y += 10;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
    const spec = [`Prenda: ${order.item.nombre} · ${order.item.cantidad} uds. (${tallasText(order.item.tallas)}) · ${persLabel(order.item.personalizacion)}`, `Estilo base: ${STYLES[order.estilo].name}`]; if (t) spec.push(designSpec(t)); if (order.revision) spec.push(`Revisión del diseñador ${order.revision.id} (${order.revision.motivo}): ${order.revision.descripcion}`);
    for (const s of spec) { const lines = pdf.splitTextToSize(s, W - 2 * M); pdf.text(lines, M, y + 4); y += lines.length * 4.4 + 1 }
    y += 3;
    if (t) {
      let views = [];
      if (Designer.viewsReady()) for (const k of Designer.ORDER) views.push({ label: Designer.VIEWS[k].label, ...(await Designer.viewJPEG(k, 900)) });
      else for (const [k, l] of [['f', 'Frente'], ['b', 'Espalda']]) if (t.previews && t.previews[k]) views.push({ label: l, data: t.previews[k], w: 480, h: 600 });
      const cols = views.length > 2 ? 4 : 2, gw = (W - 2 * M - (cols - 1) * 4) / cols, gh = gw * 1.25;
      views.forEach((v, i) => { const x = M + i * (gw + 4); pdf.addImage(v.data, 'JPEG', x, y, gw, gh); pdf.text(v.label, x + gw / 2, y + gh + 4, { align: 'center' }) }); y += gh + 9;
    }
    const pics = []; if (logoBlob) pics.push({ blob: logoBlob, label: 'Logo original (PNG del cliente)' }); refs.forEach((f, i) => pics.push({ blob: f, label: `Referencia ${i + 1}: ${f.name}` }));
    for (const pic of pics) { const d = await imgData(pic.blob); const maxW = W - 2 * M, ratio = d.h / d.w; let w = Math.min(maxW, 120), h = w * ratio; if (h > 160) { h = 160; w = h / ratio } if (y + h + 10 > 287) { pdf.addPage(); y = M } pdf.setFont('helvetica', 'bold'); pdf.text(pic.label, M, y + 4); pdf.setFont('helvetica', 'normal'); pdf.addImage(d.data, 'JPEG', M, y + 6, w, h); y += h + 12 }
    const blob = pdf.output('blob'); if (blob.size <= 10 * 1048576) return { blob, name: `ficha-diseno-${order.id}.pdf` };
  } catch (e) { console.warn('No se pudo generar la ficha PDF', e) }
  // Alternativa sin PDF: el logo original o la vista frontal.
  if (logoBlob && logoBlob.size <= 10 * 1048576) return { blob: logoBlob, name: `logo-${order.id}.png` };
  if (t && t.previews && t.previews.f) return { blob: await dataUrlToBlob(t.previews.f), name: `vista-frente-${order.id}.jpg` };
  if (refs[0]) return { blob: refs[0], name: refs[0].name };
  return null;
}
async function uploadDesign(order) {
  const file = await buildDesignFile(order, designLogo, reviewFiles); if (!file) return { ok: null };
  try { await Intranet.subirDiseno(order.id, file.blob, file.name); return { ok: true, name: file.name } } catch (e) { return { ok: false, error: e.message } }
}
function openPlaceholder() { try { const w = window.open('', '_blank'); if (!w) return null; w.opener = null; w.document.write('<!doctype html><meta charset="utf-8"><title>Corpotex</title><p style="font:16px system-ui;padding:24px;color:#0d2547">Registrando tu solicitud en Corpotex… Cuando quede registrada se abrirá WhatsApp con el reporte de tu pedido.</p>'); return w } catch (e) { return null } }

/* Reporte para WhatsApp: se arma con los datos de la solicitud ya registrada. Las líneas sin dato se omiten. */
function reportBlock(title, rows) { const r = rows.filter(([, v]) => v !== undefined && v !== null && v !== false && String(v).trim() !== ''); return r.length ? ['', `*${title}*`, ...r.map(([k, v]) => `• ${k}: ${v}`)] : [] }
const ORDER_STATE_TXT = 'cotización registrada, pendiente de confirmación de ventas (todavía no entra a producción).';
function orderReport(o, etapa) {
  const t = o.design && o.design.versions[0].config, it = o.item, e = t && t.estampado;
  const est = o.fechaEstimada ? `${fmtDate(o.fechaEstimada)}${o.diasHabiles ? ` (${o.diasHabiles} días hábiles)` : ''}, estimada por la planta; ventas confirma la fecha en firme` : '';
  const prev = o.intranet && o.intranet.disenoSubido ? `ficha del diseño adjunta a la cotización en el sistema de Corpotex${o.intranet.archivo ? ` (${o.intranet.archivo})` : ''}` : '';
  return ['*REPORTE DE SOLICITUD — CORPOTEX*', `Código de solicitud: ${o.id}`, `Fecha de registro: ${fmtDateTime(o.createdAt)}`,
    ...reportBlock('DATOS DEL CLIENTE', [['Nombre', o.cliente.nombre], ['Empresa u organización', o.cliente.empresa], ['Teléfono', o.cliente.telefono], ['Correo', o.cliente.correo]]),
    ...reportBlock('DETALLES DEL PEDIDO', [['Tipo de prenda', it.nombre], ['Personalización', persLabel(it.personalizacion)], ['Estilo', STYLES[o.estilo] && STYLES[o.estilo].name], ['Cantidad', `${it.cantidad} uds.${tallasText(it.tallas) ? ` (${tallasText(it.tallas)})` : ''}`], ['Color', it.color], ['Fecha deseada de entrega', o.fechaDeseada && fmtDate(o.fechaDeseada)], ['Fecha estimada de entrega', est]]),
    ...reportBlock('DISEÑO PERSONALIZADO', [['Diseño 3D', t && 'polo camisero con 2 botones'], ['Colores', t && `tejido ${colorName(t.colores.tejido)}; cuello y puños ${colorName(t.colores.cuello)}; botones ${colorName(t.colores.botones)}`], ['Estampados', t && t.resumenEstampado + (e && (e.logo || e.texto) ? ` · ${t.ubicacion}` : '')], ['Diseño', o.no3D && 'el editor 3D no estuvo disponible; el equipo de diseño preparará la propuesta'], ['Revisión del diseñador', o.revision && `${o.revision.id} · ${o.revision.motivo} · ${o.revision.estado}`], ['Observaciones', o.notasCliente], ['Vista previa', prev]]),
    '', '*ESTADO*', '• Solicitud registrada correctamente en el sistema de Corpotex.', `• Estado actual: ${etapa ? stageName(etapa) + '.' : ORDER_STATE_TXT}`].join('\n');
}
async function saveQuote() {
  if (saving || savedId) return;
  const v = validStep0(false); if (!v.ok) { nav({ view: 'cotizar', step: 0, msg: true }); return }
  if (needs3D() && !designReady()) { showMsg('saveMsg', 'Completa tu diseño 3D y su vista previa antes de registrar.'); return }
  saving = true; const btn = $('saveOrderButton'); btn.disabled = true; btn.textContent = 'Registrando…'; $('saveMsg').hidden = true;
  const waWin = openPlaceholder(); // se abre en el clic; solo se dirige a WhatsApp si el registro termina bien
  const fail = msg => { if (waWin && !waWin.closed) waWin.close(); saving = false; btn.disabled = false; btn.textContent = 'Registrar solicitud'; showMsg('saveMsg', msg) };
  let est;
  try { btn.textContent = 'Verificando la entrega estimada…'; est = await Intranet.estimar([{ producto: quote.producto, cantidad: Number(quote.cantidad), personalizacion: quote.personalizacion }]); estimate = { state: 'ok', key: estKey(), data: est, error: '', at: Date.now() } }
  catch (e) { return fail('No ha sido posible verificar la disponibilidad con la planta. No registramos la solicitud con una fecha sin verificar: inténtalo de nuevo. ' + e.message) }
  const dm = dateError(quote.fechaDeseada, est); if (dm) { renderSummary(); return fail(dm + ' Vuelve al paso 1 para elegir otra fecha.') }
  let res;
  try { btn.textContent = 'Registrando en el sistema de Corpotex…'; res = await Intranet.crearCotizacion(buildPayload(quote, est)) }
  catch (e) { return fail(e.offline ? e.message : 'El sistema de Corpotex no aceptó la solicitud: ' + e.message) }
  if (!res || !res.codigo) return fail('El sistema de Corpotex no devolvió un código de solicitud. Inténtalo de nuevo.');
  const now = new Date().toISOString(), p = product(), threeD = quote.threeD ? { ...quote.threeD, logoFile: undefined } : null;
  const order = { id: res.codigo, v: 3, createdAt: now, estado: 'registrada', intranet: { codigo: res.codigo, disenoSubido: null }, cliente: { ...quote.cliente }, item: { producto: p.id, nombre: p.nombre, cantidad: Number(quote.cantidad), personalizacion: quote.personalizacion, tallas: { ...quote.tallas }, color: quote.color || (threeD ? COLOR_NAMES[threeD.colores.tejido] || threeD.colores.tejido : '') }, estilo: quote.estilo, fechaDeseada: quote.fechaDeseada, fechaEstimada: est.fecha_estimada, diasHabiles: est.dias_habiles, notasCliente: quote.notas, no3D: !!quote.no3D, design: threeD ? { versions: [{ v: 1, tipo: 'original', estado: 'registrada', creado: now, config: { ...threeD, previews: undefined }, previews: threeD.previews, logoKey: designLogo ? `${res.codigo}:v1:logo` : null }] } : null, revision: quote.revision ? { ...quote.revision } : null, modificaciones: [] };
  savedId = res.codigo; saving = false; quoteStarted = false;
  if (!Store.add(order)) toast('La solicitud se registró en Corpotex, pero no se pudo guardar la copia en este dispositivo.');
  try { sessionStorage.removeItem(DRAFT) } catch (e) {}
  if (designLogo) Store.putFile(`${res.codigo}:v1:logo`, designLogo).catch(() => {});
  reviewFiles.forEach((f, i) => Store.putFile(`${res.codigo}:ref:${i}`, f).catch(() => {}));
  btn.textContent = 'Adjuntando tu diseño…';
  const up = await uploadDesign(order); Store.update(order, o => { o.intranet.disenoSubido = up.ok; o.intranet.archivo = up.name || null; if (up.ok === false) o.intranet.disenoError = up.error });
  // WhatsApp solo se abre aquí, con el registro ya confirmado por el sistema interno y el reporte de la solicitud.
  let opened = false;
  if (waWin && !waWin.closed) { try { waWin.location.href = waLink(orderReport(order)); opened = true } catch (e) {} }
  renderSuccess(order, up, opened); renderSummary();
}
function renderSuccess(o, up, opened) {
  for (let j = 0; j < 3; j++) $('progress' + j).classList.add('done');
  const box = $('savedBox'); box.hidden = false;
  box.innerHTML = `<h3>¡Solicitud registrada!</h3><p>Tu código es <span class="code">${esc(o.id)}</span>. Quedó registrada en el sistema de Corpotex; ventas la confirmará contigo.</p>
   <p>${opened ? 'Abrimos WhatsApp con el reporte de tu solicitud: pulsa «Enviar» en WhatsApp para que llegue a ventas.' : 'Pulsa «Enviar reporte por WhatsApp» y luego «Enviar» en WhatsApp para que llegue a ventas.'} Tu solicitud ya está registrada aunque no envíes el mensaje.</p>
   ${up.ok === false ? `<div class="warn">No se pudo adjuntar el diseño a la cotización (${esc(up.error)}). <button class="btn btn-light btn-sm" type="button" id="retryUpload">Reintentar</button></div>` : up.ok ? '<p class="small">✓ Ficha del diseño adjunta a tu cotización.</p>' : ''}
   <div class="success-actions"><a class="btn btn-wa" href="${esc(waLink(orderReport(o)))}" target="_blank" rel="noopener noreferrer">Enviar reporte por WhatsApp ↗</a>${o.design && Designer.hasShots() ? '<button class="btn btn-light" type="button" id="dlDesign">Descargar vistas del diseño</button>' : ''}<button class="btn btn-light" type="button" data-route="solicitudes/${esc(o.id)}">Ver mi solicitud</button><button class="btn btn-light" type="button" data-action="new-quote">Cotizar otra prenda</button></div>`;
  const r = $('retryUpload'); if (r) r.onclick = async () => { r.disabled = true; const u = await uploadDesign(o); Store.update(o, x => { x.intranet.disenoSubido = u.ok; x.intranet.archivo = u.name || null }); renderSuccess(o, u, opened) };
  const d = $('dlDesign'); if (d) d.onclick = () => Designer.downloadSheet().catch(() => toast('No se pudieron preparar las vistas.'));
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Nueva solicitud desde cero: no toca las solicitudes ya registradas.
async function resetNewQuote() {
  quote = blankQuote(); savedId = null; saving = false; quoteStarted = false; designLogo = null; reviewFiles = []; estimate = { state: 'idle', key: '', data: null, error: '' }; flowLine = 'todos'; lastFlow = null; clearTimeout(estT);
  try { sessionStorage.removeItem(DRAFT) } catch (e) {}
  await Designer.useContext('pedido'); Designer.reset();
  $('savedBox').hidden = true; $('savedBox').innerHTML = ''; $('summaryActions').hidden = false; const b = $('saveOrderButton'); b.disabled = false; b.textContent = 'Registrar solicitud'; $('saveMsg').hidden = true; $('validationMsg').hidden = true; closeReview();
  ['producto', 'cantidad', 'tallas', 'contacto', 'fecha'].forEach(clearErr);
}
// «Cotizar mi prenda» siempre empieza desde cero. Si hay una solicitud sin registrar, se pide confirmación antes de descartarla.
async function startQuote() {
  if (quoteStarted && !savedId && quote.producto && !confirm('Tienes una solicitud sin registrar.\n\nAceptar: descartarla y empezar una nueva desde cero.\nCancelar: continuar con la solicitud actual.')) { if (!isFlow(currentRoute)) nav(lastFlow || 'cotizar/pedido'); return }
  await resetNewQuote(); nav('cotizar/pedido');
}
async function chooseProduct(id) { if (savedId) await resetNewQuote(); flowLine = 'todos'; nav('cotizar/pedido'); selectGarment(id) }

/* ---------- Editor 3D: pedido nuevo o modificación ---------- */
async function showEditor(r) {
  Designer.mount();
  if (r.ctx === 'pedido') {
    await Designer.useContext('pedido');
    Object.assign(Designer.hooks, {
      nav: i => nav('cotizar/diseno/3d/' + D3_SLUG[i]), back: () => nav('cotizar/diseno'),
      change: () => { if (quote.threeD) { quote.threeD = null; designLogo = null; autoSaveDraft() } },
      done: d => { designLogo = d.logoFile || null; quote.threeD = { ...d, logoFile: undefined }; quote.no3D = false; quoteStarted = true; autoSaveDraft(); nav('cotizar/resumen') },
      skip: () => { quote.no3D = true; quote.threeD = null; autoSaveDraft(); toast('Continuamos sin editor 3D: nuestro equipo de diseño preparará la propuesta.'); nav('cotizar/resumen') }
    });
    Designer.setOptions({ allowStamp: quote.personalizacion !== 'ninguna', stampNote: 'Tu pedido es «Sin personalización». Cámbiala en el paso 1 para añadir logo o texto.', doneLabel: 'Usar este diseño →', backLabel: '← Estilos' });
    $('editorEyebrow').textContent = 'Paso 2 · Diseño 3D'; $('editorTitle').textContent = 'Diseña tu polo en 3D'; $('editorReview').hidden = false;
    $('editorBack').onclick = () => nav('cotizar/diseno');
  } else {
    const o = Store.find(r.code), key = 'mod:' + r.code;
    if (!modLoaded.has(key)) { const base = lastVersion(o); let logo = null; if (base.logoKey) logo = await Store.getFile(base.logoKey).catch(() => null); await Designer.useContext(key, base.config, logo); modLoaded.add(key); if (base.config.estampado && base.config.estampado.logo && !logo) toast('No encontramos el logo original en este dispositivo: vuelve a subirlo si lo necesitas.') }
    else await Designer.useContext(key);
    Object.assign(Designer.hooks, {
      nav: i => nav(`solicitudes/${r.code}/modificar/3d/${D3_SLUG[i]}`), back: () => nav(`solicitudes/${r.code}/modificar`),
      change: () => { if (modSession) modSession.newDesign = null },
      done: d => { modSession.newDesign = { config: { ...d, previews: undefined, logoFile: undefined }, previews: d.previews, logoFile: d.logoFile || null }; nav(`solicitudes/${r.code}/modificar/resumen`) },
      skip: () => nav(`solicitudes/${r.code}/modificar/resumen`)
    });
    Designer.setOptions({ allowStamp: o.item.personalizacion !== 'ninguna', stampNote: 'Este pedido es «Sin personalización»: solo puedes cambiar colores.', doneLabel: 'Revisar cambios →', backLabel: '← Categoría' });
    $('editorEyebrow').textContent = `Modificación · ${o.id}`; $('editorTitle').textContent = 'Modifica tu diseño'; $('editorReview').hidden = true;
    $('editorBack').onclick = () => nav(`solicitudes/${r.code}/modificar`);
  }
  Designer.show(r.d3);
  // En celulares el editor ocupa toda la pantalla útil: se oculta la cabecera de la página al entrar o cambiar de paso.
  if (innerWidth < 900) requestAnimationFrame(() => $('d3').scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

/* ---------- Mis solicitudes ---------- */
const LEGACY = { poloCorp: 'Polo corporativo', camisaCorp: 'Camisa corporativa', camisaSeguridad: 'Camisa de seguridad', uniformIndustrial: 'Mameluco industrial', pantalonIndustrial: 'Pantalón industrial', chaleco: 'Chaleco industrial', casaca: 'Casaca industrial', chef: 'Chaqueta chef', mandil: 'Mandil', medico: 'Uniforme médico', gorra: 'Gorra personalizada', poloSport: 'Polo deportivo', poloPersonalizado: 'Polo personalizado', poloSublimado: 'Polo sublimado', camisetaSport: 'Camiseta deportiva', uniformSchool: 'Prenda retirada del catálogo' };
// Las solicitudes de versiones anteriores de la web solo se guardaron en el navegador; se muestran sin modificarlas.
function norm(o) { if (o.item) return o; return { id: o.id, legacy: true, createdAt: o.createdAt, estado: 'local', cliente: { nombre: o.customer || '', telefono: o.phone || '', correo: o.email || '' }, item: { producto: o.productId, nombre: LEGACY[o.productId] || 'Prenda', cantidad: o.quantity, personalizacion: o.technique, tallas: {} }, estilo: o.style || 0, fechaDeseada: o.desiredDate || '', design: o.threeD && o.threeD.previews ? { versions: [{ v: 1, tipo: 'original', config: o.threeD, previews: o.threeD.previews }] } : null, modificaciones: [] } }
const lastVersion = o => o.design.versions[o.design.versions.length - 1];
function orderThumb(o) { const v = o.design && lastVersion(o), src = v && v.previews && v.previews.f ? v.previews.f : photoOf(productById(o.item.producto) || C.catalogo[o.item.producto] && { fotos: C.catalogo[o.item.producto].fotos }); return `<span class="othumb">${imgTag(src, o.item.nombre)}</span>` }
const MOD_STATE = { consulta: ['Consulta enviada · por verificar', 'warn'], solicitada: ['Solicitada · pendiente de aprobación', 'info'], aprobada: ['Aprobada', 'ok'], aplicada: ['Aplicada a producción', 'ok'], rechazada: ['No aprobada', 'bad'] };
function renderSolicitudes(r) {
  const el = $('solBody'); Store.load();
  if (!r.code) {
    const list = Store.orders().map(norm);
    el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" data-back aria-label="Regresar">←</button><h1>Mis solicitudes</h1><span class="page-head-sp"></span></div><p class="muted small">Solicitudes registradas desde este dispositivo. Aquí ves tu diseño, su historial y puedes pedir modificaciones.</p>
    <div class="olist">${list.length ? list.map(o => `<button type="button" class="ocard" data-route="solicitudes/${esc(o.id)}">${orderThumb(o)}<span><b>${esc(o.id)} · ${esc(o.item.nombre)}</b><span class="meta"><span>${new Date(o.createdAt).toLocaleDateString('es-PE')}</span><span>${o.item.cantidad} uds.</span>${o.fechaEstimada ? `<span>Entrega est. ${fmtDate(o.fechaEstimada)}</span>` : ''}</span><span class="badge ${o.legacy ? '' : 'info'}" style="margin-top:6px">${o.legacy ? 'Registro local de la versión anterior' : 'Registrada en Corpotex'}</span>${(o.modificaciones || []).length ? ` <span class="badge warn">${o.modificaciones.length} modificación(es)</span>` : ''}</span></button>`).join('') : '<div class="empty">Todavía no hay solicitudes en este dispositivo.<br/><br/><button class="btn btn-dark" type="button" data-action="new-quote">Cotizar mi prenda</button></div>'}</div>`;
    return;
  }
  const raw = Store.find(r.code); if (!raw) { el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" data-route="solicitudes" aria-label="Volver">←</button><h1>Solicitud</h1><span class="page-head-sp"></span></div><div class="empty">No encontramos la solicitud ${esc(r.code)} en este dispositivo.</div>`; return }
  const o = norm(raw);
  if (r.mod === 'resumen') return renderModSummary(o, el);
  if (r.mod) return renderModStart(o, el);
  el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" data-route="solicitudes" aria-label="Volver a mis solicitudes">←</button><div class="page-title"><span class="eyebrow-d">Solicitud</span><h1>${esc(o.id)}</h1></div><span class="page-head-sp"></span></div>
  <div class="flow wide"><div class="flow-main step-view show">
   <div class="card"><h2 class="card-t">${esc(o.item.nombre)}</h2><dl class="kv"><dt>Registrada</dt><dd>${fmtDateTime(o.createdAt)}</dd><dt>Cantidad</dt><dd>${o.item.cantidad} uds.${o.item.tallas && tallasText(o.item.tallas) ? ' · ' + tallasText(o.item.tallas) : ''}</dd><dt>Personalización</dt><dd>${esc(persLabel(o.item.personalizacion))}</dd>${o.fechaEstimada ? `<dt>Entrega estimada</dt><dd>${fmtDate(o.fechaEstimada)} (estimada)</dd>` : ''}${o.fechaDeseada ? `<dt>Fecha deseada</dt><dd>${fmtDate(o.fechaDeseada)}</dd>` : ''}<dt>Contacto</dt><dd>${esc(o.cliente.nombre)} · ${esc(o.cliente.telefono)}</dd></dl></div>
   <div class="card"><h2 class="card-t">Estado de fabricación</h2><div id="prodState" class="estimate wait">${o.legacy ? 'Esta solicitud se guardó solo en este navegador con una versión anterior de la web: no está en el sistema de Corpotex.' : 'Consultando el estado con el sistema de Corpotex…'}</div></div>
   ${o.design ? `<div class="card"><h2 class="card-t">Versiones del diseño</h2><div class="versions">${o.design.versions.map(v => `<figure class="version">${imgTag(v.previews && v.previews.f, 'Versión ' + v.v)}<figcaption><b>${v.v === 1 ? 'Original' : 'Versión ' + v.v}</b><br/><span class="badge ${v.v === 1 ? 'info' : (MOD_STATE[v.estado] || ['', ''])[1]}">${v.v === 1 ? 'Registrada' : esc((MOD_STATE[v.estado] || [v.estado])[0])}</span></figcaption></figure>`).join('')}</div><p class="muted small" style="margin-top:8px">La versión original se conserva siempre. Las modificaciones se guardan como versiones nuevas y no se aplican a producción hasta que Corpotex las apruebe.</p></div>` : ''}
   ${o.revision ? `<div class="card"><h2 class="card-t">Revisión del diseñador</h2><dl class="kv"><dt>Solicitud</dt><dd>${esc(o.revision.id)}</dd><dt>Motivo</dt><dd>${esc(o.revision.motivo)}</dd><dt>Estado</dt><dd>${esc(o.revision.estado)}</dd></dl></div>` : ''}
   ${(o.modificaciones || []).length ? `<div class="card"><h2 class="card-t">Modificaciones</h2><ul class="history">${o.modificaciones.map(m => `<li><b>${esc(m.id)} · Categoría ${m.categoria} · ${esc(m.nombreCategoria)}</b><span class="badge ${(MOD_STATE[m.estado] || ['', ''])[1]}">${esc((MOD_STATE[m.estado] || [m.estado])[0])}</span><span class="muted">${fmtDateTime(m.creada)} · ${esc(m.recargoTexto)}</span><span>${esc(m.descripcion)}</span><a class="link-btn" href="${esc(waLink(modReport(o, m)))}" target="_blank" rel="noopener noreferrer">Enviar detalle por WhatsApp ↗</a></li>`).join('')}</ul><p class="muted small" style="margin-top:8px">Ventas revisa cada modificación con el detalle que recibe por WhatsApp.</p></div>` : ''}
   <div class="notice" id="modLock" hidden></div>
   <div class="actions">${o.legacy ? '' : `<a class="btn btn-wa" id="waReport" href="${esc(waLink(orderReport(o)))}" target="_blank" rel="noopener noreferrer">Enviar reporte por WhatsApp</a>`}<button class="btn btn-dark" type="button" id="modStart" ${o.legacy ? 'disabled' : ''}>Solicitar modificación</button></div>
  </div></div>`;
  $('modStart').onclick = () => { modSession = { code: o.id, categoria: null, descripcion: '', newDesign: null }; nav(`solicitudes/${o.id}/modificar`) };
  if (!o.legacy) loadState(o).then(s => {
    const box = $('prodState'); if (!box) return; box.outerHTML = stateHTML(s, o);
    if (s.known) { const wa = $('waReport'); if (wa) wa.href = waLink(orderReport(o, s.etapa)) }
    // Con la etapa real publicada, el botón se desactiva cuando ninguna categoría de cambio sigue disponible.
    if (s.known && !C.modificaciones.categorias.some(c => availability(c, s, o.item.personalizacion).ok)) { $('modStart').disabled = true; const l = $('modLock'); l.hidden = false; l.textContent = `Tu pedido ya está en «${stageName(s.etapa)}»: en esta etapa no se pueden solicitar modificaciones. Para cualquier consulta, escribe a ventas por WhatsApp.` }
  });
}

/* ---------- Modificaciones durante la fabricación ---------- */
const stateCache = new Map();
async function loadState(o) { if (stateCache.has(o.id)) return stateCache.get(o.id); const s = C.estadoEnLinea ? await Intranet.estadoCotizacion(o.id) : { disponible: false }; const out = s.disponible ? { known: true, etapa: normStage(s.etapa), precio: s.precio } : { known: false }; stateCache.set(o.id, out); return out }
function normStage(x) { const t = String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (/entreg/.test(t)) return 'entregado'; if (/listo|termin/.test(t)) return 'listo'; if (/acabad/.test(t)) return 'acabados'; if (/bordad|dtf|sublim|estamp/.test(t)) return 'decoracion'; if (/confecc/.test(t)) return 'confeccion'; if (/corte/.test(t)) return 'corte'; if (/almac/.test(t)) return 'almacen'; if (/confirm|produc/.test(t)) return 'confirmada'; return 'registrada' }
// Recorrido por etapas según la personalización (en sublimado la tela se estampa antes del corte).
function route(pers) { const base = ['registrada', 'confirmada', 'almacen']; if (pers === 'sublimado') return [...base, 'decoracion', 'corte', 'confeccion', 'acabados', 'listo', 'entregado']; if (pers === 'ninguna') return [...base, 'corte', 'confeccion', 'acabados', 'listo', 'entregado']; return [...base, 'corte', 'confeccion', 'decoracion', 'acabados', 'listo', 'entregado'] }
const stageName = id => (C.etapas.find(e => e.id === id) || { nombre: id }).nombre;
function availability(cat, st, pers) {
  if (!st.known) return { ok: true, consulta: true };
  const r = route(pers), cur = r.indexOf(st.etapa); let lim = r.indexOf(cat.permitidoAntesDe); if (lim < 0) lim = r.indexOf('acabados');
  return cur < lim ? { ok: true } : { ok: false, reason: `No disponible: el pedido ya está en «${stageName(st.etapa)}».` };
}
function stateHTML(s, o) {
  if (!s.known) return '<div class="estimate wait" id="prodState"><b>Estado: cotización registrada.</b> El sistema de Corpotex todavía no publica en línea la etapa de fabricación de cada pedido. Puedes preparar una modificación: Corpotex verificará con la etapa real si es posible antes de aprobarla.</div>';
  const anyOk = C.modificaciones.categorias.some(c => availability(c, s, o.item.personalizacion).ok);
  return `<div class="estimate" id="prodState"><b class="date">${esc(stageName(s.etapa))}</b>${anyOk ? 'Tu pedido todavía admite modificaciones.' : 'En esta etapa ya no es posible modificar el pedido.'}</div>`;
}
function catPriceLabel(c) { return c.recargo.tipo === 'fijo' ? `Desde S/ ${c.recargo.desde}` : `+ ${c.recargo.valor} %<small>del valor del pedido</small>` }
// Comparación entre la versión base y la nueva, con la categoría mínima que exige cada cambio.
function diffDesign(a, b) {
  if (!a || !b) return []; const out = [], add = (k, label, from, to, min) => { if (String(from) !== String(to)) out.push({ k, label, from, to, min }) };
  add('tejido', 'Color del tejido', colorName(a.colores.tejido), colorName(b.colores.tejido), 3);
  add('cuello', 'Color de cuello y puños', colorName(a.colores.cuello), colorName(b.colores.cuello), 3);
  add('botones', 'Color de botones', colorName(a.colores.botones), colorName(b.colores.botones), 2);
  const ea = a.estampado || {}, eb = b.estampado || {};
  if (!!ea.logo !== !!eb.logo || (ea.logo && eb.logo && ea.logoNombre !== eb.logoNombre)) out.push({ k: 'logo', label: 'Logo', from: ea.logo ? ea.logoNombre || 'logo' : 'Sin logo', to: eb.logo ? eb.logoNombre || 'logo' : 'Sin logo', min: 2 });
  add('zona', 'Ubicación del estampado', a.ubicacion, b.ubicacion, 2);
  if (!!ea.texto !== !!eb.texto) add('texto', 'Texto', ea.texto || 'Sin texto', eb.texto || 'Sin texto', 2); else add('texto', 'Texto', ea.texto || 'Sin texto', eb.texto || 'Sin texto', 1);
  add('fuente', 'Tipografía y color del texto', `${ea.tipografia || ''} ${ea.colorTexto || ''}`.trim(), `${eb.tipografia || ''} ${eb.colorTexto || ''}`.trim(), 1);
  add('escala', 'Tamaño del logo', ea.logoAnchoCm ? `≈ ${ea.logoAnchoCm} cm` : '—', eb.logoAnchoCm ? `≈ ${eb.logoAnchoCm} cm` : '—', 1);
  const da = a.desplazamientoCm || {}, db = b.desplazamientoCm || {}; add('ajuste', 'Ajuste fino de posición', `${da.horizontal || 0} / ${da.vertical || 0} cm`, `${db.horizontal || 0} / ${db.vertical || 0} cm`, 1);
  return out;
}
async function renderModStart(o, el) {
  if (!modSession || modSession.code !== o.id) modSession = { code: o.id, categoria: null, descripcion: '', newDesign: null };
  const st = await loadState(o); if (currentRoute.code !== o.id || currentRoute.mod !== 'inicio') return;
  const cats = C.modificaciones.categorias;
  el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" data-route="solicitudes/${esc(o.id)}" aria-label="Volver a la solicitud">←</button><div class="page-title"><span class="eyebrow-d">Modificación · ${esc(o.id)}</span><h1>¿Qué quieres cambiar?</h1></div><span class="page-head-sp"></span></div>
  <div class="flow wide"><div class="flow-main step-view show">
   ${stateHTML(st, o)}
   <div class="card"><h2 class="card-t">1. Elige la categoría del cambio</h2><div class="cats">${cats.map(c => { const av = availability(c, st, o.item.personalizacion); return `<button type="button" class="cat${modSession.categoria === c.id ? ' sel' : ''}" data-cat="${c.id}" ${av.ok ? '' : 'disabled'}><span class="t"><i class="ball c${c.id}"></i>Categoría ${c.id} · ${esc(c.nombre)}</span><span class="d">${esc(c.descripcion)}</span><span class="p">${catPriceLabel(c)}</span>${av.ok ? '' : `<span class="lock">${esc(av.reason)}</span>`}</button>` }).join('')}</div>
    <p class="muted small" style="margin-top:8px">Las categorías 2 y 3 se calculan como porcentaje sobre el valor de referencia de tu pedido. Cada modificación se calcula por separado (los porcentajes no se suman entre sí) y Corpotex confirma el importe antes de aplicarla.</p></div>
   <div class="card"><label class="field"><span>2. Describe el cambio *</span><textarea id="modDesc" maxlength="800" placeholder="Ej. Corregir el texto de la espalda y mover el logo un poco más arriba.">${esc(modSession.descripcion)}</textarea></label><p class="field-err" id="err-mod" hidden></p></div>
   <div class="actions">${o.design ? `<button class="btn btn-light" type="button" id="modNoEdit">Sin cambiar el diseño</button><button class="btn btn-dark" type="button" id="modEdit">Editar el diseño en 3D →</button>` : '<button class="btn btn-dark" type="button" id="modNoEdit">Revisar la solicitud →</button>'}</div>
  </div></div>`;
  const go = edit => { const d = $('modDesc').value.trim(), e = $('err-mod'); modSession.descripcion = d; if (!modSession.categoria) { e.textContent = 'Elige una categoría de cambio.'; e.hidden = false; return } if (d.length < 10) { e.textContent = 'Describe el cambio con al menos 10 caracteres.'; e.hidden = false; return } nav(edit ? `solicitudes/${o.id}/modificar/3d/colores` : `solicitudes/${o.id}/modificar/resumen`) };
  QA('[data-cat]', el).forEach(b => b.onclick = () => { modSession.categoria = Number(b.dataset.cat); QA('[data-cat]', el).forEach(x => x.classList.toggle('sel', x === b)); $('err-mod').hidden = true });
  $('modDesc').oninput = e => { modSession.descripcion = e.target.value };
  $('modNoEdit').onclick = () => { modSession.newDesign = null; go(false) }; const ed = $('modEdit'); if (ed) ed.onclick = () => go(true);
}
async function renderModSummary(o, el) {
  const st = await loadState(o); if (currentRoute.mod !== 'resumen') return;
  const cat = C.modificaciones.categorias.find(c => c.id === modSession.categoria), base = o.design && lastVersion(o), nd = modSession.newDesign;
  const diff = nd && base ? diffDesign(base.config, nd.config) : [], minCat = diff.reduce((m, d) => Math.max(m, d.min), 1), tooLow = cat.id < minCat;
  const av = availability(cat, st, o.item.personalizacion), consulta = !st.known;
  let calc;
  if (cat.recargo.tipo === 'fijo') calc = `<div class="calc"><span>Recargo de la categoría 1</span><b>Desde S/ ${cat.recargo.desde}</b></div>`;
  else if (st.known && st.precio) { const add = st.precio * cat.recargo.valor / 100; calc = `<div class="calc"><span>Valor de referencia del pedido</span><b>${money(st.precio)}</b><span>Adicional estimado (${cat.recargo.valor} %)</span><b>${money(add)}</b><span class="tot">Total estimado actualizado</span><b class="tot">${money(st.precio + add)}</b></div>` }
  else calc = `<div class="calc"><span>Porcentaje adicional propuesto</span><b>+${cat.recargo.valor} %</b><span>Rango orientativo</span><b>${cat.recargo.rango[0]}–${cat.recargo.rango[1]} %</b><span class="tot">Importe</span><b class="tot">Pendiente de validación</b></div><p class="muted small">El sistema de Corpotex aún no comparte un valor de referencia confiable de tu pedido; ventas confirmará el importe.</p>`;
  el.innerHTML = `<div class="page-head"><button class="circle-btn" type="button" id="modBack" aria-label="Volver">←</button><div class="page-title"><span class="eyebrow-d">Modificación · ${esc(o.id)}</span><h1>Revisa tu modificación</h1></div><span class="page-head-sp"></span></div>
  <div class="flow wide"><div class="flow-main step-view show">
   ${nd ? `<div class="card"><h2 class="card-t">Antes y después</h2><div class="compare"><figure>${imgTag(base.previews && base.previews.f, 'Versión actual')}<figcaption>Versión ${base.v === 1 ? 'original' : base.v}</figcaption></figure><figure>${imgTag(nd.previews.f, 'Versión nueva')}<figcaption>Versión nueva</figcaption></figure></div></div>
   <div class="card"><h2 class="card-t">Cambios en el diseño</h2>${diff.length ? `<ul class="diff">${diff.map(d => `<li><b>${esc(d.label)}:</b> <s>${esc(d.from)}</s> → ${esc(d.to)} <span class="muted small">(cat. ${d.min}+)</span></li>`).join('')}</ul>` : '<p class="muted small">No detectamos cambios en el diseño 3D.</p>'}</div>` : ''}
   <div class="card"><h2 class="card-t">Categoría ${cat.id} · ${esc(cat.nombre)}</h2><p class="card-d">${esc(cat.descripcion)}</p>${calc}
    ${tooLow ? `<div class="alert" style="margin-top:10px">Tus cambios corresponden como mínimo a la categoría ${minCat} (por ejemplo, cambiar el color de la tela requiere la categoría 3). <button class="btn btn-light btn-sm" type="button" id="modFixCat">Elegir categoría ${minCat}</button></div>` : ''}
    ${!av.ok ? `<div class="alert" style="margin-top:10px">${esc(av.reason)}</div>` : ''}</div>
   <div class="card"><h2 class="card-t">Tu descripción</h2><p style="margin:0">${esc(modSession.descripcion)}</p></div>
   <div class="warn">${consulta ? 'Como la etapa de fabricación no está disponible en línea, se enviará como <b>consulta de modificación</b>: Corpotex verificará si es posible.' : 'La modificación quedará <b>solicitada</b> y pendiente de aprobación.'} El diseño original se conserva y la nueva versión no se aplica a producción hasta que Corpotex la apruebe.</div>
   <div class="alert" id="modMsg" hidden></div>
   <div class="actions"><button class="btn btn-light" type="button" id="modBack2">← Atrás</button><button class="btn btn-dark" type="button" id="modSend" ${tooLow || !av.ok ? 'disabled' : ''}>Enviar solicitud de modificación</button></div>
  </div></div>`;
  const back = () => nav(nd ? `solicitudes/${o.id}/modificar/3d/vista-previa` : `solicitudes/${o.id}/modificar`); $('modBack').onclick = back; $('modBack2').onclick = back;
  const fx = $('modFixCat'); if (fx) fx.onclick = () => { modSession.categoria = minCat; renderModSummary(o, el) };
  $('modSend').onclick = () => submitModification(o, cat, diff, consulta, st);
}
// Detalle de una modificación para WhatsApp de ventas.
function modReport(o, m) {
  const L = ['*SOLICITUD DE MODIFICACIÓN — CORPOTEX*', `Código de solicitud: ${o.id}`, `Modificación: ${m.id}`, `Cliente: ${o.cliente.nombre}${o.cliente.empresa ? ' · ' + o.cliente.empresa : ''}`, `Prenda: ${o.item.nombre} · ${o.item.cantidad} uds.`, `Fecha: ${fmtDateTime(m.creada)}`, '', `*Categoría ${m.categoria} · ${m.nombreCategoria}*`, `• ${m.recargoTexto}`, '', '*CAMBIOS*'];
  (m.cambios || []).forEach(d => L.push(`• ${d.campo}: ${d.antes} → ${d.despues}`)); L.push(`• Descripción: ${m.descripcion}`);
  if (m.versionNueva) L.push(`• Nueva versión del diseño: v${m.versionNueva} (la original v1 se conserva)`);
  L.push('', '*ESTADO*', m.estado === 'consulta' ? '• Consulta de modificación: por favor verifiquen si la etapa actual de fabricación lo permite.' : '• Solicitada, pendiente de aprobación. No se aplica a producción hasta su aprobación.');
  return L.join('\n');
}
function submitModification(o, cat, diff, consulta, st) {
  const raw = Store.find(o.id), nd = modSession.newDesign, now = new Date().toISOString(), n = raw.design ? raw.design.versions.length + 1 : null;
  const recargoTexto = cat.recargo.tipo === 'fijo' ? `Recargo desde S/ ${cat.recargo.desde}` : (st.known && st.precio ? `+${cat.recargo.valor} % (${money(st.precio * cat.recargo.valor / 100)} sobre ${money(st.precio)})` : `+${cat.recargo.valor} % del valor del pedido · importe pendiente de validación`);
  const m = { id: `MOD-${o.id.replace(/^COT-/, '')}-${(raw.modificaciones || []).length + 1}`, categoria: cat.id, nombreCategoria: cat.nombre, porcentaje: cat.recargo.tipo === 'porcentaje' ? cat.recargo.valor : 0, recargoTexto, descripcion: modSession.descripcion, versionBase: raw.design ? lastVersion(raw).v : null, versionNueva: nd ? n : null, cambios: diff.map(d => ({ campo: d.label, antes: d.from, despues: d.to })), estado: consulta ? 'consulta' : 'solicitada', creada: now };
  // WhatsApp se abre dentro del clic para que el navegador no lo bloquee, después de guardar el registro local.
  const ok = Store.update(raw, x => { x.modificaciones = x.modificaciones || []; x.modificaciones.push(m); if (nd) x.design.versions.push({ v: n, tipo: 'modificacion', estado: m.estado, modificacion: m.id, creado: now, config: nd.config, previews: nd.previews, logoKey: nd.logoFile ? `${o.id}:v${n}:logo` : null }) });
  if (!ok) { showMsg('modMsg', 'No se pudo guardar la modificación en este dispositivo (almacenamiento lleno o bloqueado).'); return }
  const w = window.open(waLink(modReport(o, m)), '_blank'); if (w) try { w.opener = null } catch (e) {}
  if (nd && nd.logoFile) Store.putFile(`${o.id}:v${n}:logo`, nd.logoFile).catch(() => {});
  Designer.dropContext('mod:' + o.id); modLoaded.delete('mod:' + o.id); modSession = null;
  toast(w ? `Modificación ${m.id} guardada. Pulsa «Enviar» en WhatsApp para que ventas la reciba.` : `Modificación ${m.id} guardada. Envíala a ventas con «Enviar detalle por WhatsApp».`);
  nav(`solicitudes/${o.id}`);
}

/* ---------- Asistente ---------- */
function toggleAssistant(force) { const m = $('assistantModal'), open = force ?? !m.classList.contains('open'); m.classList.toggle('open', open); if (open) $('assistantInput').focus() }
function addMsg(t, me) { const d = document.createElement('div'); d.className = 'amsg' + (me ? ' me' : ''); d.textContent = t; $('assistantMessages').appendChild(d); $('assistantMessages').scrollTop = 1e6 }
function answer(txt) {
  const m = txt.toLowerCase();
  if (/(?:cu[aá]nto|precio|costo|cotiz)/.test(m)) return 'El precio depende de la prenda, la cantidad, los materiales y la personalización. Registra tu solicitud y ventas te enviará la cotización.';
  if (/(?:plazo|entrega|cu[aá]ndo|fecha|demora)/.test(m)) return 'Al armar tu pedido te mostramos la entrega estimada según la carga real de la planta. Ventas confirma la fecha en firme.';
  if (/(?:modific|cambi)/.test(m)) return 'En «Mis solicitudes» puedes pedir una modificación de tu diseño. Según la etapa de fabricación, Corpotex verifica si es posible y su costo.';
  if (/(?:diseñ|logo|personaliz|estampa|borda|3d)/.test(m)) return 'En el polo camisero puedes diseñar en 3D: colores, logo PNG y ubicación. Si necesitas algo especial, usa «Solicitar revisión del diseñador».';
  if (/(?:polo|camisa|pantal[oó]n|chef|uniforme|mandil|chaleco|casaca|mameluco)/.test(m)) return 'Revisa el catálogo en «Productos»: cada prenda muestra su pedido mínimo, personalizaciones y entrega estimada.';
  return 'Puedo orientarte sobre prendas, diseño, plazos y modificaciones. Para atención personalizada, inicia tu solicitud y continúa por WhatsApp.';
}

/* ---------- Inicio ---------- */
function bindEvents() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action],[data-route],[data-back],[data-scroll],[data-line],[data-flowline],[data-product],[data-choose],[data-garment],[data-style],[data-gal],[data-catalog],[data-retry-estimate],[data-rmref]'); if (!a) return;
    const d = a.dataset;
    toggleMenu(false);
    if (d.action === 'new-quote') { e.preventDefault(); startQuote() }
    else if (d.route === 'inicio' && currentRoute.view === 'inicio') { e.preventDefault(); smoothTo(() => 0) }
    else if (d.route) { e.preventDefault(); nav(d.route) }
    else if (a.hasAttribute('data-back')) { e.preventDefault(); goBack('inicio') }
    else if (d.scroll) { e.preventDefault(); scrollToSection(d.scroll) }
    else if (d.line) { lineFilter = d.line; renderCatalog() }
    else if (d.catalog) { lineFilter = d.catalog; nav('catalogo') }
    else if (d.flowline) { flowLine = d.flowline; renderStep0() }
    else if (d.product) nav('producto/' + d.product);
    else if (d.choose) chooseProduct(d.choose);
    else if (d.garment) selectGarment(d.garment);
    else if (d.style) { quote.estilo = Number(d.style); quoteStarted = true; renderDesign(); renderAside(); autoSaveDraft() }
    else if (d.gal) { galleryIdx = Number(d.gal); renderProduct(currentRoute.id) }
    else if (a.hasAttribute('data-retry-estimate')) { estimate.at = 0; estimate.state = 'idle'; runEstimate() }
    else if (d.rmref) { reviewFiles.splice(Number(d.rmref), 1); renderRefList() }
  });
  $('orderStep0').addEventListener('input', syncStep0); $('orderStep0').addEventListener('change', syncStep0);
  $('toDesign').onclick = goDesign; $('designNext').onclick = designNext; $('saveOrderButton').onclick = saveQuote;
  $('flowBack').onclick = () => { const s = currentRoute.step || 0; if (savedId || s === 0) goBack('catalogo'); else nav(s === 2 ? 'cotizar/diseno' : 'cotizar/pedido') };
  $('reviewOpen').onclick = openReview; $('reviewCancel').onclick = closeReview; $('reviewForm').onsubmit = saveReview; $('reviewFiles').onchange = e => addReviewFiles([...e.target.files]);
  $('reviewSummary').addEventListener('click', e => { if (e.target.id === 'rmReview') removeReview() });
  $('editorReview').onclick = () => nav('cotizar/diseno/revision');
  $('assistantToggle').onclick = () => toggleAssistant(); $('assistantClose').onclick = () => toggleAssistant(false);
  $('menuBtn').onclick = e => { e.stopPropagation(); toggleMenu() };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('hdr').classList.contains('open')) { toggleMenu(false); $('menuBtn').focus() } });
  document.addEventListener('pointerdown', e => { if ($('hdr').classList.contains('open') && !e.target.closest('#hdr')) toggleMenu(false) });
  watchSections();
  $('assistantForm').onsubmit = e => { e.preventDefault(); const i = $('assistantInput'), t = i.value.trim(); if (!t) return; i.value = ''; addMsg(t, true); setTimeout(() => addMsg(answer(t)), 250) };
  // La altura real del encabezado alimenta los márgenes de desplazamiento (sin valores fijos por resolución).
  // Solo se escribe --hdr: el alto de la barra es --hdr-h en el CSS; si .hdr-in usara --hdr, la cabecera crecería sin fin.
  const hdr = $('hdr'), setH = () => document.documentElement.style.setProperty('--hdr', hdr.offsetHeight + 'px'); new ResizeObserver(setH).observe(hdr); setH();
  window.addEventListener('beforeunload', e => { if (quoteStarted && !savedId) { e.preventDefault(); e.returnValue = '' } });
}
function init() {
  Store.load(); document.body.classList.add('has-tabbar');
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT) || 'null'); if (d && typeof d === 'object' && 'producto' in d) { quote = { ...blankQuote(), ...d, cliente: { ...blankQuote().cliente, ...(d.cliente || {}) } }; quoteStarted = true;
    // El logo no se guarda en el borrador: si el diseño lo usaba, hay que volver a generar la vista previa.
    if (quote.threeD && quote.threeD.estampado && quote.threeD.estampado.logo) { quote.threeD = null; toast('Tu borrador se recuperó. Vuelve a subir tu logo en el editor 3D.') } else if (quote.threeD) Designer.load(quote.threeD) } } catch (e) {}
  bindEvents(); renderAside();
  nav(parseRoute(location.hash), { replace: true });
  loadCatalog().then(() => { if (quote.producto && currentRoute.view === 'cotizar') runEstimate() });
}
document.addEventListener('DOMContentLoaded', init);
