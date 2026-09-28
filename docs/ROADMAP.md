# Roadmap — DND Party / Rakets Campaign

Última actualización: 27 de septiembre de 2026

## Decisión vigente

Las Etapas 1 y 2 quedan cerradas en desarrollo local con pruebas automatizadas. La Etapa 3 fue reabierta para validación visual después de que la primera pasada no produjera una diferencia suficientemente evidente en Party Hub. El despliegue de reglas, App Check y la validación final con cuentas reales se mantienen como controles manuales de publicación: no se ejecutan desde este entorno.

## Estado general

| Etapa | Estado | Avance estimado | Punto actual |
| --- | --- | ---: | --- |
| 1. Base segura y costos | **Cerrada en desarrollo** | 100% local | Reglas y Storage validados con emuladores; producción requiere activación manual controlada |
| 2. Mesa compartida MVP | **Cerrada en desarrollo** | 100% MVP local | Flujo DM/party aislado, versionado y probado; queda UAT manual antes de publicar |
| 3. Experiencia visual y motor | **Cerrada localmente** | 100% local | Catálogo visual por familias, pulido de movimiento, accesibilidad y rendimiento; publicación queda fuera de este cierre |
| 4. Herramientas avanzadas de juego | Pendiente | 0% | Depende de estabilizar Mesa en vivo y el motor visual |
| 5. Producto y escalabilidad | Pendiente | 0% | Depende de las decisiones de uso real de las etapas anteriores |

## Etapa 1 — Base segura, datos y costos

### Cierre local completado

- Notas privadas del DM separadas de los documentos públicos de campaña.
- Reglas de Firestore y Storage endurecidas según rol y pertenencia.
- Migración preparada para la estructura de seguridad nueva.
- App Check incorporado como configuración opcional, sin bloquear desarrollo local.
- Funciones de IA paga desactivadas por defecto y con límites configurables.
- Optimización de imágenes y limpieza de Storage al borrar mapas.
- Límites de presupuesto configurados manualmente por el propietario del proyecto.
- Mapas editables restringidos al DM y proyecciones públicas con lista blanca de campos.
- Storage probado para propiedad, tipo de archivo, tamaño, borrado y permisos DM.
- Firebase Emulator aislado en `.tools`, sin credenciales y con proyecto ficticio `demo-dnd-app`.
- 10 pruebas de reglas aprobadas: separación DM/party, revisiones, migración heredada y Storage.

### Controles manuales antes de producción

- Confirmar identificadores reales de campaña y perfiles antes del despliegue.
- Desplegar reglas únicamente desde una revisión aprobada.
- Activar App Check primero en observación y evaluar enforcement después de verificar tráfico legítimo.
- Realizar una prueba de humo con una cuenta DM y otra de jugador, sin compartir credenciales.

## Etapa 2 — Mesa compartida MVP

### MVP local completado

- Nueva Mesa en vivo para el DM y vista de proyector para la party.
- Sincronización en tiempo real de mapa, mensaje y estado de combate.
- Tokens arrastrables y visibilidad controlada por el DM.
- Niebla de guerra por celdas, eventos de combate compartidos y ficha en tiempo real.
- Flujo explícito borrador del DM → publicación para la party.
- La transmisión contiene una copia filtrada; trampas y fichas ocultas no llegan al cliente party.
- Revisiones consecutivas, detección de conflictos entre ventanas y estado de reconexión.
- Deshacer/rehacer con historial acotado y confirmación de borrado masivo.
- Zoom con rueda o gesto de dos dedos, paneo táctil y presets cubrir/revelar niebla.

### Validación manual de publicación

- Abrir DM y proyector con dos cuentas reales y verificar el recorrido completo.
- Probar un mapa real en el dispositivo táctil que vaya a utilizarse durante la partida.
- Confirmar legibilidad y rendimiento en el proyector/TV definitivo.

## Etapa 3 — Experiencia visual y motor gráfico

### 3A. Sistema visual — segunda pasada en validación

