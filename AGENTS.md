# Documentación Técnica Integral - Gestor de Vencimientos e Incidencias

Esta documentación está diseñada para que cualquier agente de IA o desarrollador pueda comprender la arquitectura, lógica, estructura y flujos de trabajo de la aplicación **Gestor de Vencimientos e Incidencias**, permitiendo continuar el desarrollo sin ambigüedades.

---

## 1. Propósito y Visión General de la Aplicación

La aplicación es un sistema web avanzado para la **gestión de fechas de vencimiento, políticas de retiro de inventario, y control de eventos/incidencias** (transporte, diferencias de inventario, mermas, deterioros). Está optimizada para operaciones logísticas, retail y gestión de almacenes que manejan datos importados o sincronizados desde **Google Sheets** (vía Google Apps Script o archivos Excel/CSV).

### Características Principales:
- **Gestión de Inventario y Vencimientos**: Visualización de alertas de vencimiento y cálculo automático de días para retiro según políticas comerciales.
- **Registro de Eventos e Incidencias**: Categorización de incidencias (Transporte, Diferencias, Mermas, Calidad).
- **Detección Semántica Inteligente de Columnas**: Capacidad de interpretar encabezados de hojas de cálculo sin importar acentos, mayúsculas, espacios, subrayados o abreviaciones.
- **Parsing Universal de Fechas y Números**: Soporte para fechas ISO, formato latino (`DD/MM/YYYY`), formato mes/año (`MM/YYYY`), números de serie de Excel (ej. `45321`), y formateo robusto de números con separadores de miles y decimales.
- **Integración con Google Sheets**: Generación y exportación de código Google Apps Script para sincronización en tiempo real.
- **Reportes Gerenciales (PM / Drain Report)**: Generación de reportes de drenaje y resúmenes copiables para gestión operativa.

---

## 2. Estructura del Proyecto y Directorios

El proyecto sigue una estructura modular limpia construida en **React 18+**, **TypeScript**, **Vite** y **Tailwind CSS**.

```text
/
├── metadata.json                 # Metadatos de la app y capacidades
├── package.json                  # Dependencias y scripts de compilación
├── vite.config.ts                # Configuración de Vite y Tailwind
├── AGENTS.md                     # Esta guía de documentación para agentes
└── src/
    ├── App.tsx                   # Componente raíz y enrutador principal de vistas
    ├── main.tsx                  # Punto de montaje de React DOM
    ├── index.css                 # Estilos globales y directivas de Tailwind (@import "tailwindcss")
    ├── types.ts                  # Tipados globales (InventoryItem, EventCategory, ItemStatus, etc.)
    ├── db/
    │   └── indexedDbService.ts   # Motor de almacenamiento asíncrono Local-First y cola offline
    ├── workers/
    │   └── inventoryWorker.ts    # Web Worker de cómputo en segundo plano (filtrado, métricas, indexación)
    ├── hooks/
    │   ├── useInventoryWorker.ts # Hook de comunicación no bloqueante con el Web Worker
    │   ├── useInventoryFiltering.ts # Orquestación de filtros, paginación y agrupación
    │   ├── useOfflineSync.ts     # Hook de sincronización y vaciado de cola offline
    │   └── useColumnResize.ts    # Manejo interactivo del ancho de columnas
    ├── utils/
    │   ├── columnAliases.ts      # Motor de detección semántica de encabezados de columnas
    │   ├── pureCalculations.ts   # Cálculos puros y parsing de fechas y métricas (Zero-DOM/Web Worker compatible)
    │   ├── universalImporter.ts  # Parser universal de Excel/CSV/TSV y motor de auto-mapeo semántico
    │   └── dateCalculations.tsx  # Badges de UI, iconos y renderizado de estados
    └── components/
        ├── InventoryDashboard.tsx# Vista principal de control y filtrado de inventario
        ├── views/
        │   └── SchemaEditorView.tsx# Vista de configuración y mapeo de esquema de columnas
        ├── modals/
        │   ├── GlobalConfigModal.tsx # Configuración global y credenciales
        │   ├── UniversalImportModal.tsx # Ingestión universal asistida (Excel, CSV, TSV, Portapapeles)
        │   ├── ItemFormModal.tsx     # Modal para crear/editar registros e ítems
        │   ├── PmReportModal.tsx     # Generador de reportes de drenaje y alertas
        │   └── ScriptCodeModal.tsx   # Visor y generador de código Google Apps Script
        └── drawers/
            └── ItemDetailDrawer.tsx  # Panel lateral detallado para un SKU/producto específico
```

