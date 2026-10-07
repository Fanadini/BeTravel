// Be•Travel · Redactor de propuestas (Cloudflare Worker)
//
// Recibe los datos de una cotización desde admin/cotizador.html y devuelve la
// presentación y/o los textos de cada día.
//
// Motor de IA:
// - Por defecto, Workers AI de Cloudflare (Llama 3.3 70B): sin costo dentro de
//   las 10.000 neuronas diarias del plan gratuito (unas 30 redacciones por día;
//   al superarlas la IA deja de responder hasta el día siguiente, no cobra).
//   Requiere el enlace (binding) de Workers AI con el nombre AI.
// - Opcional: Claude (mejor redacción, pago por uso). Variable IA_PROVEEDOR=claude
//   y Secret ANTHROPIC_API_KEY con crédito cargado en console.anthropic.com.
//
// Seguridad: solo responde a betravel.com.ar (CORS) y a usuarios logueados en el
// admin: verifica el token de Firebase y que la cuenta esté en finanzas/meta/usuarios.
//
// Se pega tal cual en el editor de Cloudflare (sin build). Pasos en LEEME.md.
//
// Variables opcionales (Settings → Variables): IA_PROVEEDOR, ALLOWED_ORIGINS
// (separados por coma), FIREBASE_PROJECT_ID, FIREBASE_DB_URL. Los valores por
// defecto ya son los de Be•Travel.

const MODELO_CF = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// Lectura de capturas de pantalla (modelos con visión de Workers AI, mismo cupo gratuito).
// Se prueba el primero y, si falla, el segundo. Se puede cambiar con la variable MODELO_VISION.
const MODELO_VISION = '@cf/meta/llama-4-scout-17b-16e-instruct';
const MODELO_VISION_2 = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const MODEL = 'claude-opus-5-5';
const ORIGENES = 'https://betravel.com.ar,https://www.betravel.com.ar';
const PROYECTO = 'betravel-kanban';
const DB_URL = 'https://betravel-kanban-default-rtdb.firebaseio.com';

const SYSTEM = `Sos redactor de Be•Travel, una agencia de Buenos Aires especializada en viajes de grupos y corporativos. Be•Travel se presenta como partner de ejecución: su valor está en el criterio y la coordinación, no en el destino ni en el precio.

Redactás textos para propuestas comerciales que se envían a clientes: empresas, sindicatos, grupos de afinidad o pasajeros particulares.

Reglas de estilo:
- Español rioplatense formal, con ustedeo ("ustedes", "su equipo", "les proponemos"). Nunca voseo, tuteo ni "vosotros".
- Tono sobrio, preciso y seguro. Afirmá lo que se coordina ("coordinamos", "incluye") en lugar de condicionales ("podríamos").
- Sin emojis, sin signos de exclamación y sin mayúsculas enfáticas.
- Sin superlativos vacíos ni lenguaje de folleto: evitá "único", "increíble", "el mejor", "soñado", "inolvidable", "mágico", "paraíso".
- Sin lenguaje de venta minorista: evitá "paquete", "oferta", "promoción", "imperdible".
- La marca se escribe "Be•Travel".
- Usá solo la información de la cotización. No agregues hoteles, horarios, comidas, excursiones, precios ni servicios que no figuren: la propuesta es un documento comercial y cada dato tiene que poder cumplirse. Si un día tiene poca información, escribí algo breve a partir de lo que hay (por ejemplo, "Día libre para recorrer la ciudad a su ritmo").
- No menciones precios, costos ni márgenes.
- Los servicios marcados como opción (Opción A, Opción B…) son alternativas entre las que el cliente elige, y los adicionales opcionales no están incluidos: no los presentes como parte fija del viaje.

Qué redactar:
- Presentación: un texto de 70 a 120 palabras, en uno o dos párrafos, dirigido al cliente. Presenta el viaje, su objetivo y cómo está pensada la logística. Sin saludo ni firma, porque la propuesta ya los tiene.
- Itinerario: para cada día, un título de 2 a 6 palabras y una descripción de 25 a 70 palabras, en el mismo orden y con la misma cantidad de días que la cotización. Si un día ya tiene texto, mejoralo conservando todos sus datos. Podés separar mañana y tarde con un salto de línea.

Seguí las indicaciones del ejecutivo cuando no contradigan estas reglas.`;