- Identidad visual premium para Rakets Campaign.
- Fondo ilustrado original integrado como recurso local.
- Nueva pantalla de acceso cinematográfica, responsive y accesible.
- Tokens unificados de color, tipografía, bordes, profundidad y movimiento.
- Lenguaje visual extendido a Party Hub, Panel DM, páginas de campaña, ficha y Mesa en vivo.
- Fuentes locales Cinzel, Crimson Pro e Inter, sin conexiones externas en tiempo de ejecución.
- Iconografía vectorial consistente en navegación, acciones principales y controles DM.
- Botones principales rediseñados con jerarquía, materiales y estados propios de la temática.
- Paneles y controles principales unificados con materiales, profundidad, jerarquía y estados coherentes.
- Validación responsive automatizada por compilación; la revisión perceptual en dispositivos reales queda como control manual.
- Party Hub reconstruido como tablero de campaña: cabecera cinematográfica, franja de estado, fichas horizontales y paneles con materiales diferenciados.
- Tarjetas de Aurelian, Mog, Kaelion y la party con retrato dominante, símbolo SVG de clase, nivel, estadísticas y barras jerarquizadas.
- La primera pasada fue considerada insuficiente por el usuario; por eso el bloque no se considera cerrado todavía.

### 3B. Motor de mapa 2D — completada para el alcance de esta etapa

- PixiJS incorporado como dependencia y cargado en un bloque separado de la aplicación.
- Primera cámara con zoom, paneo y centrado.
- Capas de mapa, cuadrícula, niebla y tokens renderizadas por GPU.
- Render diferenciado para DM y party, respetando tokens ocultos y niebla.
- Tokens con retratos enmarcados o monogramas, sin depender de emojis del sistema.
- Niebla visual orgánica con masa continua, bordes suaves, textura local y movimiento reducido opcional.
- Selección directa de fichas y cambio adaptativo entre medallón y tarjeta según zoom o selección.
- Edición múltiple, snapping y transformaciones avanzadas pasan a la Etapa 4 para no mezclar el motor visual con herramientas de autoría.

### 3C. Representación táctica — completada

- Token básico reemplazado por una tarjeta táctica adaptable vinculada al personaje real.
- Vista de mapa: tarjeta compacta con retrato o símbolo vectorial, nombre, clase/nivel y barra vital.
- Vista cercana o seleccionada: tarjeta ampliada con avatar, nombre, vida y datos adicionales para el DM.
- El DM ve información adicional como CA; la proyección elimina identificadores, notas y campos privados mediante lista blanca.
- Variantes vectoriales coherentes para PJ, NPC/monstruo, trampa, objeto y fichas personalizadas.
- Paleta y editor táctico sin depender de emojis del sistema.
- Materiales, iluminación, marcos y texturas locales más realistas, manteniendo contraste y legibilidad.
- Las estadísticas de fichas vinculadas se actualizan desde los personajes antes de publicar la escena.

PixiJS quedó instalado con el gestor del proyecto. No requiere servicios pagos ni agrega consumo a Firebase.

### 3D. Interacción y ambientación — base completada

- Transiciones de escena, revelado de mapa y niebla orgánica animada.
- HUD de iniciativa y estados sin tapar el tablero.
- Diseño específico para proyector/TV y segunda pantalla.
- Movimiento reducido, carga diferida del motor y límites de resolución para controlar rendimiento.
- Clima, partículas configurables y zonas de luz avanzadas pasan a la Etapa 4 como ambientación opcional.
- Mesa en vivo incorpora una demostración táctica exclusivamente local para visualizar PixiJS y fichas aunque no haya una escena seleccionada; no puede publicarse.

## Etapas posteriores

### Etapa 4 — Herramientas avanzadas

- Encuentros preparados, bestiario, cofres, trampas y puertas interactivas.
- Línea de tiempo, handouts, journal, audio ambiental y macros del DM.
- Importación/exportación y backups recuperables.

### Etapa 5 — Producto y escalabilidad

- Onboarding, múltiples campañas y permisos granulares.
- Accesibilidad completa y rendimiento en dispositivos modestos.
- Estrategia de costos basada en uso real antes de ampliar servicios pagos.

## Riesgos y controles

- **Costo:** las mejoras visuales locales no generan consumo de Firebase. El motor corre en el navegador.
- **Rendimiento:** los efectos serán progresivos y desactivables.
- **Datos:** la interfaz no migra ni borra campañas.
- **Seguridad:** no se desplegarán reglas ni App Check sin las pruebas pendientes de la Etapa 1.
- **Alcance:** la Etapa 3 se divide en 3A, 3B y 3C para aprobar cada bloque sin rehacer todo.
- **Permisos en producción:** durante la validación del 27/09 se observó `Missing or insufficient permissions` al leer `public_maps` y `live_sessions`. El mapa privado `Mapa TEST` sí existe y se carga. Resolver este punto requiere una revisión separada y autorizada de reglas/roles; no se alteró Firebase durante la pasada visual.

## Validación manual de la Etapa 3

