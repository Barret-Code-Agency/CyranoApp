# Auditoría AppSup — 2026-03-20

---

## Reorganización de carpetas — 2026-03-21

### Estructura nueva en `src/screens/`

```
src/screens/
├── gerencia/          AdminContratoHome, DashboardScreen, DashboardsGestionScreen, FacturacionScreen, AnalisisHorasPASScreen
├── supervisor/        SupervisorHome, SupervisorDashboard, PlanSupervisorScreen, PlanSupervisionScreen
├── administrativo/    AdministrativoHome, GestionClientesScreen, GestionPersonalScreen, DashboardPersonalScreen, GestionDatosAdminScreen
├── vigilador/         VigHome, MisTurnosVigScreen, RondasVigScreen, ControlVehicularScreen, JornadaScreen, FinJornadaScreen, HistorialScreen
├── shared/            ProgramacionServiciosScreen, ConsolidadoScreen, ControlClienteScreen, Diagramas14x14Screen, MonitorRondasScreen, PlantillasRondaScreen, PlanCapacitacionScreen
├── admin/             (sin cambios — panel interno del supervisor)
├── superadmin/        (sin cambios)
└── raíz              Login, RoleSelectScreen, AdminScreen, SuperAdminScreen, LoadingScreen, MenuScreen, etc.
```

### Archivos movidos y nueva ubicación

| Archivo original | Nueva ubicación |
|---|---|
| `screens/AdminContratoHome.jsx` | `screens/gerencia/AdminContratoHome.jsx` |
| `screens/DashboardScreen.jsx` | `screens/gerencia/DashboardScreen.jsx` |
| `screens/DashboardsGestionScreen.jsx` | `screens/gerencia/DashboardsGestionScreen.jsx` |
| `screens/DashboardsGestionScreen.css` | `screens/gerencia/DashboardsGestionScreen.css` |
| `screens/FacturacionScreen.jsx` | `screens/gerencia/FacturacionScreen.jsx` |
| `screens/AnalisisHorasPASScreen.jsx` | `screens/gerencia/AnalisisHorasPASScreen.jsx` |
| `screens/SupervisorHome.jsx` | `screens/supervisor/SupervisorHome.jsx` |
| `screens/SupervisorDashboard.jsx` | `screens/supervisor/SupervisorDashboard.jsx` |
| `screens/PlanSupervisorScreen.jsx` | `screens/supervisor/PlanSupervisorScreen.jsx` |
| `screens/PlanSupervisionScreen.jsx` | `screens/supervisor/PlanSupervisionScreen.jsx` |
| `screens/AdministrativoHome.jsx` | `screens/administrativo/AdministrativoHome.jsx` |
| `screens/GestionClientesScreen.jsx` | `screens/administrativo/GestionClientesScreen.jsx` |
| `screens/GestionPersonalScreen.jsx` | `screens/administrativo/GestionPersonalScreen.jsx` |
| `screens/DashboardPersonalScreen.jsx` | `screens/administrativo/DashboardPersonalScreen.jsx` |
| `screens/GestionDatosAdminScreen.jsx` | `screens/administrativo/GestionDatosAdminScreen.jsx` |
| `screens/VigHome.jsx` | `screens/vigilador/VigHome.jsx` |
| `screens/MisTurnosVigScreen.jsx` | `screens/vigilador/MisTurnosVigScreen.jsx` |
| `screens/MisTurnosVigScreen.css` | `screens/vigilador/MisTurnosVigScreen.css` |
| `screens/RondasVigScreen.jsx` | `screens/vigilador/RondasVigScreen.jsx` |
| `screens/ControlVehicularScreen.jsx` | `screens/vigilador/ControlVehicularScreen.jsx` |
| `screens/JornadaScreen.jsx` | `screens/vigilador/JornadaScreen.jsx` |
| `screens/FinJornadaScreen.jsx` | `screens/vigilador/FinJornadaScreen.jsx` |
| `screens/HistorialScreen.jsx` | `screens/vigilador/HistorialScreen.jsx` |
| `screens/ProgramacionServiciosScreen.jsx` | `screens/shared/ProgramacionServiciosScreen.jsx` |
| `screens/ConsolidadoScreen.jsx` | `screens/shared/ConsolidadoScreen.jsx` |
| `screens/ControlClienteScreen.jsx` | `screens/shared/ControlClienteScreen.jsx` |
| `screens/Diagramas14x14Screen.jsx` | `screens/shared/Diagramas14x14Screen.jsx` |
| `screens/MonitorRondasScreen.jsx` | `screens/shared/MonitorRondasScreen.jsx` |
| `screens/PlantillasRondaScreen.jsx` | `screens/shared/PlantillasRondaScreen.jsx` |
| `screens/PlanCapacitacionScreen.jsx` | `screens/shared/PlanCapacitacionScreen.jsx` |

**Total: 30 archivos movidos (28 JSX + 2 CSS colocados con su JSX)**

### Imports actualizados