const SYSTEM_VUELOS = `Sos un asistente que transcribe información de vuelos desde capturas de pantalla de sistemas de reservas, para una agencia de viajes. Tu trabajo es transcribir, no interpretar: copiá solo lo que se ve en la imagen y no inventes ningún dato.

Reglas:
- Devolvé un objeto por cada bloque de vuelo de la captura (típicamente IDA y VUELTA), en el orden en que aparecen. Si la captura muestra varias opciones de itinerario, incluilas todas en orden.
- Un vuelo con escalas se descompone en tramos: un tramo por cada despegue y aterrizaje (por ejemplo EZE a MIA y MIA a LAX). Los textos de escala como "Realiza una escala: 3h 30m" no son tramos.
- Códigos de aeropuerto: tres letras en mayúsculas (EZE, MIA). Si no figura el código pero sí el nombre del aeropuerto, completá el código solo si estás seguro; si no, dejalo vacío.
- Fechas como día/mes ("25/1"), sin año. Si la captura indica el día de la semana, copialo en minúsculas ("lunes"). Horas en formato de 24 horas HH:MM, tal cual figuran.
- duracionTotal: la duración total del bloque tal como figura (por ejemplo "18h 47m"); vacío si no figura.
- aerolinea: nombre comercial de la aerolínea (por ejemplo "American Airlines"). Ignorá etiquetas del sistema como "NDC" o "Tarifa pública".
- clase: la cabina y el código de tarifa tal cual figuran (por ejemplo "Economica (Q)").
- Ignorá precios, equipaje, plazas disponibles e íconos.
- Si un dato no se ve con claridad, dejalo como texto vacío en lugar de adivinar: una hora o un código mal copiados son peores que un campo vacío.
Respondé solo con el JSON.`;

const _str = { type: 'string' };
const TRAMO_PROPS = ['vuelo', 'clase', 'origen', 'origenCiudad', 'origenAeropuerto', 'salidaFecha', 'salidaDiaSemana', 'salidaHora',
  'destino', 'destinoCiudad', 'destinoAeropuerto', 'llegadaFecha', 'llegadaDiaSemana', 'llegadaHora'];
const SCHEMA_VUELOS = {
  type: 'object', additionalProperties: false, required: ['vuelos'],
  properties: { vuelos: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['sentido', 'aerolinea', 'duracionTotal', 'tramos'],
    properties: { sentido: _str, aerolinea: _str, duracionTotal: _str,
      tramos: { type: 'array', items: { type: 'object', additionalProperties: false, required: TRAMO_PROPS,
        properties: Object.fromEntries(TRAMO_PROPS.map(k => [k, _str])) } } } } } },
};