1. Probar la tarjeta de Aurelian, Mog, Kaelion y el resto de la party con retratos reales.
2. Revisar legibilidad a distancia en el proyector/TV definitivo.
3. Medir fluidez con un mapa real y varias fichas en el dispositivo menos potente previsto.
4. Registrar ajustes perceptuales menores sin reabrir la arquitectura de la etapa.

## Registro de cambios — primera pasada de Etapa 3

- Se incorporó un modelo táctico reutilizable para normalizar clases, símbolos, colores y estadísticas.
- El editor de mapas ahora carga los personajes de campaña y permite colocarlos como tarjetas vinculadas.
- PixiJS alterna automáticamente entre medallones compactos y tarjetas expandidas; también permite expandir por selección.
- La proyección pública admite únicamente nombre, clase, nivel, vida, símbolo y presentación visual; CA, identificador interno y notas quedan fuera.
- Se reemplazaron los emojis visibles del flujo táctico por iconografía SVG local.
- No se modificaron campañas, documentos de Firestore, Storage, reglas de producción ni configuración de facturación.

## Registro de cambios — segunda pasada visual

- Reapertura de Etapa 3 a partir del feedback directo “no veo demasiados cambios”.
- Nueva escala y composición cinematográfica para la cabecera de campaña.
- Franja de información inmediata para objetivo, estado de juego y composición de la party.
- Fichas de personajes rediseñadas en formato horizontal, con retrato, icono vectorial de clase y jerarquía clara de estadísticas.
- Materiales y composiciones diferenciados para tablón, objetivos, misiones, botín, estadísticas y actividad.
- Escena de demostración táctica local incorporada a Mesa en vivo.
- Comprobación local aprobada: 10 pruebas automatizadas y compilación de producción exitosa.

## Registro de cambios — refinamiento de materiales e imaginería

- Se incorporó textura local de cuero repujado y madera oscura en fondos, paneles de campaña y hoja de personaje, con capas oscuras para conservar el contraste.
- El token de Dragón Rojo ahora usa una ilustración realista local tanto en el editor como en el render táctico.
- Las fichas de personajes en PixiJS muestran tarjetas con retrato y resumen de forma persistente; al acercarse o seleccionarlas, la tarjeta amplía sus datos.
- Se refinó la transición entre páginas con entrada gradual y desenfoque breve; se respeta la preferencia de movimiento reducido.
- Verificación local: `npm run build` completado correctamente. No se modificaron Firebase, campañas ni datos de producción.
- Corrección de compatibilidad: el editor y PixiJS aplican retratos locales a tokens antiguos de dragón rojo y NPC aliado; los PJ antiguos se vinculan solo si el nombre coincide de forma exacta y única con un personaje cargado. Todo se resuelve en memoria, sin actualizar Firestore.

## Registro de cambios — coherencia global de la experiencia visual

- Las hojas de personaje ahora usan anchos mínimos flexibles, límites de contenido y grillas adaptables; los paneles pasan a dos columnas y luego a una antes de desbordarse.
- Se unificó el emblema vectorial de la app entre la navegación principal y el acceso.
- La barra superior, el perfil y los encabezados de secciones incorporan madera visible y contraste; el perfil muestra el avatar si existe o iniciales si no.
- La misma superficie de nogal se usa como material para paneles, tarjetas y el marco del mapa; se preservan capas de humo verde/dorado.
- Se añadieron bruma ambiental lenta y reflejo cálido ocasional en la barra superior; ambos respetan `prefers-reduced-motion`.
- Verificación local: compilación de producción exitosa. Cambios solo de interfaz/recursos locales; sin modificaciones de Firebase o de datos de campaña.

## Registro de cambios — cierre local de los puntos 2 y 3

- El catálogo táctico ahora conserva el símbolo específico de cada tipo incluso si el token ya tiene una imagen asignada; el arte local y los iconos quedan consistentes entre editor, tarjetas y render del mapa.
- Se completó la cobertura visual por familias de criaturas, trampas, objetos, personajes y ubicaciones. Los recursos son locales; los tipos menos comunes mantienen iconografía vectorial distintiva como fallback en lugar de reutilizar un retrato incorrecto.
- Se cerró el refinamiento de movimiento, rendimiento y accesibilidad: movimiento reducido, pausa de animación cuando la pestaña queda oculta, calidad adaptativa del lienzo, navegación por teclado y etiquetas accesibles.
- Revisión local del usuario completada. Cierre de Etapa 3 aplica a la experiencia local; no implica despliegue ni verificación de producción.
- No se modificaron datos de Firebase, campañas, Storage, reglas remotas ni facturación.
