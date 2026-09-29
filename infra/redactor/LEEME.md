# Redactor con IA del cotizador (Cloudflare Worker)

El botón "Redactar con IA" de `admin/cotizador.html` llama a un Worker de Cloudflare que guarda la API key de Claude. La key nunca llega al navegador. El Worker solo responde a `betravel.com.ar` y a cuentas cargadas en `finanzas/meta/usuarios`.

Costo aproximado: entre US$ 0,05 y 0,15 por redacción, que se pagan en la cuenta de Anthropic. El Worker entra en el plan gratuito de Cloudflare.

## 1. API key de Claude

1. Entrá a https://console.anthropic.com y creá la cuenta si no la tenés.
2. **Billing**: cargá crédito (con US$ 10 alcanza para empezar). En **Limits**, fijá un límite de gasto mensual (por ejemplo, US$ 20) para no tener sorpresas.
3. **API Keys** → **Create Key** → nombre `betravel-redactor` → copiá la key. Empieza con `sk-ant-` y se muestra una sola vez.

## 2. Worker en Cloudflare

1. Entrá a https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Nombre: `betravel-redactor` → **Deploy**. Crea un Worker de ejemplo.
3. **Edit code**: borrá todo, pegá el contenido completo de `infra/redactor/worker.js` y tocá **Deploy**.
4. Volvé al Worker → **Settings** → **Variables and Secrets** → **Add**:
   - Type: **Secret**
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: la key del paso 1
   - **Deploy**.
5. Copiá la URL del Worker, que aparece arriba, del estilo `https://betravel-redactor.<tu-cuenta>.workers.dev`.

## 3. Conectar el cotizador

En `admin/cotizador.html`, poné esa URL en `const REDACTOR_URL = '';`, o pasásela a Claude para que la cargue y publique.

## Si algo falla

- "Tu cuenta no está habilitada": el email no está en `finanzas/meta/usuarios`.
- "Falta configurar la API key": falta el Secret del paso 2.4, o el nombre no es exactamente `ANTHROPIC_API_KEY`.
- Para ver errores: en Cloudflare → el Worker → **Logs** (Real-time logs).
- Para cambiar la key: Anthropic → API Keys → desactivá la vieja y creá otra, y reemplazá el Secret en Cloudflare.