export default {
  async fetch(request, env) {
    const permitidos = (env.ALLOWED_ORIGINS || ORIGENES).split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = permitidos.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
    const json = (status, obj) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: cors['Access-Control-Allow-Origin'] ? 204 : 403,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'POST') return json(405, { error: 'Método no permitido.' });
    if (!cors['Access-Control-Allow-Origin']) return json(403, { error: 'Origen no permitido.' });
    const usarClaude = String(env.IA_PROVEEDOR || '').trim().toLowerCase() === 'claude';
    if (usarClaude && !env.ANTHROPIC_API_KEY) return json(500, { error: 'Falta configurar la API key en Cloudflare (Secret ANTHROPIC_API_KEY).' });
    if (!usarClaude && !env.AI) return json(500, { error: 'Falta vincular Workers AI al Worker: Configuración → Enlaces → Agregar → Workers AI, con el nombre AI.' });

    // 1) Usuario logueado y habilitado
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    let claims;
    try {
      claims = await verificarTokenFirebase(token, env.FIREBASE_PROJECT_ID || PROYECTO);
    } catch (e) {
      return json(401, { error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' });
    }
    if (!(await esMiembro(claims, token, env.FIREBASE_DB_URL || DB_URL))) {
      return json(403, { error: 'Tu cuenta no está habilitada para usar la IA.' });
    }

    // 2) Pedido
    const raw = await request.text();
    if (raw.length > 6500000) return json(413, { error: 'El pedido es demasiado grande.' });
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Pedido inválido.' }); }
    if (body && body.accion === 'vuelos') return extraerVuelos(body, env, usarClaude, json);
    if (raw.length > 60000) return json(413, { error: 'La cotización tiene demasiado texto para redactarla de una vez.' });
    const cot = limpiarCotizacion(body && body.cotizacion);
    const tareas = { introduccion: !!(body.tareas && body.tareas.introduccion), dias: !!(body.tareas && body.tareas.dias) && cot.dias.length > 0 };
    if (!tareas.introduccion && !tareas.dias) return json(400, { error: 'No hay nada para redactar.' });
    if (cot.dias.length > 60) return json(400, { error: 'El itinerario tiene demasiados días.' });

    // 3) Redacción
    const schema = { type: 'object', additionalProperties: false, properties: {}, required: [] };
    if (tareas.introduccion) {
      schema.properties.introduccion = { type: 'string' };
      schema.required.push('introduccion');
    }
    if (tareas.dias) {
      schema.properties.dias = {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { titulo: { type: 'string' }, descripcion: { type: 'string' } }, required: ['titulo', 'descripcion'] },
      };
      schema.required.push('dias');
    }
    const pedir = [tareas.introduccion && 'la presentación', tareas.dias && `el itinerario (${cot.dias.length} días)`].filter(Boolean).join(' y ');
    const indicaciones = String((body && body.indicaciones) || '').trim().slice(0, 2000);
    const contenido = `Redactá ${pedir} para esta propuesta.\n\n<cotizacion>\n${JSON.stringify(cot, null, 2)}\n</cotizacion>`
      + (indicaciones ? `\n\n<indicaciones_del_ejecutivo>\n${indicaciones}\n</indicaciones_del_ejecutivo>` : '');

    const r = usarClaude ? await redactarConClaude(env, schema, contenido) : await redactarConWorkersAI(env, schema, contenido);
    if (r.error) return json(r.status, { error: r.error });
    const out = r.out;
    const res = {};
    if (tareas.introduccion) {
      if (typeof out.introduccion !== 'string' || !out.introduccion.trim()) return json(502, { error: 'La IA no devolvió la presentación. Probá de nuevo.' });
      res.introduccion = out.introduccion.trim();
    }
    if (tareas.dias) {
      // Un día de más se descarta; uno de menos es un error (no se inventa).
      if (!Array.isArray(out.dias) || out.dias.length < cot.dias.length) {
        return json(502, { error: 'La IA devolvió menos días que el itinerario. Probá de nuevo.' });
      }
      res.dias = out.dias.slice(0, cot.dias.length).map(d => ({ titulo: String((d && d.titulo) || '').trim(), descripcion: String((d && d.descripcion) || '').trim() }));
    }
    return json(200, res);
  },
};

