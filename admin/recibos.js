/* Creador de recibos de Gestión interna (pestaña "Recibos").
 *
 * Se carga después del script principal de gestioninterna.html y usa sus globales: db, STATE, CURRENT_USER, escHtml, switchTab, closeReserva.
 * Los recibos se guardan en finanzas/recibos/{id}; el número sale de un contador (finanzas/meta/reciboCounter, formato R-0001).
 * "Recibí de" se arma con los datos de la reserva: cliente, pasajeros asociados (finanzas/pasajeros) y pasajeros del grupo vinculado (grupos/{token}/respuestas).
 * El PDF se genera con la impresión del navegador (Guardar como PDF), igual que los contratos: el nombre del archivo sale del título de la página.
 */
(function(){
  'use strict';
  var RCB = null;           // editor abierto: { id, data, grupoPax:[], grupoId }
  var RCB_Q = '';           // búsqueda en la lista
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return escHtml(s); };
  var hoy = function(){ return new Date().toISOString().slice(0, 10); };
  var fmtFechaR = function(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || ''); };
  var num = function(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var montoTxt = function(n){ return (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 }); };
  var MONEDAS = { USD:{ sigla:'USD', nombre:'dólares estadounidenses' }, ARS:{ sigla:'ARS', nombre:'pesos argentinos' } };
  var moneda = function(m){ return MONEDAS[m] || MONEDAS.USD; };

  // ── Importe en letras ────────────────────────────────────────────────────
  var U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  var C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function menor1000(n){
    if (n === 100) return 'cien';
    var s = '', c = Math.floor(n / 100), r = n % 100;
    if (c) s += C[c] + (r ? ' ' : '');
    if (r < 30) s += U[r]; else { var d = Math.floor(r / 10), u = r % 10; s += D[d] + (u ? ' y ' + U[u] : ''); }
    return s;
  }
  var apocope = function(s){ return s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un'); };
  function enteroALetras(n){
    if (n === 0) return 'cero';
    var mill = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1e3), res = n % 1e3, s = '';
    if (mill) s += mill === 1 ? 'un millón' : apocope(enteroALetras(mill)) + ' millones';
    if (mil) s += (s ? ' ' : '') + (mil === 1 ? 'mil' : apocope(menor1000(mil)) + ' mil');
    if (res) s += (s ? ' ' : '') + menor1000(res);
    return s;
  }
  function montoEnLetras(monto, mon){
    var cent = Math.round((Number(monto) || 0) * 100), ent = Math.floor(cent / 100), dec = cent % 100;
    return moneda(mon).nombre + ' ' + enteroALetras(ent) + ' con ' + String(dec).padStart(2, '0') + '/100';
  }

  // ── Documento (mismo formato que la plantilla de BETRAVEL) ────────────────
  var CSS_REC = [
    '.rcb{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;line-height:1.35}',
    '.rcb *{box-sizing:border-box}',
    '.rcb .box{border:1px solid #000}',
    '.rcb .top-title{text-align:center;font-size:18px;font-weight:bold;letter-spacing:2px;padding:8px 0;border-bottom:1px solid #000}',
    '.rcb table{width:100%;border-collapse:collapse}',
    '.rcb table.header-table td{border:1px solid #000;vertical-align:middle;padding:10px 14px}',
    '.rcb .brand-cell{width:40%;font-size:20px;font-weight:bold}',
    '.rcb .doc-title-cell{width:60%;text-align:right}',
    '.rcb .doc-title{font-size:26px;font-weight:bold;letter-spacing:1px}',
    '.rcb .doc-subtitle{font-size:11px;margin-top:4px}',
    '.rcb table.fields-table{margin-top:-1px}',
    '.rcb table.fields-table td{border:1px solid #000;padding:8px 14px}',
    '.rcb .label{font-size:10px;color:#333;display:block;margin-bottom:2px}',
    '.rcb .value{font-weight:bold;font-size:13px}',
    '.rcb .doc{font-weight:normal;font-size:11px;display:block;margin-top:2px}',
    '.rcb table.items-table{margin-top:-1px}',
    '.rcb table.items-table th{border:1px solid #000;background:#f2f2f2;padding:8px 10px;font-size:10.5px;text-align:left}',
    '.rcb table.items-table td{border:1px solid #000;padding:10px;vertical-align:top;font-size:12px}',
    '.rcb .col-desc{width:62%}.rcb .col-qty{width:10%;text-align:center}.rcb .col-unit{width:12%;text-align:center}.rcb .col-amount{width:16%;text-align:right}',
    '.rcb .total-row td{font-weight:bold;font-size:13px;padding:10px}',
    '.rcb .total-label,.rcb .total-amount{text-align:right}',
    '.rcb .footer-note{margin-top:24px;padding:0 10px;font-size:11px;line-height:1.5}',
    '.rcb .obs{margin-top:12px;padding:0 10px;font-size:11px}',
    '.rcb .signature-block{margin:60px 10px 24px;display:flex;justify-content:space-between}',
    '.rcb .signature-line{width:45%;text-align:center}',
    '.rcb .signature-line .line{border-top:1px solid #000;margin-bottom:4px;padding-top:4px}',
    '.rcb-hoja{page-break-after:always;break-after:page}.rcb-hoja:last-child{page-break-after:auto;break-after:auto}'
  ].join('\n');
  function reciboHtml(d, copia){
    var m = moneda(d.moneda), items = (d.items || []).filter(function(i){ return i.desc || num(i.monto); });
    var total = items.reduce(function(s, i){ return s + num(i.monto); }, 0), tot = m.sigla + ' ' + montoTxt(total);
    var filas = (items.length ? items : [{ desc:'', cant:'', unidad:'', monto:0 }]).map(function(i){
      return '<tr><td class="col-desc">' + esc(i.desc) + '</td><td class="col-qty">' + esc(i.cant || '') + '</td><td class="col-unit">' + esc(i.unidad || '') + '</td><td class="col-amount">' + (num(i.monto) ? montoTxt(i.monto) : '—') + '</td></tr>';
    }).join('');
    var quien = esc(d.recibiDe || '………………………………');
    return '<div class="rcb"><div class="box">'
      + '<div class="top-title">' + esc(copia || 'ORIGINAL') + '</div>'
      + '<table class="header-table"><tr><td class="brand-cell">BETRAVEL</td><td class="doc-title-cell"><div class="doc-title">RECIBO</div><div class="doc-subtitle">Recibo de dinero por servicios</div></td></tr></table>'
      + '<table class="fields-table"><tr>'
      + '<td style="width:33%"><span class="label">N° de Recibo</span><span class="value">' + esc(d.numero || 'R-XXXX') + '</span></td>'
      + '<td style="width:33%"><span class="label">Fecha de Emisión</span><span class="value">' + esc(fmtFechaR(d.fecha)) + '</span></td>'
      + '<td style="width:34%"><span class="label">Moneda</span><span class="value">' + esc(m.sigla) + '</span></td></tr>'
      + '<tr><td colspan="2"><span class="label">Recibí de</span><span class="value">' + quien + '</span>' + (d.documento ? '<span class="doc">' + esc(d.documento) + '</span>' : '') + '</td>'
      + '<td><span class="label">En concepto de</span><span class="value">' + esc(d.concepto || 'Servicios turísticos') + '</span></td></tr></table>'
      + '<table class="items-table"><tr><th class="col-desc">Detalle</th><th class="col-qty">Cant.</th><th class="col-unit">Unidad</th><th class="col-amount">Monto ' + esc(m.sigla) + '</th></tr>' + filas
      + '<tr class="total-row"><td colspan="3" class="total-label">TOTAL RECIBIDO</td><td class="total-amount">' + esc(tot) + '</td></tr></table>'
      + '<div class="footer-note">Recibimos de ' + quien + ' la suma de ' + esc(montoEnLetras(total, d.moneda)) + ' (' + esc(tot) + ') en concepto de pago por los servicios detallados precedentemente, gestionados por BETRAVEL.</div>'
      + (d.observaciones ? '<div class="obs"><strong>Observaciones:</strong> ' + esc(d.observaciones) + '</div>' : '')
      + '<div class="signature-block"><div class="signature-line"><div class="line">Firma y aclaración – BETRAVEL</div></div><div class="signature-line"><div class="line">Firma del cliente (conformidad)</div></div></div>'
      + '</div></div>';
  }

  // ── Datos de apoyo ────────────────────────────────────────────────────────
  var reservaDe = function(id){ return STATE.reservas.find(function(r){ return r.id === id; }); };
  var arr = function(o){ return typeof objToArr === 'function' ? objToArr(o) : (o ? Object.keys(o).map(function(k){ return Object.assign({ id:k }, o[k]); }) : []); };
  function nombrePax(p){ return ((p.nombre || '') + ' ' + (p.apellido || '')).trim(); }
  function docPax(tipo, numero){ return numero ? (tipo === 'dni' ? 'DNI ' : tipo === 'pasaporte' ? 'Pasaporte ' : 'Doc. ') + numero : ''; }
  function opcionesRecibiDe(){
    var r = RCB && reservaDe(RCB.data.reservaId), out = [];
    if (!r) return out;
    if (r.cliente) out.push({ g:'Cliente de la reserva', k:'c', n:r.cliente, d:'' });
    Object.keys(r.pasajeroIds || {}).forEach(function(pid){
      var p = STATE.pasajeros.find(function(x){ return x.id === pid; }); if (!p) return;
      out.push({ g:'Pasajeros de la reserva', k:'p' + pid, n:nombrePax(p), d:docPax(p.tipoDocumento, p.numero) });
    });
    (RCB.grupoPax || []).forEach(function(p){ out.push({ g:'Pasajeros del grupo', k:'g' + p.rid, n:p.n, d:p.d }); });
    return out;
  }
  function cargarGrupoPax(){
    var r = RCB && reservaDe(RCB.data.reservaId), gid = r && r.grupoId;
    if (!gid || RCB.grupoId === gid) return;
    RCB.grupoId = gid; RCB.grupoPax = [];
    db.ref('grupos/' + gid + '/respuestas').once('value').then(function(s){
      if (!RCB || RCB.grupoId !== gid) return;
      var v = s.val() || {};
      RCB.grupoPax = Object.keys(v).map(function(k){ var x = v[k]; return { rid:k, n:nombrePax(x), d: x.pasaporte ? 'Pasaporte ' + x.pasaporte : '' }; }).sort(function(a, b){ return a.n.localeCompare(b.n, 'es'); });
      // si el recibo nació de un pago y el nombre no se tocó, completar con los pasajeros que pagaron
      if (RCB.auto && RCB.data.pagoId){ var rv = reservaDe(RCB.data.reservaId), pg = rv && arr(rv.pagos).find(function(x){ return x.id === RCB.data.pagoId; }), q = pg && nombresDe(pg); if (q){ RCB.data.recibiDe = q.texto; RCB.data.documento = q.doc || ''; } }
      pintarEditor(true);
    }, function(){ });
  }
  function nombresDePago(p, r){
    var ks = Object.keys(p.grupoPasajeros || {});
    if (!ks.length) return null;
    var porRid = {}; (RCB.grupoPax || []).forEach(function(x){ porRid[x.rid] = x; });
    var nombres = ks.map(function(k){ return porRid[k] ? porRid[k].n : null; }).filter(Boolean);
    return nombres.length ? { texto: nombres.join(', '), doc: nombres.length === 1 ? porRid[ks.filter(function(k){ return porRid[k]; })[0]].d : '' } : null;
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  function renderRecibos(){
    var cont = $('rcb-lista'); if (!cont) return;
    var edit = $('rcb-editor');
    cont.style.display = RCB ? 'none' : '';
    var cab = $('rcb-head'); if (cab) cab.style.display = RCB ? 'none' : '';
    edit.style.display = RCB ? '' : 'none';
    if (RCB) return;
    var q = RCB_Q.toLowerCase();
    var lista = (STATE.recibos || []).slice().sort(function(a, b){ return String(b.numero || '').localeCompare(String(a.numero || ''), 'es', { numeric:true }); });
    if (q) lista = lista.filter(function(r){ return [r.numero, r.recibiDe, r.concepto, (reservaDe(r.reservaId) || {}).codigo, (reservaDe(r.reservaId) || {}).cliente].join(' ').toLowerCase().indexOf(q) !== -1; });
    var admin = CURRENT_USER.rol === 'admin';
    cont.innerHTML = '<div class="section-head" style="margin-bottom:8px"><input class="fi" style="max-width:320px" placeholder="Buscar por número, nombre o reserva…" value="' + esc(RCB_Q) + '" oninput="rcbBuscar(this.value)"><span style="font-size:11px;color:rgba(43,43,43,.5)">' + lista.length + ' recibo' + (lista.length === 1 ? '' : 's') + '</span></div>'
      + (lista.length ? '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Recibí de</th><th>Reserva</th><th>Concepto</th><th style="text-align:right">Total</th><th></th></tr></thead><tbody>' + lista.map(function(r){
        var t = (r.items || []).reduce(function(s, i){ return s + num(i.monto); }, 0), rv = reservaDe(r.reservaId);
        return '<tr onclick="rcbAbrir(\'' + esc(r.id) + '\')"><td><strong>' + esc(r.numero || '—') + '</strong></td><td>' + esc(fmtFechaR(r.fecha)) + '</td><td>' + esc(r.recibiDe) + '</td><td>' + esc(rv ? (rv.codigo || rv.cliente) : '—') + '</td><td>' + esc(r.concepto) + '</td><td style="text-align:right">' + esc(moneda(r.moneda).sigla + ' ' + montoTxt(t)) + '</td>'
          + '<td style="white-space:nowrap" onclick="event.stopPropagation()"><button class="new-btn outline" style="padding:4px 10px" onclick="rcbPdfDe(\'' + esc(r.id) + '\')">PDF</button>' + (admin ? ' <button class="new-btn outline" style="padding:4px 10px;color:var(--red)" onclick="rcbEliminar(\'' + esc(r.id) + '\')">Eliminar</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="table-empty" style="padding:30px;text-align:center;font-size:12px;color:rgba(43,43,43,.5)">Todavía no hay recibos. Creá uno con "+ Nuevo recibo" o desde un pago de una reserva.</div>');
  }
  window.rcbBuscar = function(v){ RCB_Q = v; var c = $('rcb-lista'); var inp = c.querySelector('input'); renderRecibos(); var n = c.querySelector('input'); if (n){ n.focus(); n.setSelectionRange(v.length, v.length); } };

  // ── Editor ────────────────────────────────────────────────────────────────
  function datosNuevos(opts){
    var d = { numero:'', fecha:hoy(), moneda:'USD', recibiDe:'', documento:'', concepto:'Servicios turísticos', items:[{ id:'i' + Date.now(), desc:'', cant:'1', unidad:'servicio', monto:'' }], observaciones:'', copias:'doble', reservaId:'', pagoId:'' };
    return Object.assign(d, opts || {});
  }
  window.nuevoRecibo = function(opts){
    RCB = { id:null, data: datosNuevos(opts), grupoPax:[], grupoId:null };
    if (opts && opts.reservaId) aplicarReserva(opts.reservaId, true);
    if (opts && opts.pagoId){ aplicarPago(opts.pagoId); RCB.auto = true; }
    switchTab('recibos'); renderRecibos(); pintarEditor(false); cargarGrupoPax();
  };
  window.rcbAbrir = function(id){
    var r = STATE.recibos.find(function(x){ return x.id === id; }); if (!r) return;
    var d = JSON.parse(JSON.stringify(r)); delete d.id;
    d.items = arr(d.items);
    RCB = { id:id, data:d, grupoPax:[], grupoId:null };
    renderRecibos(); pintarEditor(false); cargarGrupoPax();
  };
  window.rcbCerrar = function(){ RCB = null; renderRecibos(); };
  function aplicarReserva(id, soloDefaults){
    var r = reservaDe(id), d = RCB.data; d.reservaId = id || '';
    if (!r) return;
    d.moneda = r.moneda === 'ARS' ? 'ARS' : 'USD';
    if (!d.recibiDe) d.recibiDe = r.cliente || '';
    d.concepto = 'Servicios turísticos' + (r.concepto ? ' – ' + r.concepto : '') + (r.codigo ? ' (' + r.codigo + ')' : '');
    RCB.grupoId = null; RCB.grupoPax = [];
  }
  function aplicarPago(pagoId){
    var r = reservaDe(RCB.data.reservaId); if (!r) return;
    var p = arr(r.pagos).find(function(x){ return x.id === pagoId; }); if (!p) return;
    var d = RCB.data;
    d.pagoId = pagoId; d.moneda = p.moneda === 'ARS' ? 'ARS' : 'USD';
    var q = nombresDe(p);
    if (q){ d.recibiDe = q.texto; d.documento = q.doc || ''; }
    d.items = [{ id:'i' + Date.now(), desc:'Pago a cuenta – ' + (r.concepto || 'servicios turísticos') + (p.fecha ? ' (pago del ' + fmtFechaR(p.fecha) + (p.medio ? ', ' + p.medio : '') + ')' : ''), cant:'1', unidad:'servicio', monto: Number(p.monto) || '' }];
  }
  function nombresDe(p){ var r = nombresDePago(p, null); return r; }
  function recibosDePago(pid){ return (STATE.recibos || []).filter(function(x){ return x.pagoId === pid; }); }

  function pintarEditor(conservarFoco){
    var box = $('rcb-editor'); if (!RCB || !box) return;
    var d = RCB.data, r = reservaDe(d.reservaId), opts = opcionesRecibiDe();
    var focoId = conservarFoco && document.activeElement && document.activeElement.id;
    var grupos = {}; opts.forEach(function(o){ (grupos[o.g] = grupos[o.g] || []).push(o); });
    var pagos = r ? arr(r.pagos).sort(function(a, b){ return String(b.fecha || '').localeCompare(String(a.fecha || '')); }) : [];
    box.innerHTML = '<div class="section-head"><h2>' + (RCB.id ? 'Recibo ' + esc(d.numero) : 'Nuevo recibo') + '</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="new-btn outline" onclick="rcbCerrar()">← Volver a la lista</button>'
      + '<button class="new-btn" onclick="rcbGuardar()">Guardar</button><button class="new-btn" onclick="rcbPdf()">Descargar PDF</button></div></div>'
      + '<div class="rcb-grid"><div class="rcb-form">'
      + '<div class="psec"><div class="psec-title">Reserva</div><div class="frow"><select class="fsel" id="rcb-reserva" onchange="rcbReserva(this.value)"><option value="">Sin reserva (cargar a mano)</option>'
      + STATE.reservas.slice().sort(function(a, b){ return String(b.codigo || '').localeCompare(String(a.codigo || ''), 'es', { numeric:true }); }).map(function(x){ return '<option value="' + esc(x.id) + '" ' + (x.id === d.reservaId ? 'selected' : '') + '>' + esc((x.codigo || '—') + ' · ' + (x.cliente || '') + ' · ' + (x.concepto || '')) + '</option>'; }).join('') + '</select></div>'
      + (pagos.length ? '<div class="upload-hint" style="margin-bottom:6px">Armar el recibo a partir de un pago ya registrado:</div>' + pagos.map(function(p){
          var q = nombresDe(p), prev = recibosDePago(p.id);
          return '<div class="rcb-pago"><div><strong>' + esc(moneda(p.moneda || (r && r.moneda)).sigla + ' ' + montoTxt(p.monto)) + '</strong> · ' + esc(fmtFechaR(p.fecha) || 's/f') + (p.medio ? ' · ' + esc(p.medio) : '') + '<div class="upload-hint" style="margin:0">' + (q ? esc(q.texto) : 'Sin pasajeros asignados') + (prev.length ? ' · <strong>ya tiene recibo ' + esc(prev.map(function(x){ return x.numero; }).join(', ')) + '</strong>' : '') + '</div></div><button type="button" class="new-btn outline" style="padding:4px 10px" onclick="rcbPago(\'' + esc(p.id) + '\')' + '">' + (d.pagoId === p.id ? 'En uso' : 'Usar') + '</button></div>';
        }).join('') : (r ? '<div class="upload-hint">Esta reserva todavía no tiene pagos registrados.</div>' : '')) + '</div>'
      + '<div class="psec"><div class="psec-title">Recibí de</div>'
      + (opts.length ? '<div class="frow"><select class="fsel" onchange="rcbQuien(this.value)"><option value="">Elegir de la reserva o del grupo…</option>' + Object.keys(grupos).map(function(g){ return '<optgroup label="' + esc(g) + '">' + grupos[g].map(function(o){ return '<option value="' + esc(o.k) + '">' + esc(o.n + (o.d ? ' — ' + o.d : '')) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></div>' : '')
      + '<div class="frow"><label class="fl">Nombre y apellido / razón social</label><input class="fi" id="rcb-quien" value="' + esc(d.recibiDe) + '" oninput="rcbCampo(\'recibiDe\',this.value)"></div>'
      + '<div class="frow"><label class="fl">Documento (opcional, se muestra debajo del nombre)</label><input class="fi" id="rcb-doc" value="' + esc(d.documento) + '" placeholder="Ej: DNI 30.123.456" oninput="rcbCampo(\'documento\',this.value)"></div></div>'
      + '<div class="psec"><div class="psec-title">Datos del recibo</div><div class="frow2"><div><label class="fl">N° de recibo</label><input class="fi" value="' + esc(d.numero || 'Se asigna al guardar') + '" disabled></div>'
      + '<div><label class="fl">Fecha de emisión</label><input class="fi" type="date" value="' + esc(d.fecha) + '" oninput="rcbCampo(\'fecha\',this.value)"></div></div>'
      + '<div class="frow2"><div><label class="fl">Moneda</label><select class="fsel" onchange="rcbCampo(\'moneda\',this.value)"><option ' + (d.moneda !== 'ARS' ? 'selected' : '') + '>USD</option><option ' + (d.moneda === 'ARS' ? 'selected' : '') + '>ARS</option></select></div>'
      + '<div><label class="fl">Copias al descargar</label><select class="fsel" onchange="rcbCampo(\'copias\',this.value)"><option value="doble" ' + (d.copias !== 'simple' ? 'selected' : '') + '>Original y duplicado</option><option value="simple" ' + (d.copias === 'simple' ? 'selected' : '') + '>Solo original</option></select></div></div>'
      + '<div class="frow"><label class="fl">En concepto de</label><input class="fi" value="' + esc(d.concepto) + '" oninput="rcbCampo(\'concepto\',this.value)"></div></div>'
      + '<div class="psec"><div class="psec-title">Detalle</div>' + d.items.map(function(it, i){
          return '<div class="item-card"><div class="item-card-header"><span class="item-card-label">Ítem ' + (i + 1) + '</span>' + (d.items.length > 1 ? '<button type="button" class="item-delete-btn" onclick="rcbQuitarItem(' + i + ')">✕</button>' : '') + '</div>'
            + '<div class="frow"><input class="fi" id="rcb-i-' + i + '-desc" value="' + esc(it.desc) + '" placeholder="Descripción del servicio" oninput="rcbItem(' + i + ',\'desc\',this.value)"></div>'
            + '<div class="frow2" style="grid-template-columns:1fr 1fr 1fr"><div><label class="fl">Cant.</label><input class="fi" value="' + esc(it.cant) + '" oninput="rcbItem(' + i + ',\'cant\',this.value)"></div><div><label class="fl">Unidad</label><input class="fi" value="' + esc(it.unidad) + '" oninput="rcbItem(' + i + ',\'unidad\',this.value)"></div><div><label class="fl">Monto</label><input class="fi" id="rcb-i-' + i + '-monto" type="number" step="0.01" value="' + esc(it.monto) + '" oninput="rcbItem(' + i + ',\'monto\',this.value)"></div></div></div>';
        }).join('') + '<button type="button" class="add-item-btn" onclick="rcbAgregarItem()">+ Agregar ítem</button>'
      + '<div class="frow" style="margin-top:12px"><label class="fl">Observaciones (opcional)</label><input class="fi" value="' + esc(d.observaciones) + '" oninput="rcbCampo(\'observaciones\',this.value)"></div></div>'
      + '</div><div class="rcb-prev"><div class="rcb-prev-hoja" id="rcb-preview"></div></div></div>';
    pintarVista();
    if (focoId){ var f = $(focoId); if (f) f.focus(); }
  }
  function pintarVista(){ var p = $('rcb-preview'); if (p && RCB) p.innerHTML = reciboHtml(RCB.data, 'ORIGINAL'); }
  window.rcbCampo = function(k, v){ if (k === 'recibiDe') RCB.auto = false; RCB.data[k] = v; pintarVista(); if (k === 'moneda') pintarEditor(); };
  window.rcbItem = function(i, k, v){ RCB.data.items[i][k] = v; pintarVista(); };
  window.rcbAgregarItem = function(){ RCB.data.items.push({ id:'i' + Date.now(), desc:'', cant:'1', unidad:'servicio', monto:'' }); pintarEditor(); };
  window.rcbQuitarItem = function(i){ RCB.data.items.splice(i, 1); pintarEditor(); };
  window.rcbReserva = function(id){ RCB.data.pagoId = ''; RCB.data.recibiDe = ''; RCB.data.documento = ''; aplicarReserva(id); pintarEditor(); cargarGrupoPax(); };
  window.rcbPago = function(pid){ aplicarPago(pid); pintarEditor(); };
  window.rcbQuien = function(k){
    var o = opcionesRecibiDe().find(function(x){ return x.k === k; }); if (!o) return;
    RCB.auto = false; RCB.data.recibiDe = o.n; RCB.data.documento = o.d || ''; pintarEditor();
  };

  // ── Guardar / PDF / eliminar ──────────────────────────────────────────────
  function limpio(d){
    var o = JSON.parse(JSON.stringify(d));
    o.items = (o.items || []).filter(function(i){ return i.desc || num(i.monto); }).map(function(i){ return { desc:i.desc || '', cant:String(i.cant || ''), unidad:i.unidad || '', monto:num(i.monto) }; });
    o.total = o.items.reduce(function(s, i){ return s + i.monto; }, 0);
    Object.keys(o).forEach(function(k){ if (o[k] === '' || o[k] === undefined) delete o[k]; });
    return o;
  }
  function guardar(){
    var d = RCB.data;
    if (!d.recibiDe.trim()){ alert('Completá a quién se recibe el dinero ("Recibí de").'); return Promise.reject(new Error('sin nombre')); }
    if (!limpio(d).total){ alert('Cargá al menos un ítem con monto.'); return Promise.reject(new Error('sin monto')); }
    var ref = RCB.id ? REFS.recibos.child(RCB.id) : REFS.recibos.push();
    var asignar = d.numero ? Promise.resolve(d.numero) : db.ref('finanzas/meta/reciboCounter').transaction(function(c){ return (Number(c) || 0) + 1; }).then(function(res){
      if (!res.committed) throw new Error('No se pudo asignar el número');
      return 'R-' + String(res.snapshot.val()).padStart(4, '0');
    });
    return asignar.then(function(numero){
      d.numero = numero;
      var val = limpio(d); val.actualizadoPor = CURRENT_USER.email; val.actualizado = Date.now();
      if (!RCB.id){ val.creadoPor = CURRENT_USER.email; val.creado = Date.now(); }
      else if (d.creado) val.creado = d.creado;
      return ref.update(val).then(function(){ RCB.id = ref.key; return numero; });
    }).catch(function(err){ console.error(err); if (err.message !== 'sin nombre' && err.message !== 'sin monto') alert('No se pudo guardar el recibo. Revisá la conexión y que las reglas de Firebase estén publicadas.'); throw err; });
  }
  window.rcbGuardar = function(){ guardar().then(function(){ pintarEditor(); }, function(){ }); };
  function imprimir(d, titulo){
    var copias = d.copias === 'simple' ? ['ORIGINAL'] : ['ORIGINAL', 'DUPLICADO'];
    $('rcb-print').innerHTML = '<style>' + CSS_REC + '</style>' + copias.map(function(c){ return '<div class="rcb-hoja">' + reciboHtml(d, c) + '</div>'; }).join('');
    var tituloAnterior = document.title, st = document.createElement('style');
    st.textContent = '@page{size:A4;margin:18mm 16mm}';
    document.head.appendChild(st); document.body.classList.add('imprimiendo-recibo'); document.title = titulo;
    var fin = function(){ document.body.classList.remove('imprimiendo-recibo'); document.title = tituloAnterior; st.remove(); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  }
  var tituloArchivo = function(d){ return ('Recibo ' + (d.numero || '') + ' - ' + (d.recibiDe || '')).replace(/[\\/:*?"<>|]+/g, ' ').trim(); };
  window.rcbPdf = function(){ guardar().then(function(){ pintarEditor(); imprimir(RCB.data, tituloArchivo(RCB.data)); }, function(){ }); };
  window.rcbPdfDe = function(id){
    var r = STATE.recibos.find(function(x){ return x.id === id; }); if (!r) return;
    var d = JSON.parse(JSON.stringify(r)); d.items = arr(d.items); imprimir(d, tituloArchivo(d));
  };
  window.rcbEliminar = function(id){
    var r = STATE.recibos.find(function(x){ return x.id === id; }); if (!r) return;
    if (!confirm('¿Eliminar el recibo ' + (r.numero || '') + ' de ' + (r.recibiDe || '') + '? No se puede deshacer (el número no se reutiliza).')) return;
    REFS.recibos.child(id).remove().catch(function(e){ console.error(e); alert('No se pudo eliminar.'); });
  };
  window.reciboDesdePago = function(reservaId, pagoId){
    if (typeof closeReserva === 'function') closeReserva();
    window.nuevoRecibo({ reservaId: reservaId, pagoId: pagoId });
  };
  window.renderRecibos = renderRecibos;

  // estilos del módulo
  var st = document.createElement('style');
  st.textContent = CSS_REC + '\n'
    + '.rcb-grid{display:grid;grid-template-columns:minmax(320px,460px) 1fr;gap:22px;align-items:start}'
    + '.rcb-prev{position:sticky;top:12px}.rcb-prev-hoja{background:#fff;border:1px solid var(--beige-d);border-radius:8px;padding:18px;max-width:760px;box-shadow:0 2px 10px rgba(0,0,0,.06);overflow-x:auto}'
    + '.rcb-pago{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--beige-d);font-size:12px}'
    + '#rcb-print{display:none}'
    + '@media(max-width:1000px){.rcb-grid{grid-template-columns:1fr}.rcb-prev{position:static}}'
    + '@media print{body.imprimiendo-recibo>*:not(#rcb-print){display:none!important}body.imprimiendo-recibo{background:#fff!important;overflow:visible!important;height:auto!important}body.imprimiendo-recibo #rcb-print{display:block!important}}';
  document.head.appendChild(st);
})();
