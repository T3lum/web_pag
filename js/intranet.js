/* Cliente de los servicios públicos del sistema interno de Corpotex (ver PARA-EQUIPO-WEB.md).
   La web no calcula plazos ni crea pedidos: pide la estimación y registra cotizaciones. */
const Intranet = (() => {
  const C = window.CORPOTEX_CONFIG;
  const base = C.intranetUrl.replace(/\/+$/, '');
  class IntranetError extends Error { constructor(msg, status, offline) { super(msg); this.status = status; this.offline = !!offline; } }

  async function request(path, opts = {}) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), C.intranetTimeoutMs);
    let res;
    try { res = await fetch(base + path, { ...opts, signal: ctrl.signal }); }
    catch (e) { throw new IntranetError('No se pudo conectar con el sistema de Corpotex. Revisa tu conexión e inténtalo de nuevo.', 0, true); }
    finally { clearTimeout(t); }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json().catch(() => null) : null;
    if (!res.ok) throw new IntranetError((data && data.error) || `El sistema de Corpotex respondió con un error (${res.status}).`, res.status, false);
    if (data === null) throw new IntranetError('Respuesta inesperada del sistema de Corpotex.', res.status, false);
    return data;
  }
  const post = (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // Lista viva de productos. Se guarda una copia para poder mostrar el catálogo si la conexión falla un momento.
  const CACHE = 'corpotex_productos_v1';
  async function productos() {
    try {
      const list = await request('/api/productos');
      if (!Array.isArray(list)) throw new IntranetError('Lista de productos no válida.', 200, false);
      try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), list })); } catch (e) {}
      return { list, cached: false };
    } catch (e) {
      try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && Array.isArray(c.list)) return { list: c.list, cached: true, error: e }; } catch (x) {}
      throw e;
    }
  }

  // Fecha estimada según la carga real de la planta. No guarda nada; se vuelve a pedir antes de registrar.
  const estimar = items => post('/api/estimar', { items });
  const crearCotizacion = payload => post('/api/cotizaciones', payload);
  async function subirDiseno(codigo, blob, nombre) {
    const fd = new FormData(); fd.append('archivo', blob, nombre);
    return request(`/api/cotizaciones/${encodeURIComponent(codigo)}/diseno`, { method: 'POST', body: fd });
  }
  // Etapa de fabricación de una cotización: { estado, etapa, precio_confirmado, fecha_comprometida, cambios }.
  async function estadoCotizacion(codigo, clave) {
    // Sin la clave que se entregó al registrar no se puede consultar (solicitudes anteriores a ese cambio).
    if (!clave) return { disponible: false };
    try {
      const d = await request(`/api/cotizaciones/${encodeURIComponent(codigo)}?clave=${encodeURIComponent(clave)}`);
      return { disponible: true, etapa: d.etapa || d.estado || null, precio: Number(d.precio_confirmado) || null, raw: d };
    } catch (e) { return { disponible: false, error: e }; }
  }
  return { productos, estimar, crearCotizacion, subirDiseno, estadoCotizacion, IntranetError, base };
})();
