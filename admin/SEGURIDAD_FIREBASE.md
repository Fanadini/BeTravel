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
     emailContacto: "facundo.berdini@betravel.com.ar"   (opcional)
   ```

   `emailContacto` es opcional. El cierre de cada propuesta muestra el mail de quien armó la cotización: por defecto, el email de su cuenta de Google. Si alguien entra con una cuenta que no es la de la empresa (por ejemplo, una de Gmail), cargá acá el mail que debe ver el cliente.

4. Repetí para cada persona que use el admin, con uno de estos roles:
   - `admin`: todo, incluidas facturas de proveedores, reparto, lista de usuarios y prefijo de códigos.
   - `agente` (o sin rol): Kanban, Gestión interna (sin reparto ni facturación) y Cotizador.
   - `cotizador`: **solo el Cotizador y solo sus propias cotizaciones**: no ve las de otras personas (ni las del admin), y las reglas lo hacen cumplir. No puede ver reservas, pasajeros, facturas, recordatorios ni prospectos, y en el Cotizador no tiene "Convertir en reserva". Admin y agentes ven todas las cotizaciones, con una columna "Creada por". Si entra a Gestión interna o al Kanban, ve el aviso "tiene acceso solo al Cotizador" con un botón para ir.

    Para que un `cotizador` también use la página **Grupos** (formulario de pasajeros, habitaciones y exportaciones), sumá `grupos: true` a su entrada. Sigue sin ver reservas, facturas ni prospectos, y en el Cotizador sigue viendo solo sus cotizaciones. Requiere haber publicado las reglas (paso 2).

    **Con las reglas actuales, una cuenta que no figure acá no puede leer ni escribir nada** en `finanzas` ni en `kanban`: la lista es la lista de acceso. Las tres páginas del admin muestran la pantalla "Acceso restringido", con el email de la cuenta y un botón para salir, cuando alguien se loguea sin figurar acá. La clave es el email en minúsculas, con todos los `.` cambiados por `,` (por ejemplo, `ligia,ferrari@betravel,com,ar`).

### Cuentas con email @betravel.com.ar

El correo de betravel.com.ar está en Zoho, no en Google, así que esas direcciones no son cuentas de Google de entrada. Para que alguien entre con "Continuar con Google" usando su email de la empresa:

1. En https://accounts.google.com/signup → **Crear cuenta** → **Para uso personal** → cuando pida el email, elegí **"Usar mi dirección de correo electrónico actual"** y cargá el email @betravel.com.ar.
2. Google manda un código a ese email (llega a Zoho): se confirma y listo. Es gratis y no crea una casilla de Gmail.
3. Cargá esa persona en `finanzas/meta/usuarios` como en el paso 3.

## 2. Publicar `database.rules.json`

1. Copiá el contenido completo de `/database.rules.json` (raíz del repo).
2. En Firebase Console → Realtime Database → pestaña **Reglas**, pegalo reemplazando lo que haya.
3. Publicá. Si después algo no carga, revisá que tu entrada en `meta/usuarios` tenga la clave exacta; si hace falta, pegá la versión anterior de las reglas y avisá.

Qué exigen las reglas: email verificado y entrada en `finanzas/meta/usuarios` para leer o escribir `finanzas` y `kanban`; rol `admin` para `finanzas/facturas`, la lista de usuarios y el prefijo de códigos de cotización. El rol `cotizador` solo llega a sus propias cotizaciones en `finanzas/cotizaciones` (se lee con un filtro por autor y solo se escriben documentos cuyo `creadoPor` es su mail), las imágenes de portada, la numeración de cotizaciones, los proveedores (lectura) y su propia entrada de usuario. Las reglas se probaron con el emulador oficial de Firebase Realtime Database (144 casos: admin, agente, cuenta sin rol, cotizador, cuenta no habilitada, email sin verificar y anónimo). El formulario público del sitio puede crear prospectos nuevos en `kanban/prospectos` sin login, pero no editarlos.

> **Nota sobre una versión anterior de estas reglas:** en la primera versión, `finanzas/reservas/{id}/reparto` y `/facturacion` tenían una regla `.validate` que solo dejaba guardar a un agente si ese sub-árbol quedaba exactamente igual al valor anterior. En la práctica esto rompió el guardado normal de reservas (el sistema reescribe el objeto completo en cada guardado, y la comparación de igualdad de un sub-árbol completo no es confiable en el lenguaje de reglas de Firebase) — se sacó esa restricción. Ahora reparto/facturación de una reserva se protegen únicamente del lado del cliente (el panel las oculta para el rol `agente`), no del lado del servidor. Es una limitación conocida: un agente con herramientas de desarrollador podría en teoría escribir ahí directo vía la API. Si en el futuro se quiere cerrar ese hueco, la forma correcta es que el guardado de una reserva deje de reescribir el objeto completo y pase a `update()` por campo — recién ahí una regla de escritura admin-only sobre esos dos campos puntuales funciona bien.

## 3. Habilitar backups automáticos

1. Firebase Console → Realtime Database → pestaña **Backups** (requiere plan Blaze — de pago por uso; si el proyecto está en el plan Spark gratuito, hay que upgradearlo primero).
2. Elegí un bucket de Cloud Storage (podés crear uno nuevo, ej. `betravel-kanban-backups`) y una frecuencia (diaria recomendada).
3. Confirmá que el bucket de backups tiene acceso restringido (no público) — por defecto los buckets nuevos de Cloud Storage son privados, no hace falta tocar nada extra salvo no cambiarlo.

## 4. Cotizador (`admin/cotizador.html`)

El cotizador usa estos nodos, todos habilitados en `database.rules.json`:

- `finanzas/cotizaciones`: las cotizaciones.
- `finanzas/meta/cotizacionCodigoCounter` y `cotizacionPrefijo`: numeración. El prefijo (por defecto `COT-`) lo cambia solo un admin.
- `finanzas/imagenesMeta` y `finanzas/imagenesData`: la biblioteca de imágenes de portada por destino. Las imágenes se guardan reducidas (unos 300 a 500 KB cada una); la completa solo se descarga al armar la propuesta.
- `finanzas/anexosMeta` y `finanzas/anexosData`: los archivos (imágenes y PDF) de los anexos de las propuestas. Cada página de un PDF se guarda como una imagen en `anexosData` (se descarga solo al armar la propuesta) y la miniatura en `anexosMeta`. Mismas reglas que las imágenes de portada: cualquier cuenta habilitada, incluido el rol `cotizador`, puede leer y escribir. **Hay que volver a publicar `database.rules.json` (paso 2) para poder subir archivos a los anexos**; mientras tanto el cotizador avisa que Firebase rechazó el guardado. Al quitar un archivo, o al eliminar el anexo o la cotización, sus páginas se borran de Firebase si ninguna otra cotización las usa.

- `finanzas/meta/datosCobro`: datos de cobro de la agencia para el flyer (formas de pago, condición del tipo de cambio y datos bancarios). Los carga un **admin** desde la tarjeta "Flyer" del Cotizador (botón "Guardar como datos de cobro de la agencia"); cualquier cuenta habilitada los lee, incluido el rol `cotizador`. **Hay que volver a publicar `database.rules.json` (paso 2) para poder guardarlos.** Cada cotización puede reemplazarlos con sus propios datos.
- `finanzas/contratos`: los contratos que se arman en `admin/contratos.html` (datos del cliente, del viaje, pagos y cláusulas). **Solo un admin puede leer y escribir**; ningún otro rol, tampoco `cotizador`, ve esos datos. `finanzas/meta/contratoAgencia` guarda los datos de BeTravel que se repiten en cada contrato (representante, legajo, CUIT, domicilio, datos bancarios): los lee cualquier cuenta habilitada y solo los escribe un admin. **Hay que volver a publicar `database.rules.json` (paso 2) para poder guardar contratos.**
Hasta que se publiquen las reglas (paso 2), Firebase rechaza los guardados en esos nodos y el cotizador lo avisa con un mensaje en rojo. "Convertir en reserva" escribe en `finanzas/reservas`.

La redacción con IA no pasa por Firebase: usa un Worker de Cloudflare con Workers AI, sin costo en el plan gratuito (ver `infra/redactor/LEEME.md`).

## 5. Grupos y formulario de pasajeros (`pasajeros.html` + `admin/grupos.html`)

Nodo `grupos/{token}` con `meta` (nombre, estado, lista de invitados), `respuestas` y `habitaciones`:

- El pasajero abre `pasajeros.html?g={token}` sin login. El token es el id del grupo (22 caracteres al azar) y es la única barrera de escritura: quien tenga el link puede cargar una respuesta.
- Las reglas permiten **solo crear** respuestas nuevas (no editar ni borrar) y solo si `meta/activo` es `true`; validan campos, largos, fechas y el consentimiento. **Cerrá el grupo** desde `admin/grupos.html` (pestaña Ajustes) cuando termine la recolección: es lo que frena el spam.
- `meta` se lee con el token (nombre, estado y lista de invitados para armar los desplegables). Las respuestas (pasaporte, salud, contacto) **no tienen lectura pública**: solo las leen y escriben cuentas habilitadas con rol `admin` o `agente`, no `cotizador`. Tampoco se puede listar `grupos` sin login.
- Las preguntas de cada grupo se arman en `admin/grupos.html` (pestaña Formulario) y se guardan en `grupos/{token}/meta/form`; `form-default.js` en la raíz es el modelo original. Las reglas exigen solo `nombre`, `apellido` y `ts`; las preguntas agregadas se guardan como texto de hasta 1000 caracteres. Algunas preguntas del modelo (fechas, tipo de habitación, cama, comparte, consentimiento) tienen formato fijo porque las reglas y el panel de habitaciones dependen de él.
- **Hay que volver a publicar `database.rules.json` (paso 2)** antes de usar el formulario; mientras tanto el pasajero ve un aviso de error y el panel muestra el banner rojo.

### Pagos de la reserva asignados a pasajeros del grupo

- `finanzas/reservas/{id}/grupoId` vincula la reserva con un grupo (se elige en Datos generales de la reserva, o desde Ajustes del grupo). Cada pago de la reserva guarda `grupoPasajeros` (ids de respuestas del grupo) y, si se cargó desde la página Grupos, `origen: "grupos"`. Un pago asignado a varios pasajeros se reparte en partes iguales para la columna Pagos de Grupos. No hay dos copias del dato: ambos lados leen y escriben los pagos de la reserva.
- `gruposIndex/{token}` guarda solo el nombre de cada grupo para poder elegirlo desde una reserva sin descargar los datos de los pasajeros. Lo mantiene la página Grupos.

### Recibos (pestaña Recibos de Gestión interna)

- `finanzas/recibos/{id}`: cada recibo emitido (número R-0001, fecha, a quién, concepto, ítems, reserva y pago de origen). `finanzas/meta/reciboCounter` lleva el último número. Leen y escriben admin y agente; el cotizador no tiene acceso. **Hay que volver a publicar `database.rules.json` (paso 2)** para poder guardar recibos; hasta entonces la pestaña muestra error de sincronización.
- El PDF se genera con la impresión del navegador ("Guardar como PDF"); no sale nada del navegador. Eliminar un recibo es solo para admin y no reutiliza el número.

### Reservas compartidas en solo lectura (cotizadores)

- Un admin comparte una reserva desde la lista de Gestión interna (columna Compartir). Se guarda en `finanzas/reservasCompartidas/{email con "," en lugar de "."}/{id de reserva}: true`. Solo un admin lee y escribe ese nodo; cada persona lee únicamente su propia entrada.
- Las reglas dejan leer `finanzas/reservas/{id}` a la cuenta que la tenga compartida; no puede listar las demás ni escribir. Las ve en `admin/compartidas.html` (menú "Reservas"), que muestra datos generales, valor cotizado, pagos y comprobantes, y oculta costos, margen, reparto y facturación. **Ocultar es solo de pantalla: la reserva completa es legible por esa cuenta** desde la base.
- Con `grupos: true` en su entrada, esa cuenta ve además la columna Pagos de Grupos (solo lectura) para las reservas compartidas y vinculadas.

## Notas

- Estas reglas son un primer borrador (ver plan de implementación). Cubren: lectura de `finanzas`/`kanban` solo para usuarios logueados, escritura de `reparto`/`facturacion`/`facturas` solo para admins, y escritura pública pero de solo-creación (no edición/borrado) en `kanban/prospectos` para que el formulario del sitio pueda cargar leads sin login.
- El campo `origen` no está validado en las reglas (cualquier `.push()` autenticado o anónimo puede escribir lo que quiera en un prospecto nuevo) — es aceptable para esta primera versión porque el impacto de un dato de más en el kanban es bajo, pero si empieza a llegar spam conviene sumar validación de campos mínimos requeridos.