---

## 3. Arquitectura y Lógica de Módulos Clave

### A. Tipos Globales (`src/types.ts`)
Define las estructuras de datos fundamentales para los ítems de inventario, eventos, políticas, estados de alerta y configuraciones de sincronización.

### B. Motor de Detección Semántica (`src/utils/columnAliases.ts`)
Resuelve el problema común de las hojas de cálculo con encabezados inconsistentes (ej. "F. Vto", "Fecha Vencimiento", "Vencimiento", "fecha_vc").
- **`KnownFieldSemantic`**: Tipos semánticos estandarizados (`sku`, `descripcion`, `fecha_vc`, `fecha_retiro`, `cantidad`, `lote`, `politica`, `tipo_evento`, `precio`, `observacion`, `proveedor`, etc.).
- **`FIELD_PATTERNS`**: Diccionario de expresiones regulares por campo semántico que cubre variaciones ortográficas, acentos y abreviaciones.
- **`findColumnBySemantic(headers, semantic)`**: Busca en un arreglo de encabezados de columnas el que coincida semánticamente, permitiendo mapeo automático robusto.

### C. Cálculos y Utilidades de Fechas / Números (`src/utils/dateCalculations.tsx`)
- **`parseAnyDate(dateVal)`**: Soporta:
  1. Números de serie de Excel (ej. `45321`).
  2. Formatos ISO (`YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD`).
  3. Formatos Latinos (`DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`).
  4. Formatos compactos (`YYYYMMDD`).
  5. Formatos Mes/Año (`MM/YYYY` - calcula último día del mes).
  6. Objetos `Date` nativos o cadenas de texto estándar.
- **`parseLocaleNumber` / `formatLocaleNumber`**: Conversión y formateo robusto de valores numéricos monetarios o de stock que contengan comas y puntos decimales europeos/americanos.
- **`getItemStatus(item, headers)`**: Calcula de manera inteligente el estado operativo de un ítem (ej. Vencido, Crítico por vencer, Próximo a retiro, En buen estado) comparando con la fecha actual.
- **`getEventCategory(item, headers)`**: Clasifica automáticamente eventos e incidencias en categorías (`TRANSPORTE`, `DIFERENCIAS`, `MERMAS`, `CALIDAD`, etc.).

### D. Registro y Configuración de Acciones Masivas (`src/utils/bulkActionsRegistry.ts`)
- **Control Contextual y Prevención de Ruido Visual**: Permite activar, desactivar o dejar en modo automático (`auto`, `enabled`, `disabled`) cualquier acción masiva (WhatsApp, Gmail, Ticket, Excel, Acción PM, Edición FRC, Eliminar) por tabla o vista específica.
- **Detección Contextual Inteligente (`defaultPredicate`)**: Si una acción está en modo `auto`, solo se muestra si la tabla contiene columnas relevantes (ej. WhatsApp solo si hay columnas telefónicas o la hoja se llama "Contactos/Clientes"; Gmail solo si hay columnas de email).
- **Persistencia en `SheetConfig`**: Se almacena en `sheetConfig.bulkActionSettings[tableKey][actionId]` y se sincroniza con el almacenamiento local y en la nube.
- **Panel Modular y Reutilizable (`TableBulkActionsPanel.tsx`)**: Componente centralizado que gestiona los selectores de tabla, badges de detección y controles de 3 estados, utilizado tanto en el modal específico `BulkActionsConfigModal.tsx` como en la pestaña de ajustes globales `GlobalConfigModal.tsx`.

