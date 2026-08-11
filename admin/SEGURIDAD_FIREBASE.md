# Seguridad de Firebase — Be•Travel

Guía para publicar las Security Rules versionadas en `database.rules.json` (raíz del repo) y habilitar backups. Esto no se puede hacer desde el código — son pasos manuales en la consola de Firebase.

## 1. Sembrar el primer usuario admin (antes de publicar las reglas)

El código ya tiene una salvaguarda: si `finanzas/meta/usuarios` está completamente vacío (nadie lo cargó todavía), **todos entran como admin** — así no te bloqueás a vos mismo el primer día. En cuanto cargues la primera entrada ahí, ese comportamiento "todos admin" se apaga y pasa a valer el rol de cada uno (cualquiera no listado cae a "agente"). Aun así, conviene sembrar tu propio usuario admin explícitamente antes de invitar a nadie más, para no depender de ese estado transitorio.

1. Andá a [Firebase Console](https://console.firebase.google.com/) → proyecto `betravel-kanban` → Realtime Database → pestaña **Datos**.
2. Buscá (o creá) el nodo `finanzas/meta/usuarios`.
3. Agregá una entrada con tu email, reemplazando cada `.` del email por `,` (es una limitación de las keys de Firebase — no acepta puntos):

   ```
   finanzas/meta/usuarios/tuemail@gmail,com
     email: "tuemail@gmail.com"
     rol: "admin"
     nombre: "Facu"
   ```

4. Repetí para cualquier otra cuenta admin. Cualquier cuenta de Google que se loguee y **no** tenga entrada acá va a entrar como `agente` (acceso restringido) por defecto — es el comportamiento fail-safe que ya está en el código.

## 2. Publicar `database.rules.json`

1. Copiá el contenido completo de `/database.rules.json` (raíz del repo).
2. En Firebase Console → Realtime Database → pestaña **Reglas**, pegalo reemplazando lo que haya.
3. **Antes de publicar, probá con el simulador de reglas** (botón "Rules Playground" en la misma pantalla). Puntos concretos a probar:
   - Login con una cuenta sin entrada en `meta/usuarios` → debería poder leer `finanzas/*` pero **no** escribir en `finanzas/facturas`.
   - Login con la cuenta admin sembrada en el paso 1 → debería poder escribir en todo, incluida `finanzas/facturas`.
4. Publicá.

> **Nota sobre una versión anterior de estas reglas:** en la primera versión, `finanzas/reservas/{id}/reparto` y `/facturacion` tenían una regla `.validate` que solo dejaba guardar a un agente si ese sub-árbol quedaba exactamente igual al valor anterior. En la práctica esto rompió el guardado normal de reservas (el sistema reescribe el objeto completo en cada guardado, y la comparación de igualdad de un sub-árbol completo no es confiable en el lenguaje de reglas de Firebase) — se sacó esa restricción. Ahora reparto/facturación de una reserva se protegen únicamente del lado del cliente (el panel las oculta para el rol `agente`), no del lado del servidor. Es una limitación conocida: un agente con herramientas de desarrollador podría en teoría escribir ahí directo vía la API. Si en el futuro se quiere cerrar ese hueco, la forma correcta es que el guardado de una reserva deje de reescribir el objeto completo y pase a `update()` por campo — recién ahí una regla de escritura admin-only sobre esos dos campos puntuales funciona bien.

## 3. Habilitar backups automáticos

1. Firebase Console → Realtime Database → pestaña **Backups** (requiere plan Blaze — de pago por uso; si el proyecto está en el plan Spark gratuito, hay que upgradearlo primero).
2. Elegí un bucket de Cloud Storage (podés crear uno nuevo, ej. `betravel-kanban-backups`) y una frecuencia (diaria recomendada).
3. Confirmá que el bucket de backups tiene acceso restringido (no público) — por defecto los buckets nuevos de Cloud Storage son privados, no hace falta tocar nada extra salvo no cambiarlo.

## Notas

- Estas reglas son un primer borrador (ver plan de implementación). Cubren: lectura de `finanzas`/`kanban` solo para usuarios logueados, escritura de `reparto`/`facturacion`/`facturas` solo para admins, y escritura pública pero de solo-creación (no edición/borrado) en `kanban/prospectos` para que el formulario del sitio pueda cargar leads sin login.
- El campo `origen` no está validado en las reglas (cualquier `.push()` autenticado o anónimo puede escribir lo que quiera en un prospecto nuevo) — es aceptable para esta primera versión porque el impacto de un dato de más en el kanban es bajo, pero si empieza a llegar spam conviene sumar validación de campos mínimos requeridos.
