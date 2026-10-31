/* Encabezado compartido de las páginas de gestión de Be•Travel.
 *
 * Uso (en el lugar donde iba el viejo <div class="nav">):
 *   <script src="nav.js"></script>
 *   <script>AdminNav.mount({ pagina:'cotizador', sync:true });</script>
 * y, cuando se conoce el rol de la persona:
 *   AdminNav.setUser({ rol:'admin', nombre:'Facundo' });
 *
 * En pantallas anchas muestra los accesos como botones; en celular, un menú hamburguesa que se abre como panel lateral.
 * Mantiene los ids que usan las páginas: #nav-user-name, #sync-dot y #sync-label (si sync:true).
 * Las acciones propias de cada página pueden sumarse al menú del celular con extras:[{ label, onClick }].
 */
(function(){
  'use strict';

  // Secciones del panel, en el orden en que se muestran. "roles": quiénes ven el acceso.
  var SECCIONES = [
    { id:'inicio',    href:'index.html',        label:'Inicio',          roles:['admin', 'agente', 'cotizador'] },
    { id:'kanban',    href:'kanban.html',        label:'Prospectos',      roles:['admin', 'agente'] },
    { id:'cotizador', href:'cotizador.html',     label:'Cotizador',       roles:['admin', 'agente', 'cotizador'] },
    { id:'gestion',   href:'gestioninterna.html', label:'Gestión interna', roles:['admin', 'agente'] },
    { id:'grupos',    href:'grupos.html',        label:'Grupos',          roles:['admin', 'agente'] },
    { id:'compartidas', href:'compartidas.html', label:'Reservas',        roles:['cotizador'] },
    { id:'contratos', href:'contratos.html',     label:'Contratos',       roles:['admin'] }
  ];

  var CSS = [
    '.nav.adm-nav{background:#0F3D3E;height:50px;min-height:50px;display:flex;align-items:center;justify-content:flex-start;flex-wrap:nowrap;padding:0 16px;gap:10px;box-shadow:none;flex-shrink:0;position:relative;z-index:300;color:#E6E1D8;font-family:Inter,sans-serif}',
    '.adm-burger{display:none;align-items:center;justify-content:center;width:40px;height:40px;margin-left:-8px;border:0;border-radius:8px;background:transparent;color:#E6E1D8;cursor:pointer;flex-shrink:0}',
    '.adm-burger:hover{background:rgba(255,255,255,.1)}',
    '.adm-brand{font-size:15px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;color:#E6E1D8;flex-shrink:0}',
    '.adm-brand span{color:#B08A5A}',
    '.adm-page{font-size:13px;font-weight:600;color:#E6E1D8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;margin:0;padding-left:12px;border-left:1px solid rgba(230,225,216,.3);line-height:1.2}',
    '.adm-links{display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:1;min-width:0}',
    '.adm-link{font-size:11.5px;font-weight:500;padding:6px 11px;border-radius:6px;border:1px solid rgba(230,225,216,.2);background:rgba(255,255,255,.06);color:rgba(230,225,216,.8);text-decoration:none;white-space:nowrap;transition:background .15s,color .15s}',
    '.adm-link:hover{background:rgba(255,255,255,.16);color:#E6E1D8;border-color:rgba(230,225,216,.4)}',
    '.adm-link.on{background:#E6E1D8;color:#0F3D3E;border-color:#E6E1D8;font-weight:600;cursor:default}',
    '.adm-right{display:flex;align-items:center;gap:8px;flex-shrink:0}',
    '.adm-sync{display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:99px;background:rgba(0,0,0,.2);font-size:10px;color:rgba(230,225,216,.6);white-space:nowrap}',
    '.adm-sync .sync-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;background:#B08A5A;transition:background .4s}',
    '.adm-sync .sync-dot.ok{background:#4ade80}',
    '.adm-sync .sync-dot.err{background:#f87171}',
    '.adm-sync .sync-dot.loading{background:#B08A5A;animation:adm-blink 1s infinite}',
    '@keyframes adm-blink{0%,100%{opacity:1}50%{opacity:.3}}',
    '.adm-user{font-size:11px;color:rgba(230,225,216,.65);white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis}',
    '.adm-out{font-family:Inter,sans-serif;font-size:11.5px;font-weight:500;padding:6px 12px;border-radius:6px;border:1px solid rgba(230,225,216,.2);background:transparent;color:rgba(230,225,216,.8);cursor:pointer;white-space:nowrap}',
    '.adm-out:hover{background:rgba(255,255,255,.12);color:#E6E1D8}',
    '.adm-overlay{position:fixed;inset:0;background:rgba(20,24,24,.55);z-index:1190;opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s}',
    '.adm-overlay.open{opacity:1;visibility:visible}',
    '.adm-drawer{position:fixed;top:0;bottom:0;left:0;width:min(84vw,320px);background:#0c3233;color:#E6E1D8;z-index:1200;display:flex;flex-direction:column;transform:translateX(-102%);visibility:hidden;transition:transform .22s ease,visibility .22s;font-family:Inter,sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '.adm-drawer.open{transform:none;visibility:visible}',
    '.adm-dr-head{display:flex;align-items:center;justify-content:space-between;height:50px;min-height:50px;padding:0 8px 0 18px;border-bottom:1px solid rgba(230,225,216,.15)}',
    '.adm-dr-close{width:40px;height:40px;border:0;border-radius:8px;background:transparent;color:#E6E1D8;cursor:pointer;font-size:22px;line-height:1}',
    '.adm-dr-close:hover{background:rgba(255,255,255,.1)}',
    '.adm-dr-sec{padding:14px 18px 4px;font-size:10px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:rgba(230,225,216,.5)}',
    '.adm-dr-link,.adm-dr-act{display:flex;align-items:center;min-height:46px;padding:0 18px;font-size:15px;font-weight:500;color:rgba(230,225,216,.9);text-decoration:none;background:transparent;border:0;border-left:3px solid transparent;width:100%;text-align:left;font-family:Inter,sans-serif;cursor:pointer}',
    '.adm-dr-link:hover,.adm-dr-act:hover{background:rgba(255,255,255,.08)}',
    '.adm-dr-link.on{background:rgba(230,225,216,.12);border-left-color:#B08A5A;color:#fff;font-weight:600}',
    '.adm-dr-foot{margin-top:auto;padding:14px 18px 18px;border-top:1px solid rgba(230,225,216,.15);display:flex;flex-direction:column;gap:10px}',
    '.adm-dr-user{font-size:12px;color:rgba(230,225,216,.65);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.adm-dr-foot .adm-out{width:100%;min-height:42px;font-size:14px}',
    '@media(max-width:1100px){.adm-user{display:none}.adm-link{padding:6px 9px}}',
    '@media(max-width:980px){.adm-sync span:last-child{display:none}.adm-sync{padding:4px 7px}}',
    '@media(max-width:900px){',
    '  .nav.adm-nav{padding:0 12px;gap:8px}',
    '  .adm-burger{display:inline-flex}',
    '  .adm-links,.adm-right .adm-out{display:none}',
    '  .adm-right{margin-left:auto}',
    '}',
    '@media(max-width:420px){.adm-page{font-size:12.5px;padding-left:9px}.adm-brand{font-size:14px}}',
    '@media(max-width:900px){',
    '  /* En celular los campos van a 16px: con menos, Safari de iPhone hace zoom al tocarlos. */',
    '  input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]),select,textarea{font-size:16px!important}',
    '  .nav-btn,.btn,.new-btn,.ia-btn,.tab-btn,.add-item-btn,.google-btn{min-height:40px}',
    '}',
    '@media print{.nav.adm-nav,.adm-overlay,.adm-drawer{display:none!important}}'
  ].join('\n');

  var estado = { pagina:'', rol:'', nombre:'', extras:[], header:null, drawer:null, overlay:null, burger:null, links:null, drLinks:null, drUser:null, drExtras:null };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
  function seccion(id){ for (var i = 0; i < SECCIONES.length; i++) if (SECCIONES[i].id === id) return SECCIONES[i]; return null; }

  function abrir(){
    estado.drUser.textContent = (document.getElementById('nav-user-name') || {}).textContent || estado.nombre || '';
    estado.drawer.classList.add('open'); estado.overlay.classList.add('open');
    estado.burger.setAttribute('aria-expanded', 'true');
    estado.drawer.removeAttribute('aria-hidden');
    var primero = estado.drawer.querySelector('.adm-dr-link, .adm-dr-act, .adm-dr-close');
    if (primero) primero.focus();
  }
  function cerrar(devolverFoco){
    if (!estado.drawer) return;
    estado.drawer.classList.remove('open'); estado.overlay.classList.remove('open');
    estado.burger.setAttribute('aria-expanded', 'false');
    estado.drawer.setAttribute('aria-hidden', 'true');
    if (devolverFoco) estado.burger.focus();
  }

  function pintarAccesos(){
    var visibles = SECCIONES.filter(function(s){ return estado.rol && (s.roles.indexOf(estado.rol) !== -1 || (s.id === 'grupos' && estado.grupos)); });
    estado.links.innerHTML = visibles.map(function(s){
      return s.id === estado.pagina
        ? '<span class="adm-link on" aria-current="page">' + esc(s.label) + '</span>'
        : '<a class="adm-link" href="' + s.href + '">' + esc(s.label) + '</a>';
    }).join('');
    estado.drLinks.innerHTML = visibles.map(function(s){
      return '<a class="adm-dr-link' + (s.id === estado.pagina ? ' on' : '') + '" href="' + s.href + '"' + (s.id === estado.pagina ? ' aria-current="page"' : '') + '>' + esc(s.label) + '</a>';
    }).join('');
  }

  function pintarExtras(){
    var ex = estado.extras;
    estado.drExtras.innerHTML = ex.length ? '<div class="adm-dr-sec">En esta página</div>' + ex.map(function(x, i){
      return '<button type="button" class="adm-dr-act" data-i="' + i + '">' + esc(x.label) + '</button>';
    }).join('') : '';
  }

  function mount(opts){
    opts = opts || {};
    if (estado.header) return;
    var sec = seccion(opts.pagina);
    estado.pagina = opts.pagina || '';
    estado.extras = opts.extras || [];

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var h = document.createElement('header');
    h.className = 'nav adm-nav';
    h.innerHTML =
      '<button type="button" class="adm-burger" aria-label="Abrir el menú" aria-expanded="false" aria-controls="adm-drawer">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>' +
      '</button>' +
      '<span class="adm-brand">Be<span>•</span>Travel</span>' +
      '<h1 class="adm-page">' + esc(opts.titulo || (sec && sec.label) || '') + '</h1>' +
      '<nav class="adm-links" aria-label="Secciones"></nav>' +
      '<div class="adm-right">' +
        (opts.sync ? '<div class="adm-sync"><span class="sync-dot loading" id="sync-dot"></span><span id="sync-label">Conectando…</span></div>' : '') +
        '<span class="adm-user" id="nav-user-name"></span>' +
        '<button type="button" class="adm-out" onclick="logout()">Salir</button>' +
      '</div>';

    var ov = document.createElement('div');
    ov.className = 'adm-overlay';
    var dr = document.createElement('aside');
    dr.className = 'adm-drawer'; dr.id = 'adm-drawer'; dr.setAttribute('aria-label', 'Menú'); dr.setAttribute('aria-hidden', 'true');
    dr.innerHTML =
      '<div class="adm-dr-head"><span class="adm-brand">Be<span>•</span>Travel</span><button type="button" class="adm-dr-close" aria-label="Cerrar el menú">×</button></div>' +
      '<div class="adm-dr-sec">Secciones</div><div class="adm-dr-links"></div>' +
      '<div class="adm-dr-extras"></div>' +
      '<div class="adm-dr-foot"><div class="adm-dr-user"></div><button type="button" class="adm-out" onclick="logout()">Salir</button></div>';

    var ref = document.currentScript;
    var padre = ref && ref.parentNode ? ref.parentNode : document.body;
    padre.insertBefore(h, ref || padre.firstChild);
    padre.insertBefore(ov, ref || padre.firstChild);
    padre.insertBefore(dr, ref || padre.firstChild);

    estado.header = h; estado.overlay = ov; estado.drawer = dr;
    estado.burger = h.querySelector('.adm-burger'); estado.links = h.querySelector('.adm-links');
    estado.drLinks = dr.querySelector('.adm-dr-links'); estado.drExtras = dr.querySelector('.adm-dr-extras'); estado.drUser = dr.querySelector('.adm-dr-user');

    estado.burger.addEventListener('click', abrir);
    ov.addEventListener('click', function(){ cerrar(false); });
    dr.querySelector('.adm-dr-close').addEventListener('click', function(){ cerrar(true); });
    dr.addEventListener('click', function(e){
      var act = e.target.closest ? e.target.closest('.adm-dr-act') : null;
      if (act){ cerrar(false); var x = estado.extras[+act.dataset.i]; if (x && x.onClick) x.onClick(); return; }
      if (e.target.closest && e.target.closest('.adm-dr-link')) cerrar(false);
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && dr.classList.contains('open')) cerrar(true); });
    window.addEventListener('resize', function(){ if (window.innerWidth > 900) cerrar(false); });

    pintarExtras();
  }

  // Cuando se conoce el rol, se muestran los accesos que le corresponden.
  function setUser(u){
    u = u || {};
    estado.rol = u.rol || ''; estado.nombre = u.nombre || ''; estado.grupos = u.grupos === true;   // grupos:true habilita Grupos a un cotizador
    if (estado.header) pintarAccesos();
  }

  // Acciones propias de la página para el menú del celular (se pueden actualizar en cualquier momento).
  function setExtras(lista){ estado.extras = lista || []; if (estado.header) pintarExtras(); }

  window.AdminNav = { mount: mount, setUser: setUser, setExtras: setExtras, secciones: SECCIONES };
})();