// Workers AI (Cloudflare): sin API key, cuenta contra las neuronas diarias gratuitas.
async function redactarConWorkersAI(env, schema, contenido) {
  let res;
  try {
    res = await env.AI.run(MODELO_CF, {
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: contenido }],
      response_format: { type: 'json_schema', json_schema: schema },
      max_tokens: 4096,
      temperature: 0.4,
    });
  } catch (e) {
    const m = String((e && e.message) || e);
    console.error('Workers AI', m);
    if (/neuron|daily|quota|exceed|limit|4006|3036/i.test(m)) {
      return { status: 429, error: 'Se alcanzó el límite gratuito diario de la IA. Se renueva todos los días a las 21 h (hora de Argentina).' };
    }
    return { status: 502, error: 'No se pudo generar el texto (Workers AI: ' + m.slice(0, 160) + ').' };
  }
  let out = res && res.response;
  if (typeof out === 'string') {
    try { out = JSON.parse(out); } catch (e) { out = null; }
  }
  if (!out || typeof out !== 'object') return { status: 502, error: 'La IA devolvió un formato inesperado. Probá de nuevo.' };
  return { out };
}

// Claude (opcional, pago por uso).
async function redactarConClaude(env, schema, contenido, opts = {}) {
  const llamar = (conFallback) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      ...(conFallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      ...(conFallback ? { fallbacks: 'default' } : {}),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system: opts.system || SYSTEM,
      messages: [{ role: 'user', content: opts.imagen
        ? [{ type: 'image', source: { type: 'base64', media_type: opts.imagen.mediaType, data: opts.imagen.data } }, { type: 'text', text: contenido }]
        : contenido }],
    }),
  });
  let resp, detalle = '';
  try {
    resp = await llamar(true);
    if (!resp.ok) {
      detalle = await resp.text();
      // Si la cuenta no acepta el reintento automático en otro modelo (beta), se pide sin él.
      if (resp.status === 400 && /fallback|anthropic-beta|beta/i.test(detalle)) {
        resp = await llamar(false);
        detalle = resp.ok ? '' : await resp.text();
      }
    }
  } catch (e) {
    return { status: 502, error: 'No se pudo conectar con la IA. Probá de nuevo.' };
  }
  if (!resp.ok) {
    console.error('Anthropic', resp.status, detalle.slice(0, 800));
    return { status: 502, error: explicarError(resp.status, detalle) };
  }
  const msg = await resp.json();
  if (msg.stop_reason === 'refusal') return { status: 422, error: 'La IA no pudo redactar este contenido. Ajustá las indicaciones y probá de nuevo.' };
  if (msg.stop_reason === 'max_tokens') return { status: 502, error: 'La respuesta quedó incompleta. Probá con menos días por vez.' };
  const texto = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return { out: JSON.parse(texto) }; } catch (e) { return { status: 502, error: 'La IA devolvió un formato inesperado. Probá de nuevo.' }; }
}

// ── Lectura de capturas de pantalla de vuelos ──
async function extraerVuelos(body, env, usarClaude, json) {
  const img = String(body.imagen || '');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(img);
  if (!m) return json(400, { error: 'La imagen no es válida. Pegá una captura en formato JPG, PNG o WebP.' });
  if (img.length > 5000000) return json(413, { error: 'La imagen es demasiado pesada. Probá con una captura más chica.' });
  const instruccion = 'Extraé los vuelos de esta captura de pantalla.';
  const r = usarClaude
    ? await redactarConClaude(env, SCHEMA_VUELOS, instruccion, { system: SYSTEM_VUELOS, imagen: { mediaType: m[1], data: m[2] } })
    : await leerCapturaConWorkersAI(env, img, instruccion);
  if (r.error) return json(r.status, { error: r.error });
  const vuelos = normalizarVuelos(r.out);
  if (!vuelos.length) return json(422, { error: 'No encontré vuelos en la captura. Probá con una captura más nítida que incluya los horarios, los códigos de aeropuerto y los números de vuelo.' });
  return json(200, { vuelos });
}