### E. Detección Inteligente de Acción según Política: Canje Proveedor vs. Merma Directa
- **Lógica de Decisión Operativa (`detectPolicyActionType`)**:
  - Distingue automáticamente entre ítems que tienen política de retorno acordada con el proveedor (`CANJE_PROVEEDOR`), mermas directas sin retorno (`MERMA_DIRECTA`), y ventas prioritarias de liquidación comercial (`VENTA_DRENAJE`).
  - Reconoce patrones de texto e indicadores de políticas (`"Canje"`, `"Devolución"`, `"Garantía"`, `"Retorno"`, `"Sin Canje"`, `"Destrucción"`, `"Merma"`, o plazos contractuales en días).
  - Se integra en el Radar PM (`PmRadarCards.tsx`), badges de tabla (`InventoryTableRow.tsx`), panel de detalle (`ItemDetailDrawer.tsx`), reportes para PM (`PmReportModal.tsx`) y slices nativos (`sliceRegistry.ts`).

### F. Funcionalidades Avanzadas Estilo AppSheet (`Ref`, `Show_If` y `Valid_If`)
- **Referencias Cruzadas y De-referenciación (`src/utils/referenceResolver.ts`)**:
  - `findMasterProduct` y `searchMasterProducts`: Búsqueda tolerante e interactiva en el catálogo maestro (`products`) por SKU, nombre, proveedor o categoría.
  - `dereferenceMasterProduct`: Propagación atómica automática de campos maestros (Descripción, Proveedor, Costo/Precio, Categoría y Política) hacia las columnas correspondientes en la hoja activa al seleccionar o ingresar un SKU.
  - Sincronización instantánea de política comercial para el cálculo automático de la fecha de retiro preventivo.
  - Tarjeta de enlace maestro (`Ref: Catálogo Maestro`) visible tanto en el formulario (`ItemFormModal`) como en el panel de detalle (`ItemDetailDrawer`).
- **Formularios Dinámicos y Reglas de Visibilidad (`src/utils/dynamicFormRules.ts`)**:
  - `evaluateShowIf`: Evalúa la visibilidad condicional de campos según la categoría de evento seleccionada (`TRANSPORTE`, `DIFERENCIA`, `AVERIA`, `CALIDAD`, `CANJES`, `VENCIMIENTO`).
  - Mantiene siempre visibles los identificadores primarios y campos con datos ingresados, reduciendo la fricción cognitiva al ocultar campos no relevantes para la categoría activa.
  - Selector en barra de control de formulario para alternar entre "Campos Relevantes" y "Mostrar Todos".
  - `getOperationalSuggestions` (`Valid_If` contextual): Sugerencias operativas rápidas con un clic para alimentar las observaciones de bodega según la incidencia.
  - Atajos numéricos para cantidades (`+1`, `+5`, `+10`, `+25`, `+50`) y asistente de folios de traspaso (`TR-xxxxx` / `Marcar Pendiente`).

### F. Slices y Vistas Personalizadas Estilo AppSheet (`src/utils/sliceRegistry.ts`)
- **Concepto de Slice**: En AppSheet, un "Slice" es una vista filtrada de una tabla que define un subconjunto de filas (criterios y filtros guardados), un ordenamiento predeterminado, una columna de agrupación opcional y una selección personalizada de columnas visibles.
- **Slices Nativos Preconfigurados (`BUILT_IN_SLICES`)**:
  - Para `main` (Radar de Vencimientos): *Vencidos & Críticos*, *Próximos a Retiro*, *Lotes con Alto Stock*, *Pendientes de Liquidación/PM*.
  - Para `events` (FRC / Incidencias): *Averías & Deterioro Transporte*, *Diferencias Pendientes Traspaso*, *Pendientes de Resolución*, *Incidencias de Calidad*.
  - Para `products`: *Productos con Política Asignada*, *Sin Política Comercial*.
  - Para `policies`: *Políticas con Mayor Anticipación (>60d)*.
