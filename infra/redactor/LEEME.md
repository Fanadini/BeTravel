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

## Leer vuelos desde una captura de pantalla

En el Cotizador, dentro de un servicio de tipo Aéreo, se puede pegar una captura de los vuelos (clic en el recuadro y Ctrl + V) y los tramos se completan solos. Usa el mismo Worker y el mismo enlace `AI`, sin configuración extra:

- El Worker manda la imagen a un modelo con visión de Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct` y, si falla, `@cf/mistralai/mistral-small-3.1-24b-instruct`), dentro del mismo cupo gratuito diario. Una lectura usa unas 200 a 400 neuronas.
- Para cambiar el modelo, creá la variable `MODELO_VISION` con el id del modelo en Configuración → Variables.
- Con `IA_PROVEEDOR=claude`, la lectura la hace Claude (más precisa, con costo por uso).
- **La lectura automática puede equivocarse.** El cotizador deja la captura al lado de los datos, compara la duración total que dice la captura con la calculada a partir de los horarios cargados, y avisa si no coinciden. Aun así, hay que revisar horarios, códigos y números de vuelo antes de enviar la propuesta.

## Si algo falla

- "Falta vincular Workers AI": falta el paso 2 o el nombre no es exactamente `AI`.
- "Se alcanzó el límite gratuito diario": se usó el cupo del día; vuelve a las 21 h.
- "Tu cuenta no está habilitada": el email no está en `finanzas/meta/usuarios`.
- "No se pudo leer la captura": ningún modelo con visión respondió. Probá de nuevo, con una captura más nítida, o revisá en Logs el error del modelo.
- Para ver errores: en el Worker → **Observabilidad** / **Logs**.
