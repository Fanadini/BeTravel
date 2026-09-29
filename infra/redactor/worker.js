// Be•Travel · Redactor de propuestas (Cloudflare Worker)
//
// Recibe los datos de una cotización desde admin/cotizador.html y devuelve la
// presentación y/o los textos de cada día redactados por Claude.
//
// Seguridad:
// - La API key de Claude vive solo acá, como Secret (ANTHROPIC_API_KEY).
// - Solo responde a betravel.com.ar (CORS) y a usuarios logueados en el admin:
//   verifica el token de Firebase y que la cuenta esté en finanzas/meta/usuarios.
//
// Se pega tal cual en el editor de Cloudflare (sin build). Pasos en LEEME.md.
//
// Variables opcionales (Settings → Variables): ALLOWED_ORIGINS (separados por coma),
// FIREBASE_PROJECT_ID, FIREBASE_DB_URL. Los valores por defecto ya son los de Be•Travel.

const MODEL = 'claude-opus-5-5';
const ORIGENES = 'https://betravel.com.ar,https://www.betravel.com.ar';
const PROYECTO = 'betravel-kanban';
const DB_URL = 'https://betravel-kanban-default-rtdb.firebaseio.com';

const SYSTEM = `Sos redactor de Be•Travel, una agencia de Buenos Aires especializada en viajes de grupos y corporativos. Be•Travel se presenta como partner de ejecución: su valor está en el criterio y la coordinación, no en el destino ni en el precio.

Redactás textos para propuestas comerciales que se envían a clientes: empresas, sindicatos, grupos de afinidad o pasajeros particulares.

Reglas de estilo:
- Español rioplatense formal, con ustedeo ("ustedes", "su equipo", "les proponemos"). Nunca voseo ni tuteo.
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
    if (!env.ANTHROPIC_API_KEY) return json(500, { error: 'Falta configurar la API key en Cloudflare (Secret ANTHROPIC_API_KEY).' });

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
    if (raw.length > 60000) return json(413, { error: 'La cotización tiene demasiado texto para redactarla de una vez.' });
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Pedido inválido.' }); }
    const cot = limpiarCotizacion(body && body.cotizacion);
    const tareas = { introduccion: !!(body.tareas && body.tareas.introduccion), dias: !!(body.tareas && body.tareas.dias) && cot.dias.length > 0 };
    if (!tareas.introduccion && !tareas.dias) return json(400, { error: 'No hay nada para redactar.' });
    if (cot.dias.length > 60) return json(400, { error: 'El itinerario tiene demasiados días.' });

    // 3) Claude
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

    let resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16000,
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
          system: SYSTEM,
          messages: [{ role: 'user', content: contenido }],
        }),
      });
    } catch (e) {
      return json(502, { error: 'No se pudo conectar con la IA. Probá de nuevo.' });
    }
    if (!resp.ok) {
      console.error('Anthropic', resp.status, (await resp.text()).slice(0, 800));
      const saturada = resp.status === 429 || resp.status === 529;
      return json(502, { error: saturada ? 'La IA está saturada en este momento. Probá de nuevo en un minuto.' : 'No se pudo generar el texto. Probá de nuevo.' });
    }
    const msg = await resp.json();
    if (msg.stop_reason === 'refusal') return json(422, { error: 'La IA no pudo redactar este contenido. Ajustá las indicaciones y probá de nuevo.' });
    if (msg.stop_reason === 'max_tokens') return json(502, { error: 'La respuesta quedó incompleta. Probá con menos días por vez.' });
    const texto = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let out;
    try { out = JSON.parse(texto); } catch { return json(502, { error: 'La IA devolvió un formato inesperado. Probá de nuevo.' }); }
    if (tareas.dias && (!Array.isArray(out.dias) || out.dias.length !== cot.dias.length)) {
      return json(502, { error: 'La IA devolvió una cantidad distinta de días. Probá de nuevo.' });
    }
    return json(200, out);
  },
};

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