| Archivo | Cambio |
|---|---|
| `src/App.jsx` | 6 imports actualizados: `VigHome`, `AdminContratoHome`, `SupervisorDashboard`, `SupervisorHome`, `AdministrativoHome`, `JornadaScreen`, `FinJornadaScreen` |
| `src/screens/AdminScreen.jsx` | 2 imports: `DashboardScreen` → `./gerencia/DashboardScreen`, `PlanSupervisorScreen` → `./supervisor/PlanSupervisorScreen` |
| Todos los JSX movidos | Imports internos actualizados: `../context/` → `../../context/`, `../firebase` → `../../firebase`, `../styles/` → `../../styles/`, `../hooks/` → `../../hooks/`, `../utils/` → `../../utils/`, `../data/` → `../../data/`, `../forms/` → `../../forms/` |
| `AdminContratoHome.jsx` | Imports de screens hermanas actualizados a subcarpetas correctas (`./gerencia/`, `./administrativo/`, `./shared/`) |
| `SupervisorHome.jsx` | Imports de `PlantillasRondaScreen`, `MonitorRondasScreen`, `DashboardPersonalScreen`, `ControlClienteScreen`, `ConsolidadoScreen`, `Diagramas14x14Screen` → `../shared/` o `../administrativo/` |
| `AdministrativoHome.jsx` | Imports de `ControlClienteScreen`, `ProgramacionServiciosScreen` → `../shared/` |
| `SupervisorDashboard.jsx` | Import de `AnalistaDashboard` → `../AnalistaDashboard` (quedó en raíz) |
| `RondasVigScreen.jsx` | Import de `ChecklistModal` → `../ChecklistModal` (quedó en raíz) |

### Archivos que quedaron en `src/screens/` raíz (sin mover)

Pantallas de autenticación, routing, utilitarios y componentes modal que no corresponden a un rol específico:

- `Login.jsx`, `RoleSelectScreen.jsx`, `LoadingScreen.jsx`, `LatamMapSplash.jsx`
- `AdminScreen.jsx` (panel interno de supervisión — usado desde múltiples roles)
- `MenuScreen.jsx`, `CapacitacionScreen.jsx`, `OtraActividadScreen.jsx`, `ControlScreen.jsx`
- `SuperAdminScreen.jsx`
- `AnalistaDashboard.jsx` (sub-componente de `SupervisorDashboard`, quedó en raíz por ser usado como import desde supervisor)
- `ChecklistModal.jsx`, `SendModal.jsx` (modales sin rol específico)
- `AdminEmpresaScreen.jsx`, `UsersScreen.jsx`, `VehiculosScreen.jsx`, `CyranoScreen.jsx`
- `DashboardTiempos.jsx`, `EditarPersonalScreen.jsx`, `MigrateUtil.jsx`
- Subcarpetas `admin/`, `superadmin/` sin cambios

### Pendientes y decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| P1 | `AnalistaDashboard.jsx` — sub-componente de `SupervisorDashboard` | Quedó en raíz `screens/`. Candidato a `screens/supervisor/` en el futuro, pero cambiaría el import en `SupervisorDashboard.jsx`. |
| P2 | `ChecklistModal.jsx` — usado por `RondasVigScreen` | Quedó en raíz. Candidato a `screens/vigilador/` o `components/`. |
| P3 | CSS de screens en `src/styles/` | No se movieron los CSS globales. Quedan en `src/styles/` como antes. La subcarpeta `src/styles/screens/` no se creó — el volumen de cambios de rutas hubiera requerido editar todos los JSX nuevamente. |
| P4 | `screens/AuthContext.jsx` duplicado | No existía en el momento de la reorganización (ya eliminado en sesión anterior). |

---

## 1. JSX sin CSS correspondiente

### Archivos JSX que NO tienen CSS propio en `src/styles/`

| Archivo | Ubicación | CSS importado |
|---|---|---|
| `AdminContratoHome.jsx` | `src/screens/` | Reutiliza `SupervisorHome.css` + `ConsolidadoScreen.css` |
| `AdministrativoHome.jsx` | `src/screens/` | Reutiliza `VigHome.css` + `SupervisorHome.css` + `ConsolidadoScreen.css` |
| `SupervisorHome.jsx` | `src/screens/` | Reutiliza `SupervisorHome.css` (sí tiene su propio CSS) |
| `DashboardScreen.jsx` | `src/screens/` | Tiene `DashboardScreen.css` ✓ |
| `GestionClientesScreen.jsx` | `src/screens/` | Tiene `GestionClientesScreen.css` ✓ |
| `GestionPersonalScreen.jsx` | `src/screens/` | Tiene `GestionPersonalScreen.css` ✓ |
| `AnalistaDashboard.jsx` | `src/screens/` | **Sin CSS propio** — no importa ningún CSS |
| `AuthContext.jsx` | `src/screens/` | **Mal ubicado** — es un contexto, no una pantalla |
| `MigrateUtil.jsx` | `src/screens/` | **Sin CSS propio** |
| `GestionDatosAdminScreen.jsx` | `src/screens/` | Tiene `GestionDatosAdminScreen.css` ✓ |
| `PlanCapacitacionScreen.jsx` | `src/screens/` | Tiene `PlanCapacitacionScreen.css` ✓ |
| `AnalisisHorasPASScreen.jsx` | `src/screens/` | Tiene `AnalisisHorasPASScreen.css` ✓ |
| `DashboardsGestionScreen.jsx` | `src/screens/` | **Sin CSS propio** |
| `MisTurnosVigScreen.jsx` | `src/screens/` | **Sin CSS propio** |
| `SendModal.jsx` | `src/screens/` | Tiene `SendModal.css` ✓ |

**Forms sin CSS propio (usando CSS de `src/forms/`, no `src/styles/`):**

