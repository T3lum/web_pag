/* Registro de «Mis solicitudes» en este dispositivo y archivos del diseño (logos y referencias) en IndexedDB.
   La cotización oficial vive en el sistema interno; aquí se guarda la copia del cliente, sus versiones de diseño
   y sus solicitudes de modificación. */
const Store = (() => {
  // Clave histórica: se conserva para no perder solicitudes guardadas por versiones anteriores de la web.
  const KEY = 'corpoFlow_Hackaton_v2';
  let data = { orders: [], settings: {} };
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); data = { orders: Array.isArray(d.orders) ? d.orders : [], settings: d.settings || {} }; } catch (e) { data = { orders: [], settings: {} }; } return data.orders; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
  const orders = () => data.orders;
  const find = id => data.orders.find(o => o.id === id);
  function add(o) { data.orders.unshift(o); if (save()) return true; data.orders.shift(); return false; }
  function update(o, mutate) { const snap = JSON.stringify(o); mutate(o); if (save()) return true; Object.assign(o, JSON.parse(snap)); return false; }

  /* ----- IndexedDB para archivos pesados (logo PNG original, referencias) ----- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB no disponible'));
      const r = indexedDB.open('corpotex', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('archivos');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function putFile(key, blob) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('archivos', 'readwrite'); tx.objectStore('archivos').put(blob, key); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); }); }
  async function getFile(key) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('archivos', 'readonly'), q = tx.objectStore('archivos').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
  return { load, save, orders, find, add, update, putFile, getFile };
})();
