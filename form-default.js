// Formulario por defecto de pasajeros. Lo usan pasajeros.html (cuando el grupo no tiene formulario propio)
// y admin/grupos.html (al crear un grupo y al restaurar). Cada pregunta:
//   id        clave de la respuesta en Firebase (las que tienen "fija" no se pueden cambiar de tipo ni de opciones)
//   tipo      corto | largo | fecha | email | tel | numero | radio | lista | multiple | casilla | companero | texto | seccion
//   mostrarSi { id, valores:[...] } mostrar solo si la pregunta "id" tiene alguno de esos valores
//   bloqueada no se puede eliminar; fija: el panel de habitaciones y las reglas de Firebase dependen de su formato
window.FORM_DEFAULT = [
  { id:'sec_personales', tipo:'seccion', etiqueta:'Datos personales' },
  { id:'nombre', tipo:'corto', etiqueta:'Nombre completo (como figura en el pasaporte)', requerido:true, mitad:true, max:100, bloqueada:true },
  { id:'apellido', tipo:'corto', etiqueta:'Apellido completo (como figura en el pasaporte)', requerido:true, mitad:true, max:100, bloqueada:true },
  { id:'nacimiento', tipo:'fecha', etiqueta:'Fecha de nacimiento', requerido:true, mitad:true, fija:true },
  { id:'nacionalidad', tipo:'corto', etiqueta:'Nacionalidad', requerido:true, mitad:true, max:100 },

  { id:'sec_pasaporte', tipo:'seccion', etiqueta:'Pasaporte' },
  { id:'pasaporte', tipo:'corto', etiqueta:'Número de pasaporte', requerido:true, mitad:true, max:30 },
  { id:'paisPasaporte', tipo:'corto', etiqueta:'País emisor del pasaporte', requerido:true, mitad:true, max:100 },
  { id:'lugarPasaporte', tipo:'corto', etiqueta:'Lugar de emisión del pasaporte', max:100 },
  { id:'emision', tipo:'fecha', etiqueta:'Fecha de emisión del pasaporte', requerido:true, mitad:true, fija:true },
  { id:'vencimiento', tipo:'fecha', etiqueta:'Fecha de vencimiento del pasaporte', requerido:true, mitad:true, fija:true },

  { id:'sec_contacto', tipo:'seccion', etiqueta:'Contacto' },
  { id:'email', tipo:'email', etiqueta:'Correo electrónico', requerido:true, mitad:true, max:120 },
  { id:'telefono', tipo:'tel', etiqueta:'Teléfono / WhatsApp (con código de país)', requerido:true, mitad:true, max:40 },
  { id:'emergencia', tipo:'largo', etiqueta:'Contacto de emergencia (nombre, parentesco y teléfono)', requerido:true, max:300 },

  { id:'sec_alojamiento', tipo:'seccion', etiqueta:'Alojamiento' },
  { id:'tipoHabitacion', tipo:'radio', etiqueta:'Tipo de habitación', requerido:true, opciones:['Single','Doble','Triple','Cuádruple'], ayuda:'Single corresponde a una habitación individual.', fija:true },
  { id:'tipoCama', tipo:'radio', etiqueta:'Tipo de cama', opciones:['Twin','Matrimonial'], ayuda:'Twin: camas separadas, sujeto a disponibilidad. Matrimonial: cama doble.', mostrarSi:{ id:'tipoHabitacion', valores:['Doble','Triple','Cuádruple'] }, fija:true },
  { id:'comparte', tipo:'radio', etiqueta:'¿Comparte habitación con otro pasajero del grupo?', requerido:true, opciones:['Sí','No'], mostrarSi:{ id:'tipoHabitacion', valores:['Doble','Triple','Cuádruple'] }, fija:true },
  { id:'compartiCon', tipo:'companero', etiqueta:'Si comparte, ¿con quién? (nombre y apellido)', requerido:true, ayuda:'Elija a la persona de la lista. Si todavía no completó el formulario, escriba su nombre y apellido.', mostrarSi:{ id:'comparte', valores:['Sí'] }, fija:true },

  { id:'sec_salud', tipo:'seccion', etiqueta:'Salud y asistencia' },
  { id:'restricciones', tipo:'largo', etiqueta:'Restricciones alimentarias / alergias (indicar "Ninguna" si no tiene)', requerido:true, max:500 },
  { id:'movilidad', tipo:'largo', etiqueta:'Necesidades de movilidad o asistencia especial (indicar "Ninguna" si no tiene)', requerido:true, max:500 },
  { id:'medicas', tipo:'largo', etiqueta:'Condiciones médicas relevantes para el viaje (opcional)', max:1000 },

  { id:'sec_consentimiento', tipo:'seccion', etiqueta:'' },
  { id:'consentimiento', tipo:'casilla', etiqueta:'Acepto el tratamiento de mis datos personales para la organización del viaje (Ley 25.326).', requerido:true, fija:true }
];