| Archivo | CSS en `src/forms/` |
|---|---|
| `VerInformesScreen.jsx` | `./VerInformesScreen.css` ✓ |
| `InformeNovedadScreen.jsx` | `./InformeNovedadScreen.css` ✓ |
| `InformeSencilloScreen.jsx` | `./InformeSencilloScreen.css` ✓ |
| `AuditoriaPuesto.jsx` | `./AuditoriaPuesto.css` ✓ |
| `CrearComunicacionScreen.jsx` | `./CrearComunicacionScreen.css` ✓ |
| `VerComunicacionesScreen.jsx` | `./VerComunicacionesScreen.css` ✓ |
| `SubirProcedimientoScreen.jsx` | **Sin CSS propio detectado** |
| `VerProcedimientosScreen.jsx` | **Sin CSS propio detectado** |
| `SubirCapacitacionScreen.jsx` | **Sin CSS propio detectado** |
| `VerCapacitacionesScreen.jsx` | **Sin CSS propio detectado** |

**Componentes sin CSS propio:**

| Archivo | Observación |
|---|---|
| `ShieldLogo.jsx` | Sin CSS — presumiblemente usa estilos inline |
| `charts/DonutChart.jsx` | Sin CSS separado — estilos inline o SVG |
| `charts/BarraTiempos.jsx` | Sin CSS separado |
| `charts/LineChart.jsx` | Sin CSS separado |
| `charts/GaugeChart.jsx` | Sin CSS separado |
| `charts/BarChart.jsx` | Sin CSS separado |
| `charts/PlanVsRealChart.jsx` | Sin CSS separado |

---

## 2. Propuesta de reorganización de carpetas

> **IMPORTANTE**: Ningún archivo fue movido. Esta sección es solo documentación para cuando se ejecute la reorganización.

### `src/screens/gerencia/` — Gerencia de Operaciones

| Archivo actual | Destino propuesto |
|---|---|
| `AdminContratoHome.jsx` | `src/screens/gerencia/AdminContratoHome.jsx` |
| `DashboardScreen.jsx` | `src/screens/gerencia/DashboardScreen.jsx` |
| `DashboardsGestionScreen.jsx` | `src/screens/gerencia/DashboardsGestionScreen.jsx` |
| `FacturacionScreen.jsx` | `src/screens/gerencia/FacturacionScreen.jsx` |
| `AnalisisHorasPASScreen.jsx` | `src/screens/gerencia/AnalisisHorasPASScreen.jsx` |

**Imports a actualizar al mover:**
- `App.jsx` / router principal: importa `AdminContratoHome`, `DashboardScreen`
- `AdminContratoHome.jsx`: imports internos a otras screens → rutas relativas cambian

### `src/screens/supervisor/` — Supervisor

| Archivo actual | Destino propuesto |
|---|---|
| `SupervisorHome.jsx` | `src/screens/supervisor/SupervisorHome.jsx` |
| `SupervisorDashboard.jsx` | `src/screens/supervisor/SupervisorDashboard.jsx` |
| `PlanSupervisorScreen.jsx` | `src/screens/supervisor/PlanSupervisorScreen.jsx` |
| `PlanSupervisionScreen.jsx` | `src/screens/supervisor/PlanSupervisionScreen.jsx` |
| `AuditoriaPuesto.jsx` (forms) | Podría ir a `src/screens/supervisor/` |

**Imports a actualizar al mover:**
- `SupervisorHome.jsx` importa: `SupervisorDashboard`, `PlantillasRondaScreen`, `MonitorRondasScreen`, múltiples forms
- `AdminContratoHome.jsx` importa: `SupervisorHome` indirectamente

### `src/screens/administrativo/` — Administrativo

| Archivo actual | Destino propuesto |
|---|---|
| `AdministrativoHome.jsx` | `src/screens/administrativo/AdministrativoHome.jsx` |
| `GestionDatosAdminScreen.jsx` | `src/screens/administrativo/GestionDatosAdminScreen.jsx` |
| `GestionClientesScreen.jsx` | `src/screens/administrativo/GestionClientesScreen.jsx` |
| `GestionPersonalScreen.jsx` | `src/screens/administrativo/GestionPersonalScreen.jsx` |

**Imports a actualizar al mover:**
- `AdministrativoHome.jsx` importa: `GestionDatosAdminScreen`, `DashboardPersonalScreen`, `ControlClienteScreen`, forms
- `AdminContratoHome.jsx` importa: `GestionClientesScreen`, `GestionPersonalScreen`, `GestionDatosAdminScreen`

### `src/screens/vigilador/` — Vigilador

| Archivo actual | Destino propuesto |
|---|---|
| `VigHome.jsx` | `src/screens/vigilador/VigHome.jsx` |
| `MisTurnosVigScreen.jsx` | `src/screens/vigilador/MisTurnosVigScreen.jsx` |
| `RondasVigScreen.jsx` | `src/screens/vigilador/RondasVigScreen.jsx` |
| `ControlVehicularScreen.jsx` | `src/screens/vigilador/ControlVehicularScreen.jsx` |
| `JornadaScreen.jsx` | `src/screens/vigilador/JornadaScreen.jsx` |
| `FinJornadaScreen.jsx` | `src/screens/vigilador/FinJornadaScreen.jsx` |
| `HistorialScreen.jsx` | `src/screens/vigilador/HistorialScreen.jsx` |

**Imports a actualizar al mover:**
- `VigHome.jsx` importa: `RondasVigScreen`, `ControlVehicularScreen`, `MisTurnosVigScreen`, forms
- `App.jsx` importa: `VigHome`, `JornadaScreen`, `FinJornadaScreen`