// Devuelve un objeto desde la respuesta del modelo: objeto, JSON en texto o JSON dentro de un bloque de código.
function parsearJSON(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  const t = v.replace(/```(?:json)?/gi, '');
  for (const cand of [t, t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)]) {
    try { const o = JSON.parse(cand); if (o && typeof o === 'object') return o; } catch (e) { /* sigue */ }
  }
  return null;
}

async function leerCapturaConWorkersAI(env, imagen, instruccion) {
  const modelos = [env.MODELO_VISION || MODELO_VISION, MODELO_VISION_2].filter((x, i, a) => x && a.indexOf(x) === i);
  let ultimo = 'sin respuesta';
  for (const modelo of modelos) {
    // Primero con JSON estricto; si el modelo no lo admite con imágenes, sin él y se interpreta el texto.
    for (const conJson of [true, false]) {
      try {
        const res = await env.AI.run(modelo, {
          messages: [
            { role: 'system', content: SYSTEM_VUELOS },
            { role: 'user', content: [{ type: 'text', text: instruccion }, { type: 'image_url', image_url: { url: imagen } }] },
          ],
          ...(conJson ? { response_format: { type: 'json_schema', json_schema: SCHEMA_VUELOS } } : {}),
          max_tokens: 3000,
          temperature: 0,
        });
        const out = parsearJSON(res && res.response);
        if (out) return { out };
        ultimo = 'formato inesperado';
      } catch (e) {
        const m = String((e && e.message) || e);
        console.error('Workers AI visión', modelo, m);
        if (/neuron|daily|quota|exceed|limit|4006|3036/i.test(m)) {
          return { status: 429, error: 'Se alcanzó el límite gratuito diario de la IA. Se renueva todos los días a las 21 h (hora de Argentina).' };
        }
        ultimo = m;
      }
    }
  }
  return { status: 502, error: 'No se pudo leer la captura (' + String(ultimo).slice(0, 160) + ').' };
}

// Deja solo datos con el formato esperado: lo que no cumple queda vacío (mejor vacío que mal copiado).
function normalizarVuelos(out) {
  const lista = Array.isArray(out && out.vuelos) ? out.vuelos : [];
  const s = (v, n = 120) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const fecha = v => { const m = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/.exec(String(v || '')); if (!m) return ''; const d = +m[1], mo = +m[2]; return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 ? d + '/' + mo : ''; };
  const hora = v => { const m = /(\d{1,2})\s*[:h.]\s*(\d{2})/.exec(String(v || '')); if (!m) return ''; const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : ''; };
  const iata = v => { const x = String(v || '').toUpperCase().replace(/[^A-Z]/g, ''); return x.length === 3 ? x : ''; };
  const dsem = v => { const x = s(v, 20).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3); return ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'].includes(x) ? x : ''; };
  return lista.slice(0, 6).map(l => {
    l = l || {};
    return {
      sentido: /vuelta|regreso|return/i.test(String(l.sentido || '')) ? 'vuelta' : 'ida',
      aerolinea: s(l.aerolinea, 60),
      duracionTotal: s(l.duracionTotal, 20),
      tramos: (Array.isArray(l.tramos) ? l.tramos : []).slice(0, 8).map(t => {
        t = t || {};
        return {
          vuelo: s(t.vuelo, 12).toUpperCase().replace(/\s+/g, ''), clase: s(t.clase, 40),
          origen: iata(t.origen), origenCiudad: s(t.origenCiudad, 60), origenAeropuerto: s(t.origenAeropuerto, 90),
          salidaFecha: fecha(t.salidaFecha), salidaDiaSemana: dsem(t.salidaDiaSemana), salidaHora: hora(t.salidaHora),
          destino: iata(t.destino), destinoCiudad: s(t.destinoCiudad, 60), destinoAeropuerto: s(t.destinoAeropuerto, 90),
          llegadaFecha: fecha(t.llegadaFecha), llegadaDiaSemana: dsem(t.llegadaDiaSemana), llegadaHora: hora(t.llegadaHora),
        };
      }).filter(t => t.origen || t.destino || t.salidaHora || t.llegadaHora),
    };
  }).filter(l => l.tramos.length);
}

// Traduce los errores más comunes de la API de Claude a qué hay que revisar.
function explicarError(status, detalle) {
  let m = '';
  try { m = (JSON.parse(detalle).error || {}).message || ''; } catch (e) { m = String(detalle || '').slice(0, 200); }
  if (status === 429 || status === 529) return 'La IA está saturada en este momento. Probá de nuevo en un minuto.';
  if (status === 401) return 'La API key de Claude no es válida: revisá el secreto ANTHROPIC_API_KEY en Cloudflare (sin espacios ni comillas).';
  if (/credit balance|billing|purchase credits/i.test(m)) return 'La cuenta de Anthropic no tiene crédito: cargalo en console.anthropic.com → Billing.';
  if (status === 403) return 'La API key no tiene permiso para usar la IA. Revisá la key en console.anthropic.com. (' + m + ')';
  if (status === 404) return 'El modelo de IA no está disponible para esta cuenta. (' + m + ')';
  return 'No se pudo generar el texto (error ' + status + (m ? ': ' + m : '') + ').';
}

// Solo los campos que la IA necesita (sin costos, precios ni proveedores).
function limpiarCotizacion(c) {
  c = c || {};
  const txt = v => String(v == null ? '' : v).slice(0, 4000);
  return {
    titulo: txt(c.titulo), cliente: txt(c.cliente), destino: txt(c.destino),
    fechaInicio: txt(c.fechaInicio), fechaFin: txt(c.fechaFin), pasajeros: txt(c.pasajeros),
    introduccion_actual: txt(c.introduccion),
    dias: (Array.isArray(c.dias) ? c.dias : []).map((d, i) => ({ n: i + 1, fecha: txt(d && d.fecha), titulo: txt(d && d.titulo), descripcion: txt(d && d.descripcion) })),
    servicios: (Array.isArray(c.servicios) ? c.servicios : []).slice(0, 80).map(s => ({
      tipo: txt(s && s.tipo), servicio: txt(s && s.concepto), detalle: txt(s && s.detalle), en_la_propuesta: txt(s && s.en_la_propuesta),
    })),
  };
}

// ── Verificación del token de Firebase (RS256, claves públicas de Google) ──
let CLAVES = null, CLAVES_VENCEN = 0;
async function clavesGoogle() {
  if (CLAVES && Date.now() < CLAVES_VENCEN) return CLAVES;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('No se pudieron obtener las claves de Google');
  const { keys } = await r.json();
  const maxAge = Number((/max-age=(\d+)/.exec(r.headers.get('Cache-Control') || '') || [])[1] || 3600);
  CLAVES = keys;
  CLAVES_VENCEN = Date.now() + maxAge * 1000;
  return keys;
}
function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
}
async function verificarTokenFirebase(token, proyecto) {
  const partes = String(token).split('.');
  if (partes.length !== 3) throw new Error('formato');
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(b64url(partes[0])));
  const payload = JSON.parse(dec.decode(b64url(partes[1])));
  if (header.alg !== 'RS256') throw new Error('alg');
  const jwk = (await clavesGoogle()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const clave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, b64url(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
  if (!ok) throw new Error('firma');
  const ahora = Math.floor(Date.now() / 1000);
  if (payload.aud !== proyecto || payload.iss !== 'https://securetoken.google.com/' + proyecto) throw new Error('aud');
  if (!(payload.exp > ahora) || !(payload.iat <= ahora + 60) || !payload.sub) throw new Error('vencido');
  if (!payload.email || payload.email_verified !== true) throw new Error('email');
  return payload;
}
// La cuenta tiene que estar en finanzas/meta/usuarios (se consulta con el propio
// token del usuario: las reglas le permiten leer solo su entrada).
async function esMiembro(claims, token, dbUrl) {
  const key = claims.email.toLowerCase().replace(/\./g, ',');
  const r = await fetch(`${dbUrl}/finanzas/meta/usuarios/${encodeURIComponent(key)}.json?auth=${encodeURIComponent(token)}`);
  if (!r.ok) return false;
  return !!(await r.json());
}
