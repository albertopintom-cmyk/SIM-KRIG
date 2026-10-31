# SIM-KRIG Project Memory

Registro único de continuidad del proyecto. Las sesiones se agregan en orden cronológico; las entradas previas no se eliminan ni se reescriben para ocultar decisiones históricas. Las etiquetas **Confirmado**, **Supuesto / no verificado** y **Pendiente** distinguen el nivel de certeza de cada dato.

## Estado del proyecto

- **Confirmado:** El proyecto fue iniciado y su definición conceptual inicial fue aprobada en la bitácora 001 del 31-10-2026.
- **Confirmado:** SIM-KRIG se concibe como una plataforma web de simulación y evaluación de recursos minerales, con una primera metodología basada en polígonos de influencia.
- **Confirmado:** El primer componente priorizado para diseño es el Módulo 1: Generación y gestión de polígonos de influencia.
- **Supuesto / no verificado en el código:** El contexto técnico declarado para el proyecto incluye Python, FastAPI, Streamlit, PostgreSQL y Supabase. No se encontraron archivos de implementación en la raíz observada durante la sesión 002; por lo tanto, no se confirma qué tecnologías están efectivamente instaladas o en uso.
- **Pendiente:** Diseñar funcionalmente el Módulo 1 y definir los datos de entrada y sus validaciones antes de considerar validada una implementación funcional.

## Decisiones confirmadas

- SIM-KRIG será una plataforma web para simulación y evaluación de recursos minerales; no estará dirigida exclusivamente a estudiantes.
- El público considerado incluye estudiantes, docentes, geólogos, ingenieros de minas, consultores, empresas mineras y otras personas interesadas en metodologías de estimación de recursos.
- La arquitectura objetivo contempla frontend web, backend de procesamiento, base de datos persistente, gestión de usuarios y proyectos, trazabilidad de cálculos y exportación de resultados. Esta es una definición conceptual, no una arquitectura verificada en código.
- La metodología inicial seleccionada es la estimación de recursos mediante polígonos de influencia.
- La secuencia metodológica identificada es: determinar o generar polígonos; calcular áreas por polígono y área total; determinar potencias; calcular volúmenes; determinar densidades; calcular recursos; determinar leyes; calcular finos; determinar la ley media del yacimiento y la ley de corte; y generar curvas tonelaje-ley y ley media.
- El diseño será modular: cada etapa metodológica podrá ser independiente, reutilizar resultados anteriores, admitir métodos alternativos y evolucionar sin afectar innecesariamente los demás módulos.
- El primer módulo que se diseñará es el de generación y gestión de polígonos de influencia.
- Las herramientas espaciales identificadas preliminarmente son generación automática, Convex Hull, Alpha Shape, polígonos de Thiessen/Voronoi, edición manual, inclusión y exclusión de sondajes y división y fusión de polígonos. Son alternativas identificadas, no métodos ya seleccionados o implementados.
- Se consideran para etapas futuras promedios simples y ponderados y métodos alternativos de cálculo de potencia, densidad y leyes, además del análisis de ley de corte y las curvas tonelaje-ley.

## Implementaciones validadas

- **No hay implementaciones funcionales de la aplicación validadas en esta memoria.**
- **Validado en esta sesión:** Se creó este archivo como registro estructurado y se transcribió y normalizó la información conceptual disponible en la bitácora de inicio existente.
- La bitácora 001 registra como aprobada la definición conceptual inicial; esto valida el acuerdo de alcance allí descrito, no una implementación de software.

## Módulos en desarrollo

- **Módulo 1: Generación y gestión de polígonos de influencia — diseño pendiente.**
  - Alcance previsto: cargar sondajes, visualizar su distribución espacial, generar y editar polígonos, asociar sondajes, calcular área y perímetro y preparar información para módulos posteriores.
  - Herramientas candidatas por evaluar: Convex Hull, Alpha Shape, Thiessen/Voronoi y edición manual, incluyendo inclusión/exclusión, división y fusión.
- No se identifican otros módulos con implementación en curso a partir de la documentación disponible.

## Pendientes prioritarios

1. Definir el método principal de generación de polígonos y los criterios de aceptación.
2. Especificar el tratamiento de sondajes aislados y los parámetros de control espacial.
3. Definir el flujo detallado de trabajo del usuario para el Módulo 1.
4. Definir formatos de carga, campos mínimos obligatorios, estructura de proyectos y reglas de validación.
5. Confirmar la arquitectura y las tecnologías efectivamente utilizadas en el repositorio cuando exista o esté disponible el código fuente.
6. Implementar y probar el Módulo 1 después de cerrar las definiciones funcionales y técnicas anteriores.

