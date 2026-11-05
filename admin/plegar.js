// Tarjetas plegables: cualquier ".item-card" con encabezado (".item-card-header") se puede plegar y desplegar.
// Buena práctica del sistema: toda tarjeta repetible (pagos, reparto, facturas, comprobantes, documentos…) la tiene.
//  - Clic en la flecha ▾/▸ o en el título: pliega/despliega. Plegada queda una línea con un resumen de sus datos.
//  - Arriba de cada lista de 2 o más tarjetas aparecen "Plegar todos · Desplegar todos" (y `PlegarCards.todos(raiz, plegar)` permite un control general).
//  - El estado plegado se recuerda mientras la página está abierta, aunque la lista se vuelva a dibujar.
// Las tarjetas que ya traen su propia flecha (".pleg-t") no se tocan.
(function(){
  var PLEGADAS = {};
  var css = document.createElement('style');
  css.textContent = '.item-card.plegado > :not(.item-card-header){display:none}.item-card.plegado .item-card-header{margin-bottom:0}'
    + '.item-card-sum{display:none;flex:3;font-size:12px;margin:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.item-card.plegado .item-card-sum{display:block}.item-card.plegado .item-card-label{flex:0 0 auto}'
    + '.pleg-g{cursor:pointer;user-select:none}.pleg-chev{color:var(--teal,#0F3D3E);padding:0 6px 0 2px}'
    + '.pleg-ctl{font-size:12px;margin:0 0 6px}.pleg-ctl a{color:var(--teal,#0F3D3E);cursor:pointer;text-decoration:underline}';
  document.head.appendChild(css);

  function fmtVal(el){
    if (el.tagName === 'SELECT') return el.selectedIndex >= 0 ? el.options[el.selectedIndex].text.trim() : '';
    var v = (el.value || '').trim(); if (!v) return '';
    if (el.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(8) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4);
    if (el.type === 'number' && isFinite(+v)) return (+v).toLocaleString('de-DE', { maximumFractionDigits: 2 });
    return v;
  }
  function resumen(card){
    var out = [];
    [].forEach.call(card.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), select, textarea'), function(el){
      if (out.length >= 5 || el.closest('.item-card-header')) return;
      var t = fmtVal(el); if (t && out.indexOf(t) < 0) out.push(t.length > 40 ? t.slice(0, 40) + '…' : t);
    });
    return out.join(' · ') || 'Sin datos';
  }
  function pintar(card){
    if (card.classList.contains('pleg-propio')){ if (window.resumenItem) window.resumenItem(card); return; }   // tarjetas con su propia flecha
    var pl = card.classList.contains('plegado'), ch = card.querySelector('.pleg-chev'), sum = card.querySelector('.item-card-sum');
    if (ch) ch.textContent = pl ? '▸' : '▾';
    if (sum && pl) sum.textContent = resumen(card);
    var id = card.getAttribute('data-row-id'); if (id) PLEGADAS[id] = pl;
  }
  function preparar(card){
    var head = card.querySelector(':scope > .item-card-header'); if (!head || card.classList.contains('plegable')) return;
    if (card.querySelector('.pleg-t')){ card.classList.add('plegable', 'pleg-propio'); return; }
    card.classList.add('plegable');
    var label = head.querySelector('.item-card-label'), ch = document.createElement('span');
    ch.className = 'pleg-chev pleg-g'; ch.title = 'Plegar / desplegar'; ch.textContent = '▾';
    var drag = head.querySelector('.drag-h');
    if (drag) drag.insertAdjacentElement('afterend', ch); else head.insertBefore(ch, head.firstChild);
    if (label){ label.classList.add('pleg-g'); var sum = document.createElement('span'); sum.className = 'item-card-sum pleg-g'; label.insertAdjacentElement('afterend', sum); }
    var id = card.getAttribute('data-row-id'); if (id && PLEGADAS[id]) card.classList.add('plegado');
    pintar(card);
  }
  function controles(){
    var vistos = new Set();
    [].forEach.call(document.querySelectorAll('.item-card.plegable'), function(c){ var p = c.parentElement; if (p) vistos.add(p); });
    vistos.forEach(function(p){
      var n = p.querySelectorAll(':scope > .item-card.plegable').length, sig = p.previousElementSibling, tiene = sig && sig.classList && sig.classList.contains('pleg-ctl');
      if (n >= 2 && !tiene){
        var d = document.createElement('div'); d.className = 'pleg-ctl';
        d.innerHTML = '<a data-pleg-all="1">Plegar todos</a> · <a data-pleg-all="0">Desplegar todos</a>';
        p.insertAdjacentElement('beforebegin', d);
      } else if (n < 2 && tiene) sig.remove();
    });
    [].forEach.call(document.querySelectorAll('.pleg-ctl'), function(d){ var p = d.nextElementSibling; if (!p || !p.querySelector(':scope > .item-card.plegable')) d.remove(); });
  }
  function barrer(){ obs.disconnect(); [].forEach.call(document.querySelectorAll('.item-card'), preparar); controles(); arrancar(); }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('[data-pleg-all]');
    if (a){ var p = a.parentElement.nextElementSibling; if (!p) return; var v = a.getAttribute('data-pleg-all') === '1';
      [].forEach.call(p.querySelectorAll(':scope > .item-card.plegable'), function(c){ c.classList.toggle('plegado', v); pintar(c); }); return; }
    var g = e.target.closest && e.target.closest('.pleg-g'); if (!g) return;
    var card = g.closest('.item-card'); if (!card) return;
    card.classList.toggle('plegado'); pintar(card);
  });
  // Control general: pliega o despliega todas las tarjetas dentro de un contenedor (por ejemplo, el panel de una reserva)
  window.PlegarCards = { todos: function(raiz, v){
    obs.disconnect(); barrer();
    [].forEach.call((typeof raiz === 'string' ? document.querySelector(raiz) : raiz).querySelectorAll('.item-card.plegable'), function(c){ c.classList.toggle('plegado', !!v); pintar(c); });
    arrancar();
  } };
  var pend = false, obs = new MutationObserver(function(){ if (!pend){ pend = true; requestAnimationFrame(function(){ pend = false; barrer(); }); } });
  function arrancar(){ obs.observe(document.body, { childList: true, subtree: true }); }
  arrancar(); barrer();
})();