### `src/screens/shared/` — Compartido entre roles

| Archivo actual | Destino propuesto |
|---|---|
| `ProgramacionServiciosScreen.jsx` | `src/screens/shared/ProgramacionServiciosScreen.jsx` |
| `ConsolidadoScreen.jsx` | `src/screens/shared/ConsolidadoScreen.jsx` |
| `ControlClienteScreen.jsx` | `src/screens/shared/ControlClienteScreen.jsx` |
| `DashboardPersonalScreen.jsx` | `src/screens/shared/DashboardPersonalScreen.jsx` |
| `Diagramas14x14Screen.jsx` | `src/screens/shared/Diagramas14x14Screen.jsx` |
| `MonitorRondasScreen.jsx` | `src/screens/shared/MonitorRondasScreen.jsx` |
| `PlantillasRondaScreen.jsx` | `src/screens/shared/PlantillasRondaScreen.jsx` |

**Nota:** `AdminContratoHome`, `SupervisorHome` y `AdministrativoHome` todos importan estas screens compartidas. Actualizar rutas relativas en cada uno es el mayor riesgo de esta reorganización.

---

## 3. Código sin uso detectado

### `DashboardScreen.jsx`
- **Línea 4** (original): `import { exportarExcel } from "../utils/exportarExcel"` — **no utilizado en ningún lugar del componente**. ✅ *Ya eliminado en esta auditoría.*
- **Línea 12** (original): `import { TIPO_COLOR, TIPO_LABEL }` — `TIPO_LABEL` nunca se referencia en el JSX ni en funciones. ✅ *Ya eliminado en esta auditoría.*
- **Línea 165** (original): `const tieneSimulados = false; // ya no hay datos simulados` — constante hardcodeada en `false` que solo sirve para mostrar un bloque que nunca renderiza. El estado `showBorrar` y `limpiarSimulados` quedan efectivamente muertos porque `tieneSimulados` siempre es `false`. Todo ese bloque JSX (líneas 170–183 aprox.) nunca se renderiza. Candidato a eliminar.

### `VigHome.jsx`
- **Línea 8** (original): `import { PERMISOS_BASE } from "../config/roles"` — **no utilizado en ningún lugar del archivo**. ✅ *Ya eliminado en esta auditoría.*
- **Líneas 212**: `function PanelInformes({ onBack, onSelect })` — el parámetro `onSelect` se declara pero **nunca se usa dentro del cuerpo** y **nunca se pasa cuando se llama** (`<PanelInformes onBack={...} />`). Es código muerto.

### `AdminContratoHome.jsx`
- **Línea 57** (original): array de años `[2025, 2026, 2027, 2028]` — se cortaba en 2028, ahora extendido. ✅ *Ya corregido.*
- El módulo `"plan_seguridad"` está en el array `MODULOS` pero cuando se selecciona cae en el bloque genérico "Próximamente" sin implementación dedicada.
- El módulo `"analisis_riesgos"` igual — color `"gold"` pero sin implementación.

### `AdministrativoHome.jsx`
- **Línea 113**: `[2025, 2026, 2027, 2028]` — extendido. ✅ *Ya corregido.*
- Las constantes `MESES_ES_LARGO` y `MESES_ES` están **ambas declaradas** en el mismo archivo porque `PeriodoCard` usa `MESES_ES_LARGO` y `CalendarioSemanal` usa `MESES_ES`. Duplicación innecesaria — podría compartirse.
- `data` se desestructura de `useAppData()` pero `data?.actividadesSemana` es el único uso — si `data` nunca contiene `actividadesSemana` real, el calendario siempre está vacío.

### `SupervisorHome.jsx`
- **Línea 51** (original): `[2025, 2026, 2027, 2028]` — extendido. ✅ *Ya corregido.*
- `MESES_LARGO` y `MESES_ES` declarados por separado igual que en `AdministrativoHome`. Duplicación.
- El módulo `"auditoria_puesto"` está en `MODULOS` pero cae en el bloque genérico "Próximamente".
- `"felicitaciones_sanciones"`, `"informe_gestion"`, `"informe_visita"` — igual.

### `AnalisisHorasPASScreen.jsx`
- **Líneas 82–90**: múltiples variables declaradas como `null` con comentario `// TODO: fórmula a definir` — `horasPedidas`, `horasTraslados`, `horasCapac`, `horasAdicionales`, `horasNoPrestadas`, `horasPrestadas`, `totalHoras`, `pctCobertura`, `totalCubierto`. La pantalla está esencialmente incompleta: renderiza filas con todos los valores en `null`.

### `ConsolidadoScreen.jsx`
- **Línea 21–43**: `FERIADOS_ARG` declarado localmente — **tercera copia** del mismo objeto (también está en `ProgramacionServiciosScreen.jsx` y `ControlClienteScreen.jsx`). Candidato a mover a `src/utils/feriados.js`.
- `horasDeValor()` y `getDias()` y `fmtKey()` — **cuarta copia** de las mismas funciones helper (presentes también en `ProgramacionServiciosScreen`, `ControlClienteScreen`, `FacturacionScreen`).

### `ControlClienteScreen.jsx`
- `OPCIONES` (array de turnos) — **segunda copia** del mismo array de `ProgramacionServiciosScreen.jsx`. Duplicación completa.
- `FERIADOS_ARG` — **cuarta copia**.
- `getDias()`, `fmtKey()`, `horasDeValor()` — **cuartas copias** de los mismos helpers.
- `DIAS_ES`, `MESES_ES` — sexta/séptima copia de los mismos arrays de localización.

