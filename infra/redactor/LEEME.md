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

## Leer habitaciones y precios desde una cotización pegada

En el Cotizador, dentro de un servicio de tipo Hotel, se puede pegar la cotización de un proveedor o una planilla de Excel y las habitaciones se completan solas (tipo, categoría, cantidad y precio por habitación). Usa el mismo Worker y el mismo enlace `AI`, sin configuración extra, pero **hay que volver a pegar `worker.js` en Cloudflare** (paso 1 de la configuración) para que exista esta función.

- Se puede pegar texto (celdas de Excel, el mail o el PDF del proveedor), una captura de pantalla, o elegir un archivo de imagen, `.csv` o `.txt`. El texto es más confiable que la captura: si copiás celdas de Excel, se usa el texto aunque el portapapeles también traiga la imagen.
- Texto: usa Llama 3.3 70B. Captura: usa los mismos modelos con visión que los vuelos. Un pedido usa unas 100 a 400 neuronas del cupo gratuito diario.
- El selector "Los precios que pegás son" define si el precio pegado es el costo del proveedor (se le suma el markup) o el precio de venta final (el costo queda en 0).
- Si el documento indica que el precio es por noche, el cotizador lo multiplica por las noches (las del documento o, si no figuran, las de las fechas de la cotización). Si es por persona, lo multiplica por los ocupantes de cada tipo de habitación. Ambos casos se avisan.
- Si el documento trae varios hoteles, el primero se carga en el servicio actual y los demás como servicios nuevos debajo.
- **La lectura puede equivocarse.** Lo pegado queda al lado de los datos, y el cotizador avisa si cantidad × precio no coincide con el total que decía el documento o si la suma no coincide con el total del hotel. Aun así, hay que revisar cantidades y precios antes de enviar la propuesta.

## Si algo falla

- "Falta vincular Workers AI": falta el paso 2 o el nombre no es exactamente `AI`.
- "Se alcanzó el límite gratuito diario": se usó el cupo del día; vuelve a las 21 h.
- "Tu cuenta no está habilitada": el email no está en `finanzas/meta/usuarios`.
- "No encontré habitaciones con precio": lo pegado no tenía tipo de habitación, cantidad y precio. Pegá la parte de la tabla con esas columnas.
- "No se pudo leer la captura": ningún modelo con visión respondió. Probá de nuevo, con una captura más nítida, o revisá en Logs el error del modelo.
- Para ver errores: en el Worker → **Observabilidad** / **Logs**.
