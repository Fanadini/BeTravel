# CLAUDE.md — Be•Travel

Contexto operativo para Claude Code. Leer antes de cualquier intervención en este proyecto.

---

## El proyecto

**Be•Travel** es una agencia B2B especializada en turismo de grupos y corporativo, con sede en Buenos Aires. Pre-operacional: estructura comercial y digital en construcción. Sin casos de clientes cerrados aún.

**Propietario:** Facu (Facundo) — también trabaja como Mobility Analyst en Deel bajo Monotributo.

**Posicionamiento central:** partner de ejecución, no canal de distribución. El diferencial es el criterio (juicio previo), no el destino ni el precio.


---

## Stack técnico

| Componente | Tecnología | Detalle |
|---|---|---|
| Hosting | **GitHub Pages** | Repo `Fanadini/BeTravel`, archivos estáticos servidos desde la raíz de `main` — sin build step |
| Deploy | Automático | Todo push/merge a `main` publica en vivo al instante (no hace falta subir nada a mano) |
| Dominio | `betravel.com.ar` | Configurado vía archivo `CNAME` en la raíz del repo |
| DNS / CDN | Cloudflare | Apunta el dominio a GitHub Pages (ya no a SiteGround) |
| Sitio | HTML estático | Sin WordPress, sin CMS |
| Formularios | Formspree | `https://formspree.io/f/xredoyja`, fetch async desde `index.html` |
| Kanban CRM | Firebase Realtime DB | Proyecto: `betravel-kanban` |
| Firebase URL | `betravel-kanban-default-rtdb.firebaseio.com` | |
| Diseño | Canva | Para piezas sociales |
| Imágenes | Unsplash / Pexels / fotos propias / Nano Banana (IA) | |

> Ya no usamos SiteGround ni PHP (`mail.php`) para nada — el hosting y el deploy son 100% GitHub Pages.

---

## Estructura de archivos (raíz del repo)

```
/
├── CNAME                    ← dominio custom para GitHub Pages (betravel.com.ar)
├── index.html               ← Home principal
├── becorporate.html         ← Página Be•Corporate (MICE / corporativo)
├── vacacional.html          ← Página Be•Travel · Vacacional (premium)
├── becommunity.html         ← Página Be•Community (grupos de afinidad)
├── style.css
├── robots.txt / sitemap.xml
├── *.jpg                    ← imágenes (hero, editorial, etc.)
├── guia_interna/
│   └── index.html           ← Guía de formación interna
└── admin/
    ├── kanban.html           ← CRM interno (Firebase)
    └── finanzas.html         ← Finanzas / Reservas / Facturas de proveedores (Firebase)
```

---

## Marca — Reglas no negociables

### Nombre
- Marca visual: `Be•Travel` — el punto `•` es parte esencial del logo
- Legal/operativo: `BeTravel` (sin punto)
- Nunca mezclar ambas formas en una misma pieza
- Unidades de negocio: `Be•Corporate`, `Be•Travel` (unidad vacacional, lleva calificador `· Vacacional` en títulos, nav y menciones estructurales para no confundirse con la marca madre), `Be•Community`

### Paleta
```
#0F3D3E  → Verde oscuro   | Principal — identidad, fondos, logotipo
#E6E1D8  → Beige          | Base — lectura, espacios de calma
#2B2B2B  → Casi negro     | Texto funcional
#B08A5A  → Dorado/bronce  | Acento editorial (uso muy limitado)
```

### Tipografía
- Títulos: **Inter Semibold**
- Cuerpo: **Inter Regular**
- Sin degradados, sin íconos turísticos cliché, sin sombras decorativas

### Tono de escritura
- Ustedeo formal en todo contenido de marca (web, propuestas, RRSS)
- Sin emojis en LinkedIn, web ni propuestas
- Sin superlativos vacíos: "único", "increíble", "el mejor", "soñado"
- Sin lenguaje retail: "paquetes", "ofertas", "promociones especiales"
- Sin exclamaciones en B2B formal
- Afirmar con seguridad: "coordinamos" no "podríamos coordinar"

### Filtro editorial
> ¿Esto lo firmaría un Travel Manager como proveedor de confianza, o suena a agencia retail? Si necesita exclamaciones para funcionar, el argumento no es lo suficientemente sólido.

---

## Kanban CRM — Notas técnicas

- Desplegado en `betravel.com.ar/admin/kanban.html`
- Base Firebase: estructura de prospects con multi-contacto
- Autosave activo en todas las interacciones
- 60 prospects cargados, segmentados por sector corporativo
- Columnas con counter, drag-and-drop con listeners preservados
- **Crítico:** al modificar HTML complejo, reconstruir el archivo completo es más confiable que chained string replacements
- **Crítico:** las Firebase security rules deben mantenerse activas

---

## Estructura fiscal (contexto, no código)

- Facu opera Be•Travel bajo **Monotributo** actualmente (factura B)
- Modelo proyectado: **BeTravel SRL** (persona jurídica separada) para preservar el Monotributo de Deel
- El modelo operativo es de **mandatario**: Be•Travel factura solo su fee de gestión, no el valor total del paquete
- Umbral de conveniencia para la SRL: ~$3.500.000/mes de facturación
- Proveedores principales: Tucano Tours (consolidador aéreo), Carnival Tours, RateHawk, MyBeds, Hotelbeds, Bedsonline, Freeway, Top Dest, Grupo Ocho

---

## Proveedores de contenido visual

- Fotos propias de Facu (viajes)
- Generación IA: Nano Banana (prompts desarrollados en Claude primero)
- Stock: Unsplash, Pexels

---

## Google Drive

- Carpeta principal BeTravel ID: `1SprizMdRbOkIvmGdvPbyJGQSJ4jgFfN6`
- La integración Drive es **read-only** desde Claude — los archivos deben subirse manualmente

---

## Patrones de trabajo

- Facu trabaja directamente sobre archivos HTML y prefiere iterar en sesión
- Respuestas directas, sin fluff, sin listas innecesarias
- Sparring activo: señalar riesgos e inconsistencias, no solo ejecutar
- Para contenido: checkpoints cortos de confirmación antes de versión final
- Idioma de trabajo: **español**