### `useClientesData.js`
- La función `cargar` se define dentro del hook y se expone como `recargar`. Sin `useCallback`, se recrea en cada render aunque raramente cambia. No hay cleanup necesario ya que usa `getDocs` (one-shot), pero la función `cargar` debería envolverse en `useCallback` con `[empresa]` para estabilidad.

### `usePersonalData.js`
- Igual que `useClientesData`: cuatro colecciones Firestore con nombres hardcodeados en strings: `"supervisores"`, `"conductores"`, `"encargados"`, `"admins"`. Deberían ser constantes.
- `cargar` no está en `useCallback`.

---

## 4. Inconsistencias encontradas

### Naming inconsistente

| Inconsistencia | Archivos afectados |
|---|---|
| `año` (con tilde, válido en JS pero inusual) vs variables sin tilde | `PeriodoCard` en `AdminContratoHome`, `AdministrativoHome`, `SupervisorHome` — consistente entre sí pero distinto al estilo general |
| `MESES_ES_LARGO` en `AdministrativoHome` vs `MESES_LARGO` en `SupervisorHome` — mismo propósito, nombres distintos | `AdministrativoHome.jsx`, `SupervisorHome.jsx` |
| `descripcion` vs `desc` en objetos de módulos — VigHome usa `descripcion`, los demás usan `desc` | `VigHome.jsx` (l.88-98) vs `SupervisorHome.jsx`, `AdminContratoHome.jsx` |
| `subSub` en `SupervisorHome` vs `subSeccion` para el mismo propósito | `SupervisorHome.jsx` usa un tercer nivel `subSub`, los demás usan `subSeccion` |

### Patrones de fetch repetidos sin abstraer

Las siguientes pantallas implementan **el mismo patrón** de carga de `programacionServicios` desde Firestore sin compartir código:

1. `ProgramacionServiciosScreen.jsx` — lo hace 2 veces internamente
2. `FacturacionScreen.jsx`
3. `AnalisisHorasPASScreen.jsx`
4. `ControlClienteScreen.jsx`
5. `ConsolidadoScreen.jsx`

Todos consultan `programacionServicios` filtrando por `empresa`, `año` y `mes`. Candidato a un hook `useProgramacion(año, mes)`.

### Funciones helpers con 4+ copias idénticas

| Función | Archivos donde aparece |
|---|---|
| `getDias(año, mes)` | `ProgramacionServiciosScreen`, `FacturacionScreen`, `ControlClienteScreen`, `ConsolidadoScreen` |
| `fmtKey(d)` | `ProgramacionServiciosScreen`, `FacturacionScreen`, `ControlClienteScreen`, `ConsolidadoScreen`, `AdministrativoHome`, `VigHome`, `SupervisorHome` |
| `horasDeValor(val)` | `ProgramacionServiciosScreen`, `FacturacionScreen`, `ControlClienteScreen`, `ConsolidadoScreen` |
| `FERIADOS_ARG` (objeto completo) | `ProgramacionServiciosScreen`, `FacturacionScreen`, `ControlClienteScreen`, `ConsolidadoScreen` |
| `OPCIONES` (array de turnos) | `ProgramacionServiciosScreen`, `ControlClienteScreen` |
| `DIAS_ES` / `MESES_ES` | Al menos 7 archivos distintos |
| `CalendarioSemanal` (componente) | `VigHome.jsx`, `SupervisorHome.jsx`, `AdministrativoHome.jsx` — tres copias del mismo componente con nombres de clases CSS ligeramente distintos (`vh-`, `sh-`) |
| `PeriodoCard` (componente) | `AdminContratoHome.jsx`, `AdministrativoHome.jsx`, `SupervisorHome.jsx` — tres copias |

### Estilos con colores hexadecimales hardcodeados en JSX

En `DashboardPersonalScreen.jsx`:
- `color="#7c3aed"`, `color="#0891b2"`, `color="#ec4899"`, `color="#d97706"`, `color="#0ea5e9"`, `color="#8b5cf6"`, `color="#059669"` — pasados como props al componente local `BarChart`. Deberían usar variables CSS del `variables.css`.

En `AnalisisHorasPASScreen.jsx`:
- Línea 35-36: `color = v >= meta ? "#16a34a" : v >= meta * 0.8 ? "#ca8a04" : "#dc2626"` — hardcodeado en el style inline.

En `DashboardScreen.jsx` (tab supervisores):
- `style={{ "--ds-stat-color": m.c }}` con valores como `"#6366f1"`, `"#ec4899"`, `"#10b981"` hardcodeados en el array dentro del componente.

---

## 5. Valores hardcodeados

### Arrays de años con rango limitado

| Archivo | Línea aprox. | Antes | Después |
|---|---|---|---|
| `AdminContratoHome.jsx` | 57 | `[2025..2028]` | `[2025..2030]` ✅ corregido |
| `AdministrativoHome.jsx` | 113 | `[2025..2028]` | `[2025..2030]` ✅ corregido |
| `SupervisorHome.jsx` | 51 | `[2025..2028]` | `[2025..2030]` ✅ corregido |
| `ConsolidadoScreen.jsx` | (selector de año) | Verificar si tiene selector propio | Pendiente revisar |

### Strings de colección Firestore hardcodeados

