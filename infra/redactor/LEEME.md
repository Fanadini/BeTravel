# Redactor con IA del cotizador (Cloudflare Worker)

El botón "Redactar con IA" de `admin/cotizador.html` llama a este Worker (`https://betravel-redactor.fanadini.workers.dev`). El Worker solo responde a `betravel.com.ar` y a cuentas cargadas en `finanzas/meta/usuarios`.

## Motor de IA: Workers AI (sin costo)

Por defecto usa **Workers AI** de Cloudflare con el modelo Llama 3.3 70B:

- El plan gratuito de Cloudflare incluye 10.000 "neuronas" por día. Una redacción completa (presentación y 5 días) usa unas 330, así que alcanza para unas 30 por día.
- Si se agota el cupo, la IA deja de responder hasta el día siguiente: se renueva a las 21 h de Argentina (00:00 UTC). **En el plan gratuito no se cobra nada.** Solo se cobra si la cuenta pasa al plan pago de Workers.
- La redacción es buena pero menos pulida que la de Claude: revisá siempre el tono antes de aplicar.

## Configuración (una sola vez)

1. Cloudflare → **Workers y Pages** → `betravel-redactor` → **Editar código**: borrá todo, pegá el contenido completo de `infra/redactor/worker.js` → **Implementar**.
2. En el Worker → **Configuración** → **Enlaces** (*Bindings*) → **Agregar enlace** → **Workers AI** → nombre de la variable: `AI` → **Agregar** / **Implementar**.
3. Probá desde el cotizador: **Redactar con IA** → **Generar**.

Si antes cargaste el secreto `ANTHROPIC_API_KEY`, podés dejarlo: no se usa. Si no pensás usar Claude, lo más prolijo es borrarlo en **Configuración → Variables y secretos** y desactivar esa key en console.anthropic.com → API Keys.

## Opcional: usar Claude (pago por uso)

Para mejor redacción, a unos US$ 0,05–0,15 por uso:

1. En console.anthropic.com: cargá crédito en **Billing**, fijá un límite mensual y creá una key.
2. En el Worker → **Configuración** → **Variables y secretos**:
   - Secreto `ANTHROPIC_API_KEY` con la key.
   - Variable de texto `IA_PROVEEDOR` con el valor `claude`.
3. **Implementar**. Para volver a Workers AI, borrá la variable `IA_PROVEEDOR`.

## Si algo falla

- "Falta vincular Workers AI": falta el paso 2 o el nombre no es exactamente `AI`.
- "Se alcanzó el límite gratuito diario": se usó el cupo del día; vuelve a las 21 h.
- "Tu cuenta no está habilitada": el email no está en `finanzas/meta/usuarios`.
- Para ver errores: en el Worker → **Observabilidad** / **Logs**.
