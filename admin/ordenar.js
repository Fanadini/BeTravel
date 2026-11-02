// Ordenar listados haciendo clic en los encabezados de columna (sin tocar el código de cada página).
// Aplica a las tablas de listado (.lista, .data-table, .table-wrap) que no tengan su propio orden. Clic: ascendente, otra vez: descendente, otra vez: orden original.
(function(){
  var SEL = '.lista table, table.data-table, .table-wrap table';
  var ESTADO = {};   // clave de tabla -> { col, dir }
  var css = document.createElement('style');
  css.textContent = 'th.ord-th{cursor:pointer;user-select:none}th.ord-th:hover{color:var(--teal,#0F3D3E)}.ord-i{font-size:9px;margin-left:4px;color:var(--teal,#0F3D3E)}';
  document.head.appendChild(css);

  function clave(t){
    var id = t.id || (t.closest('[id]') || {}).id || '';
    var hs = [].map.call(t.tHead ? t.tHead.rows[0].cells : [], function(c){ return c.textContent.replace(/[▲▼]/g, '').trim(); }).join('|');
    return id + '#' + hs;
  }
  function ordenable(t){
    if (!t.tHead || !t.tHead.rows.length || !t.tBodies.length || !t.matches(SEL)) return false;
    var ths = t.tHead.rows[0].cells;
    for (var i = 0; i < ths.length; i++) if (ths[i].hasAttribute('onclick') || /sortable/.test(ths[i].className)) return false;   // ya tiene su propio orden
    var rows = t.tBodies[0].rows;
    for (var j = 0; j < rows.length; j++) for (var k = 0; k < rows[j].cells.length; k++) if (rows[j].cells[k].colSpan > 1) return false;   // filas de grupo o detalle
    return rows.length > 1;
  }
  function valor(td){
    if (!td) return { v: '', n: false };
    var raw = (td.getAttribute('data-sort') != null ? td.getAttribute('data-sort') : td.textContent).replace(/\s+/g, ' ').trim();
    if (!raw || /^[—–-]+$/.test(raw)) return { v: null };
    var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return { v: new Date(+m[3], +m[2] - 1, +m[1]).getTime(), n: true };
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return { v: Date.parse(raw.slice(0, 10)), n: true };
    var num = raw.replace(/^(US\$|U\$S|USD|ARS|\$|€)\s*/i, '').replace(/\s*(USD|ARS|%)$/i, '');
    if (/^-?[\d.]+(,\d+)?$/.test(num) && /\d/.test(num)) return { v: parseFloat(num.replace(/\./g, '').replace(',', '.')), n: true };
    if (/^-?\d+(\.\d+)?$/.test(num)) return { v: parseFloat(num), n: true };
    return { v: raw.toLowerCase(), n: false };
  }
  function pintar(t, col, dir){
    [].forEach.call(t.tHead.rows[0].cells, function(th, i){
      var s = th.querySelector('.ord-i'); if (s) s.remove();
      if (i === col && dir) { var e = document.createElement('span'); e.className = 'ord-i'; e.textContent = dir === 1 ? '▲' : '▼'; th.appendChild(e); }
    });
  }
  function aplicar(t, col, dir){
    var tb = t.tBodies[0], rows = [].slice.call(tb.rows);
    rows.forEach(function(r, i){ if (r.__ordI == null) r.__ordI = i; });
    var items = rows.map(function(r){ return { r: r, x: valor(r.cells[col]) }; });
    items.sort(function(a, b){
      if (!dir) return a.r.__ordI - b.r.__ordI;
      var va = a.x.v, vb = b.x.v;
      if (va === null && vb === null) return a.r.__ordI - b.r.__ordI;
      if (va === null) return 1;            // vacíos siempre al final
      if (vb === null) return -1;
      if (a.x.n !== b.x.n) return a.x.n ? -1 : 1;
      var c = a.x.n ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true });
      return c ? c * dir : a.r.__ordI - b.r.__ordI;
    });
    parar();
    items.forEach(function(it){ tb.appendChild(it.r); });
    pintar(t, col, dir);
    arrancar();
  }
  function marcar(){
    [].forEach.call(document.querySelectorAll(SEL), function(t){
      if (!ordenable(t)) return;
      var ths = t.tHead.rows[0].cells;
      [].forEach.call(ths, function(th){ if (th.textContent.trim() && !th.classList.contains('no-ord')){ th.classList.add('ord-th'); th.title = th.title || 'Clic para ordenar'; } });
      var k = clave(t), st = ESTADO[k];
      if (st && st.dir && (!t.querySelector('.ord-i') || t.tBodies[0].rows[0].__ordI == null)) aplicar(t, st.col, st.dir);
    });
  }
  document.addEventListener('click', function(e){
    var th = e.target.closest && e.target.closest('th.ord-th'); if (!th) return;
    var t = th.closest('table'); if (!t || !ordenable(t)) return;
    var col = th.cellIndex, k = clave(t), st = ESTADO[k] || { col: -1, dir: 0 };
    var dir = st.col === col ? (st.dir === 1 ? -1 : st.dir === -1 ? 0 : 1) : 1;
    ESTADO[k] = { col: col, dir: dir };
    aplicar(t, col, dir);
  });
  var obs = new MutationObserver(function(){ if (!obs.__p) { obs.__p = true; requestAnimationFrame(function(){ obs.__p = false; marcar(); }); } });
  function arrancar(){ obs.observe(document.body, { childList: true, subtree: true }); }
  function parar(){ obs.disconnect(); }
  arrancar(); marcar();
})();