- **Slices Personalizados Creados por el Usuario**:
  - El usuario puede capturar en un clic sus filtros, agrupaciones, columnas visibles y ordenamiento actual con el modal `SliceEditorModal.tsx`.
  - Personalización de color, icono, nombre y descripción explicativa.
  - Persistencia doble: en `localStorage` (`appsheet_custom_slices`) y en `sheetConfig.slices` para sincronización en la nube con Google Sheets/PropertiesService.
- **Barra Selectora de Slices (`SliceSelectorBar.tsx`)**:
  - Ubicada directamente sobre la tabla principal con navegación horizontal fluida.
  - Contadores de filas en tiempo real (`computeSliceCounts`) calculados en una sola pasada de alto rendimiento.
  - Badges cromáticos personalizables con acceso rápido a edición, eliminación y restablecimiento de vista ("Todas las Filas").

### H. Resolución de Identidad de Entidad y Cola de Mutación Robusta (`src/utils/entityIdentityResolver.ts`)
- **Resolución de Claves Primarias (`resolveItemIdentity`)**:
  - Supera la fragilidad de depender exclusivamente de `_rowIndex` (que se desincroniza ante ordenamientos, filtros o inserciones externas en Google Sheets).
  - Jerarquía de identificación optimizada para la operación real:
    1. Columna configurada como `isKey` en `SheetConfig.schema`.
    2. Columna directa de código único `CU_VC` (ej. `SKU_VC` + `YYYY` + `MM` = `2000210218569202712`) o ID semántico natural (`ID_VC`, `ID_EVENTO`, `FOLIO`, `ID`).
    3. Clave compuesta de negocio: `SKU` + `YYYY` + `MM` (o `SKU` + `FECHA_VC` / `LOTE` como respaldo secundario).
    4. Identificador sintético con prefijo de hoja y fila de respaldo.
- **Re-resolución Dinámica en Cola Offline (`matchRowIndexByIdentity`)**:
  - Al vaciar mutaciones (`update` o `delete`) en `useOfflineSync.ts`, el sistema re-localiza dinámicamente el `rowIndex` exacto en los datos frescos de Google Sheets mediante la clave de entidad o coincidencia de `CU_VC` / `SKU`+`YYYY`+`MM`, previniendo sobreescrituras o eliminaciones accidentales de filas contiguas.

### I. Componentes de UI
- **`App.tsx`**: Administra el estado global de los datos de inventario, pestañas activas (Dashboard vs Schema Editor), modales y conectividad con Google Sheets / datos locales.
- **`InventoryDashboard.tsx`**: Tabla interactiva con filtros avanzados, búsqueda rápida, tarjetas de resumen KPI y botones de acción rápida.
- **`ItemDetailDrawer.tsx`**: Drawer lateral que agrupa toda la trazabilidad de un SKU (historial de vencimientos, lotes y eventos relacionados).
- **`PmReportModal.tsx`**: Genera reportes listos para copiar al portapapeles o exportar para jefaturas de producto/operaciones.

---

## 4. Integración con Google Sheets y Google Apps Script

La aplicación está diseñada para operar tanto con datos de ejemplo locales como con conexiones reales a Google Sheets a través de un script de Google Apps Script. El componente `ScriptCodeModal.tsx` proporciona el script necesario para desplegar como Web App en Google Sheets, permitiendo la sincronización bidireccional mediante JSON endpoints.

---

## 5. Protocolo de Vibe Coding y Reglas de Desarrollo Eficiente (Inspirado en Ponytail)

Para garantizar un código limpio, sin sobreingeniería (*anti-bloat*) y con el menor volumen de código efectivo posible, todo agente o desarrollador que trabaje en esta aplicación debe someter cada cambio a la **Escalera de Decisiones de Ponytail (Decision Ladder)**:

```text
               ┌────────────────────────────────────────────────────────┐
               │ 1. ¿Esto realmente necesita existir? (YAGNI)          │
               └──────────────────────────┬─────────────────────────────┘
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │ 2. ¿Ya existe en este proyecto? (Reutilizar)          │
               └──────────────────────────┬─────────────────────────────┘
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │ 3. ¿Lo resuelve la librería estándar de JS/TS?        │
               └──────────────────────────┬─────────────────────────────┘
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │ 4. ¿Existe una función nativa del navegador/DOM?       │
               └──────────────────────────┬─────────────────────────────┘
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │ 5. ¿Lo resuelve una dependencia ya instalada?          │
               └──────────────────────────┬─────────────────────────────┘
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │ 6. ¿Puede resolverse en una sola línea o función pura? │
               └──────────────────────────┬─────────────────────────────┘
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │ 7. Escribir únicamente el código mínimo que funcione   │
               └────────────────────────────────────────────────────────┘
```

### Reglas Clave del Protocolo Ponytail:
1. **Principio YAGNI Estricto**: No agregues opciones de configuración hipotéticas, abstracciones especulativas ni botones de acciones no solicitadas.
2. **Reutilización Obligatoria**: Antes de crear un helper o función nueva, consulta `src/utils/dateCalculations.tsx`, `src/utils/columnAliases.ts` y `src/utils/exportUtils.ts`.
3. **Cero Dependencias Innecesarias**: No instales paquetes nuevos si la funcionalidad se puede lograr con la biblioteca estándar de TypeScript o las dependencias existentes (`lucide-react`, `recharts`, `motion`, `@tanstack/react-virtual`).
4. **Líneas Mínimas y Concisas**: Prefiere código conciso, legible y directo sobre patrones complejos con múltiples capas de wrappers o interfaces redundantes.
5. **Sin Costos Monetarios (Estricto)**: Esta aplicación está diseñada estrictamente para la gestión operativa y logística de fechas de vencimiento y de incidencias. No se manejan costos monetarios ni precios de ningún tipo. No se deben crear o reintroducir campos, tarjetas o métricas financieras en ninguna parte de la UI (vistas, modales, drawers o tablas).

### Invariantes de Seguridad y Calidad (Guardrails No Negociables):
- **Prevención de Pérdida de Datos**: Conservar siempre el soporte offline y las colas de sincronización para Google Sheets.
- **Validación de Datos**: Mantener sanitización, manejo de errores `try/catch` con `AbortController` y parsing seguro de formatos heterogéneos de fechas y números.
- **Accesibilidad y Rendimiento**: Respetar contraste visual WCAG AA, virtualización de listas grandes (`@tanstack/react-virtual`) y tipado estricto en TypeScript sin `any` injustificados.

---

## 6. Guías para el Próximo Agente / Desarrollador

1. **Mantener la Modularidad**: No introduzcas lógica pesada ni componentes monolíticos en `App.tsx`. Extiende o crea submódulos en `src/components/` o `src/utils/`.
2. **Iconos**: Utiliza exclusivamente iconos provenientes de `lucide-react`.
3. **Estilos**: Emplea únicamente clases utilitarias de Tailwind CSS (configurado con `@import "tailwindcss";` en `src/index.css`). No crees archivos CSS adicionales.
4. **Tipado Estricto**: Asegúrate de que todo código nuevo mantenga compatibilidad estricta con TypeScript (`npm run lint` pasa sin errores de `tsc --noEmit`).
5. **Robustez en Hojas de Cálculo**: Siempre que proceses datos tabulares externos, utiliza el motor de `columnAliases.ts` en lugar de buscar nombres de columnas fijos (`item['SKU']`), garantizando tolerancia a variaciones en los archivos del usuario.
6. **Aplicar la Escalera de Ponytail**: Antes de escribir una sola línea de código, pregúntate si puedes reutilizar lo que ya existe o resolverlo con la menor cantidad de código posible.