| Colección | Archivos afectados | Estado |
|---|---|---|
| `"programacionServicios"` | `ProgramacionServiciosScreen`, `FacturacionScreen`, `AnalisisHorasPASScreen`, `ControlClienteScreen`, `ConsolidadoScreen` | Extraído como `COL_PROG` en los primeros 3 ✅ |
| `"legajos"` | `ProgramacionServiciosScreen`, `DashboardPersonalScreen`, `GestionPersonalScreen`, `ConsolidadoScreen` | Extraído como `COL_LEGAJOS` en ProgramacionServicios ✅ |
| `"clientes"` | `GestionClientesScreen`, `useClientesData.js` | Pendiente |
| `"objetivos"` | `GestionClientesScreen`, `useClientesData.js` | Pendiente |
| `"supervisores"`, `"conductores"`, `"encargados"`, `"admins"` | `usePersonalData.js` | Pendiente |
| `"usuarios"` | `AuthContext.jsx` | Pendiente |
| `"ingresosTurno"` | `VigHome.jsx` | Pendiente |

### EMPRESA_ID hardcodeado

En `AppDataContext.jsx` línea 125:
```js
const EMPRESA_ID = "brinks_ar";
```
Este ID no se usa en ningún lugar visible del contexto (las queries usan `empresaNombre`). Es código muerto o legado.

### Feriados sin cobertura de años futuros

`FERIADOS_ARG` cubre 2025, 2026 y 2027 en la mayoría de archivos. Cuando el sistema opere en 2028 en adelante, los feriados serán ignorados.

### Datos semilla hardcodeados en `AppDataContext`

`DEFAULT_CONFIG` en `AppDataContext.jsx` contiene listas completas de vigiladores (100+ nombres), supervisores, vehículos, objetivos — todos hardcodeados para "Brinks Argentina". En un sistema multi-tenant esto debería cargarse desde Firestore.

---

## 6. Problemas de performance

### Subscripciones Firestore sin cleanup expuesto al usuario

En `AppDataContext.jsx`:
- Se usa `onSnapshot` para jornadas, planes, etc. Los `unsub` se limpian correctamente dentro del `onAuthStateChanged`, pero el `unsubAuth` también se retorna del `useEffect`. ✓ Correcto.

### getDocs sin cleanup (one-shot queries que podrían acumularse)

- `DashboardPersonalScreen.jsx` — `useEffect` con `getDocs` sin cancelación. Si el componente se desmonta antes de que termine la query, el `setTodosLegajos` se llamará en un componente desmontado (warning de React en dev, no leak real en prod con React 18+).
- `FacturacionScreen.jsx`, `AnalisisHorasPASScreen.jsx` — igual.
- `ConsolidadoScreen.jsx` — igual.

### Componentes sin `useMemo`/`useCallback` en cálculos pesados

- `ConsolidadoScreen.jsx` — las funciones `horasDeValor`, `horasNocturnas`, `getDias` se llaman en bucles dentro de `useMemo` correctamente, pero la función `calcularFilas` (si existe) o el procesamiento principal no está claro. Verificar si hay cálculos fuera de `useMemo`.
- `AnalisisHorasPASScreen.jsx` — las `filas` se calculan en el cuerpo del componente con `.map()` sobre `docs` sin `useMemo`.
- `GestionPersonalScreen.jsx` — procesamiento de personal sin `useMemo`.

### Componentes muy grandes que deberían dividirse

| Archivo | Líneas aprox. | Sugerencia |
|---|---|---|
| `ProgramacionServiciosScreen.jsx` | ~1700 líneas | Extraer `GrillaServicio`, `VistaTurnos`, `ProgramacionTodos` en archivos separados (ya son exports nombrados pero en el mismo archivo) |
| `ConsolidadoScreen.jsx` | ~1300+ líneas | Extraer la grilla, el panel de estadísticas y el selector de período |
| `DashboardScreen.jsx` | ~820 líneas | Extraer cada tab (Resumen, Supervisores, Tiempos, etc.) en sub-componentes |
| `GestionPersonalScreen.jsx` | ~700+ líneas | Extraer los formularios de cada tipo de personal |
| `AdminContratoHome.jsx` | ~650 líneas | Extraer los sub-paneles de turnos como componentes separados |

### Carga de datos sin condición

- `VigHome.jsx` — `useClientesData(empresaNombre)` se llama al montar **siempre**, antes de que el usuario complete el check-in. Los objetivos se cargan aunque el usuario no llegue a verlos.

---

## 7. Buenas prácticas

### PropTypes faltantes

Ningún componente del proyecto tiene PropTypes definidos. Dado que es una app React sin TypeScript, la ausencia de PropTypes hace que los errores de props sean silenciosos. Afecta a todos los archivos.

### Keys usando índice en listas que pueden cambiar

| Archivo | Patrón problemático |
|---|---|
| `DashboardScreen.jsx` | `key={i}` en KPIs, en rows de supervisores, en objCumpl |
| `DashboardPersonalScreen.jsx` | `key={i}` en CalendarioCumpleanos (los cumpleaños tienen personas estables — menor impacto) |
| `AdminContratoHome.jsx` | `MESES_ES.map((m, i) => <option key={i}>)` — en listas de opciones fijas está OK |
| `VigHome.jsx` | `key={i}` en actividades del calendario |

**Nota:** El uso de índice en listas estáticas (meses, opciones de turno) es aceptable. El problema real es en listas dinámicas que se reordenan o filtran.

### Funciones definidas dentro del render