## Riesgos y limitaciones conocidas

- **Limitación observada:** En la revisión de esta sesión, la raíz del proyecto mostró una carpeta `docs` con una bitácora de texto y un documento Word; no se encontró un archivo de memoria Markdown ni código de aplicación. La búsqueda estuvo limitada al contenido visible en el espacio de trabajo.
- **Riesgo metodológico:** La selección de algoritmo, los criterios de aceptación y el tratamiento de sondajes aislados siguen pendientes; implementarlos sin acuerdo podría producir resultados no reproducibles o no aceptados.
- **Riesgo de datos:** Los formatos, campos obligatorios y reglas de validación aún no están definidos.
- **Limitación de validación:** No se ejecutaron pruebas de software en esta sesión porque no se encontró implementación de la aplicación que pudiera probarse.
- **Tecnología no confirmada:** Python, FastAPI, Streamlit, PostgreSQL y Supabase son tecnologías indicadas en el contexto del proyecto, pero no fueron verificadas en archivos de configuración o código.

## Próximas acciones

1. Diseñar el flujo de usuario del Módulo 1.
2. Comparar y seleccionar el método de generación de polígonos, definiendo criterios de aceptación y tratamiento de sondajes aislados.
3. Especificar los formatos de entrada, campos obligatorios y reglas de validación.
4. Confirmar el estado del repositorio y la arquitectura tecnológica con evidencia del código/configuración disponible.
5. Implementar el módulo y documentar pruebas reproducibles; actualizar esta memoria solo con resultados observados.

## Historial de sesiones

### Sesión 001 — Inicio del proyecto SIM-KRIG

- **Fecha:** 31-10-2026.
- **Objetivo trabajado:** Definir el propósito general, alcance inicial y estructura metodológica principal de la plataforma.
- **Decisiones tomadas — Confirmadas en la bitácora de origen:** Plataforma web de simulación y evaluación de recursos minerales; público diverso; arquitectura objetivo con frontend, backend, persistencia, usuarios, proyectos, trazabilidad y exportación; metodología inicial de polígonos de influencia; diseño modular; prioridad del Módulo 1.
- **Implementaciones realizadas:** Ninguna implementación de software registrada. Se definió conceptualmente el alcance inicial y se identificaron funcionalidades candidatas para el Módulo 1.
- **Validaciones efectuadas:** La bitácora de origen registra el resultado como “Aprobado”. No se documentan pruebas de software.
- **Pendientes identificados:** Método principal de generación, criterios de aceptación, tratamiento de sondajes aislados, parámetros espaciales, flujo de usuario, formatos de carga, campos mínimos, estructura de proyectos y reglas de validación.
- **Próxima acción registrada:** Diseñar funcionalmente el Módulo 1 y definir su flujo, métodos disponibles y criterios técnicos de validación.
- **Fuente preservada:** `docs/Nuevo Documento de texto.txt` y `docs/Nuevo Documento de Microsoft Word.docx`, documentos presentes en el espacio de trabajo revisado.

### Sesión 002 — Creación del registro único de memoria del proyecto

- **Fecha:** 31-10-2026.
- **Objetivo trabajado:** Crear `SIMKRIG_PROJECT_MEMORY.md` como registro incremental de contexto, decisiones, implementaciones validadas, pendientes y estado.
- **Decisiones tomadas:** Mantener la estructura normalizada solicitada; conservar la sesión 001 como antecedente; distinguir hechos confirmados, información no verificada y pendientes; no atribuir validación funcional sin evidencia.
- **Implementaciones realizadas:** Creado este archivo en la raíz del espacio de trabajo. Se estructuró la información de la bitácora de inicio en las secciones de estado, decisiones, implementaciones, módulos, pendientes, riesgos, próximas acciones e historial.
- **Validaciones efectuadas:** Se revisó la documentación de origen disponible. Se confirmó que no había un `SIMKRIG_PROJECT_MEMORY.md` previo en la búsqueda realizada y que la raíz observada contenía `docs`; no se ejecutaron pruebas funcionales por no encontrarse código de aplicación.
- **Pendientes identificados:** Completar el diseño del Módulo 1 y sus reglas de datos; verificar la arquitectura/tecnologías contra el código cuando esté disponible; actualizar la memoria en sesiones posteriores con decisiones e implementaciones respaldadas por evidencia.