- `AdminContratoHome.jsx` — `renderHeader` y `volverBtn` son funciones definidas dentro del componente que se **recrean en cada render**. Deberían ser `useCallback` o extraerse como sub-componentes.
- `SupervisorHome.jsx` — igual patrón con `renderHeader` y `volverBtn`.
- `DashboardScreen.jsx` — IIFE `(() => { ... })()` usadas dentro del JSX para el tab de supervisores y el de vehículos. Aunque funcionan, dificultan la legibilidad y no se benefician de memoización.

### Archivo mal ubicado

- `src/screens/AuthContext.jsx` — **duplicado o legado**. El AuthContext real está en `src/context/AuthContext.jsx`. El archivo en `src/screens/` puede causar confusión o importarse por error.

### Acceso a `.zona` sin verificar existencia del objeto

En `AdministrativoHome.jsx` línea 212:
```js
zonaFija={user?.zona || null}
```
El campo `zona` no está en la interfaz de usuario definida en `AuthContext.jsx`. Puede retornar siempre `null`.

---

## Resumen de prioridades

### Alta prioridad (impacta funcionalidad o performance)

1. **`AnalisisHorasPASScreen.jsx`** — la pantalla está incompleta, todas las métricas son `null`. Impacta directamente la funcionalidad.
2. **`src/screens/AuthContext.jsx` duplicado** — puede causar importaciones incorrectas que rompan la autenticación.
3. **`FERIADOS_ARG` solo llega a 2027** — en 2028 los feriados dejarán de reconocerse, afectando cálculos de horas y facturación.
4. **`tieneSimulados = false` con `showBorrar` y `limpiarSimulados` muertos** en `DashboardScreen.jsx` — estado innecesario que mantiene referencias a funciones no utilizadas.
5. **Extracción de `FERIADOS_ARG` a un módulo compartido** — eliminaría 4 fuentes de verdad para el mismo dato.
6. **Carga anticipada en `VigHome`** — `useClientesData` se llama antes del check-in, generando una query Firestore innecesaria en cada apertura de la app para vigiladores.

### Media prioridad (mejora calidad del código)

7. **`CalendarioSemanal` triplicado** — 3 copias casi idénticas con diferente prefijo CSS (`vh-`, `sh-`). Extraer a `src/components/CalendarioSemanal.jsx` con prop `prefix` o usando variables CSS.
8. **`PeriodoCard` triplicado** — 3 copias en los Home de cada rol. Extraer a componente compartido.
9. **Colecciones Firestore como constantes** — solo aplicado parcialmente en esta auditoría. Completar en `ConsolidadoScreen`, `ControlClienteScreen`, `usePersonalData`, `useClientesData`.
10. **`getDias`, `fmtKey`, `horasDeValor` duplicados** — mover a `src/utils/periodoUtils.js`.
11. **`onSelect` prop muerto en `PanelInformes`** — limpiar la firma del componente.
12. **`EMPRESA_ID = "brinks_ar"` sin uso** en `AppDataContext`.
13. **`AnalisisHorasPASScreen` sin `useMemo` en cálculo de `filas`** — recalcula en cada render.

### Baja prioridad (cosmético / estilo)

14. **Colores hexadecimales hardcodeados en JSX** — `#7c3aed`, `#ec4899`, etc. en `DashboardPersonalScreen`, `DashboardScreen`, `AnalisisHorasPASScreen`. Reemplazar con variables CSS del `variables.css`.
15. **PropTypes faltantes en todos los componentes** — agregar gradualmente o migrar a TypeScript.
16. **`renderHeader` y `volverBtn` sin `useCallback`** en Home screens — overhead mínimo pero inconsistente con buenas prácticas.
17. **`descripcion` vs `desc`** en arrays de módulos de diferentes roles — unificar nomenclatura.
18. **`MESES_ES_LARGO` vs `MESES_LARGO`** — renombrar para consistencia.
19. **Archivos de pantallas en `src/screens/` sin subcarpetas por rol** — aplicar reorganización propuesta en sección 2 en un sprint dedicado.
20. **`AnalistaDashboard.jsx`** sin CSS propio — verificar si tiene estilos inline excesivos.

---

## Cambios aplicados en esta auditoría

Los siguientes cambios fueron aplicados directamente (son seguros y no rompen imports):

| # | Archivo | Cambio |
|---|---|---|
| 1 | `DashboardScreen.jsx` | Eliminado import no utilizado `exportarExcel` |
| 2 | `DashboardScreen.jsx` | Eliminado `TIPO_LABEL` del import (solo se usa `TIPO_COLOR`) |
| 3 | `VigHome.jsx` | Eliminado import no utilizado `PERMISOS_BASE` |
| 4 | `ProgramacionServiciosScreen.jsx` | Extraídas constantes `COL_PROG = "programacionServicios"` y `COL_LEGAJOS = "legajos"`; reemplazadas todas las ocurrencias |
| 5 | `FacturacionScreen.jsx` | Extraída constante `COL_PROG = "programacionServicios"`; reemplazada la ocurrencia |
| 6 | `AnalisisHorasPASScreen.jsx` | Extraída constante `COL_PROG = "programacionServicios"`; reemplazada la ocurrencia |
| 7 | `AdminContratoHome.jsx` | Array de años extendido de `[2025..2028]` a `[2025..2030]` |
| 8 | `AdministrativoHome.jsx` | Array de años extendido de `[2025..2028]` a `[2025..2030]` |
| 9 | `SupervisorHome.jsx` | Array de años extendido de `[2025..2028]` a `[2025..2030]` |

---

## Correcciones aplicadas — 2026-03-21

### Cambios realizados

| # | Paso | Archivo(s) | Cambio |
|---|---|---|---|
| 1 | PASO 1 | `src/screens/AuthContext.jsx` | Verificado: ningún archivo importa desde `screens/AuthContext`. **Eliminación pendiente** — requiere Bash (ver Pendientes). |
| 2 | PASO 2a | `src/utils/periodoUtils.js` | **Creado**. Exporta: `DIAS_ES`, `MESES_ES` (nombres completos), `getDias`, `fmtKey`, `horasDeValor`, `OPCIONES`. Implementaciones copiadas exactamente de `ProgramacionServiciosScreen.jsx`. |
| 3 | PASO 2b | `src/utils/feriados.js` | **Creado**. Exporta `FERIADOS_ARG` con feriados Argentina 2025–2028 (extendido desde 2027). |
| 4 | PASO 3 | `ProgramacionServiciosScreen.jsx` | Reemplazadas definiciones locales de `DIAS_ES`, `MESES_ES`, `OPCIONES`, `FERIADOS_ARG`, `getDias`, `fmtKey` con imports de utils. `horasDeValor` mantenida local (usa `esLaboral()` local). |
| 5 | PASO 3 | `FacturacionScreen.jsx` | Reemplazadas `MESES_ES`, `FERIADOS_ARG`, `getDias`, `fmtKey` con imports de utils. `horasDeValor` mantenida local (implementación diferente: sin `esLaboral`). |
| 6 | PASO 3+4 | `ControlClienteScreen.jsx` | Reemplazadas `DIAS_ES`, `MESES_ES`, `OPCIONES`, `FERIADOS_ARG`, `getDias`, `fmtKey` con imports de utils. Agregada constante `COL_PROG`. Reemplazado string hardcodeado. `horasDeValor` mantenida local (filtra códigos extra). |
| 7 | PASO 3+8 | `ConsolidadoScreen.jsx` | Reemplazadas `DIAS_ES`, `MESES_ES`, `FERIADOS_ARG`, `getDias`, `fmtKey` con imports de utils. Agregadas `COL_PROG` y `COL_LEGAJOS`; reemplazados todos los strings hardcodeados. `horasDeValor` mantenida local (maneja `typeof val === "number"`). Año selector extendido a 2030. |
| 8 | PASO 3 | `AdministrativoHome.jsx`, `SupervisorHome.jsx`, `VigHome.jsx` | **No modificados** — sus `fmtKey`, `DIAS_ES`, `MESES_ES` tienen implementaciones distintas: usan `d.toISOString().slice(0,10)` (zona horaria para calendario visual) y `MESES_ES` abreviado (3 letras). Reemplazarlos desde utils rompería el calendario. Documentado como diferencia intencional. |
| 9 | PASO 5 | `DashboardScreen.jsx` | Eliminados: `const tieneSimulados = false`, bloque JSX `{tieneSimulados && (...)}`, `const [showBorrar, setShowBorrar] = useState(false)`, y `limpiarSimulados` del destructuring. |
| 10 | PASO 6 | `VigHome.jsx` | Eliminado parámetro `onSelect` de la firma de `PanelInformes`. |
| 11 | PASO 7 | `AppDataContext.jsx` | **No modificado** — `EMPRESA_ID = "brinks_ar"` se usa en 15+ lugares del mismo archivo (queries Firestore, addDoc, etc.). No es código muerto. Documentado como falso positivo en la auditoría original. |
| 12 | PASO 9 | `AnalisisHorasPASScreen.jsx` | Agregado `useMemo` al import. `filas` wrapeado en `useMemo(() => docs.map(...), [docs, año, mes])`. |
| 13 | PASO 10 | `VigHome.jsx` | Renombrado `descripcion` → `desc` en todos los objetos de `MODULOS`. Actualizada referencia `m.descripcion` → `m.desc` en el JSX. |

### Pendientes (no aplicados y razón)

| # | Paso | Motivo |
|---|---|---|
| P1 | PASO 1 — Eliminar `src/screens/AuthContext.jsx` | Requiere comando de shell (rm/del). No hay imports hacia ese archivo — es seguro eliminar manualmente con `rm src/screens/AuthContext.jsx` o desde el explorador de archivos. |
| P2 | PASO 3 — Unificar `fmtKey` en VigHome/SupervisorHome/AdministrativoHome | Las tres usan `d.toISOString().slice(0,10)` (zona horaria UTC). La versión de `periodoUtils` construye la clave manualmente con hora local. Son semánticamente distintas para el uso calendar. No reemplazar. |
| P3 | PASO 3 — Unificar `MESES_ES` corto en archivos de Home | Los Home usan la versión abreviada `["Ene","Feb",...]` para el strip del calendario. `periodoUtils` exporta nombres completos `["Enero","Febrero",...]` para la grilla de programación. Unificar requeriría agregar una segunda exportación o adaptar el CSS. |
| P4 | PASO 3 — Unificar `horasDeValor` | Las cuatro implementaciones difieren en cómo filtran códigos de ausentismo. Unificar requeriría un análisis de regresión funcional en cada pantalla. |
| P5 | PASO 7 — `EMPRESA_ID` en AppDataContext | Falso positivo: se usa en 15+ lugares del mismo archivo. No es código muerto. |

