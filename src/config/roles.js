// ═══════════════════════════════════════════════════════════════
//  src/config/roles.js  —  Fuente única de verdad para roles,
//  módulos y permisos del sistema.
// ═══════════════════════════════════════════════════════════════

// ── Roles ─────────────────────────────────────────────────────
export const ROLES = {
    SUPER_ADMIN:    "super_admin",
    ADMIN_CONTRATO: "admin_contrato",
    SUPERVISOR:     "supervisor",
    ADMINISTRATIVO: "administrativo",
    VIGILADOR:      "vigilador",
};

export const ROLE_LABELS = {
    super_admin:    "Super Administrador",
    admin_contrato: "Gerencia de Operaciones",
    supervisor:     "Supervisor / Encargado",
    administrativo: "Administrativo",
    vigilador:      "Vigilador",
};

export const ROLE_ICONS = {
    super_admin:    "⚙️",
    admin_contrato: "🏢",
    supervisor:     "🔍",
    administrativo: "🗂️",
    vigilador:      "👷",
};

export const ROLE_COLORS = {
    super_admin:    "red",
    admin_contrato: "blue",
    supervisor:     "green",
    administrativo: "orange",
    vigilador:      "gray",
};

// Roles que puede crear cada nivel
export const ROLES_CREABLES_POR = {
    super_admin:    ["admin_contrato", "supervisor", "administrativo", "vigilador"],
    admin_contrato: ["supervisor", "administrativo", "vigilador"],
    supervisor:     [],
    administrativo: [],
    vigilador:      [],
};

// ── Módulos — fuente única de verdad ──────────────────────────
//  Cada grupo tiene los módulos disponibles para ese perfil de rol.
//  SuperAdmin los asigna a nivel empresa (qué contrató).
//  Gerencia los asigna a nivel usuario (quién puede ver qué).
export const MODULOS_DEF = [
    {
        grupo:  "Gerencia de Operaciones",
        rol:    "admin_contrato",
        icon:   "🏢",
        color:  "blue",
        modulos: [
            { key: "muro_comunicacion",   label: "Muro de Comunicación",      icon: "📢", desc: "Publicar y ver comunicaciones para el personal" },
            { key: "supervision",         label: "Supervisión",               icon: "🔍", desc: "Panel de supervisión, objetivos y cumplimiento" },
            { key: "gestion_datos",       label: "Gestión de datos",          icon: "🗄️", desc: "Clientes, objetivos y datos operativos del contrato" },
            { key: "dashboards_gestion",  label: "Dashboards de gestión",     icon: "📊", desc: "Métricas y KPIs de la empresa" },
            { key: "dashboard_personal",  label: "Dashboard de personal",     icon: "👥", desc: "Estado y novedades del personal" },
            { key: "turnos",              label: "Gestión de horas",          icon: "📅", desc: "Programación y control de turnos del personal" },
            { key: "informes",            label: "Informes",                  icon: "📄", desc: "Ver y redactar informes del contrato" },
            { key: "rondas_monitor",      label: "Monitor de Rondas",         icon: "📡", desc: "Ver resultados y cumplimiento de rondas en tiempo real" },
            { key: "gestion_clientes",    label: "Gestión de Clientes",       icon: "🏢", desc: "Cargar clientes, objetivos y puestos del contrato" },
            { key: "asig_personal",       label: "Asignación de personal",    icon: "👥", desc: "Asignar vigiladores a los puestos del contrato" },
            { key: "plan_seguridad",      label: "Plan de seguridad",         icon: "🛡️", desc: "Cargar y gestionar el plan de seguridad del contrato" },
            { key: "plan_capacitacion",   label: "Plan de capacitación",      icon: "🎓", desc: "Planificar y registrar las capacitaciones del personal" },
            { key: "analisis_riesgos",    label: "Análisis de riesgos",       icon: "⚠️", desc: "Relevamiento y gestión de riesgos del objetivo" },
            { key: "muro_procedimientos", label: "Muro de Procedimientos",    icon: "📌", desc: "Ver y publicar procedimientos operativos vigentes" },
            { key: "capacitacion",        label: "Capacitación",              icon: "🎓", desc: "Ver y subir cursos y materiales de formación" },
            { key: "gestion_usuarios",    label: "Gestión de Usuarios",       icon: "👤", desc: "Alta, baja y permisos de usuarios de la empresa" },
        ],
    },
    {
        grupo:  "Supervisor / Encargado",
        rol:    "supervisor",
        icon:   "🔍",
        color:  "green",
        modulos: [
            { key: "muro_comunicacion",        label: "Muro de Comunicación",       icon: "📢", desc: "Ver y publicar comunicaciones para el personal" },
            { key: "supervision",              label: "Supervisión",                icon: "🔍", desc: "Plan de supervisión, cumplimiento y carga" },
            { key: "rondas_plantillas",        label: "Plantillas de rondas",       icon: "🗺️", desc: "Crear y configurar rondas con checkpoints GPS" },
            { key: "rondas_monitor",           label: "Monitor de rondas",          icon: "📡", desc: "Ver resultados y cumplimiento de rondas en tiempo real" },
            { key: "turnos",                   label: "Gestión de horarios",        icon: "📅", desc: "Ver y gestionar los turnos del personal" },
            { key: "planillas",                label: "Planillas",                  icon: "📊", desc: "Planillas operativas del puesto" },
            { key: "informes",                 label: "Informes",                   icon: "📄", desc: "Ver y redactar informes de supervisión" },
            { key: "auditoria_puesto",         label: "Auditoría de Puesto",        icon: "🔎", desc: "Realizar auditorías operativas del puesto" },
            { key: "dashboard_personal",       label: "Dashboard de personal",      icon: "👥", desc: "Estado y novedades del personal" },
            { key: "felicitaciones_sanciones", label: "Felicitaciones y Sanciones", icon: "📋", desc: "Registrar felicitaciones o sanciones del personal" },
            { key: "informe_gestion",          label: "Informe de Gestión",         icon: "📊", desc: "Generar el informe de gestión del período" },
            { key: "informe_visita",           label: "Informe de Visita",          icon: "🤝", desc: "Registrar novedades de la visita al cliente" },
            { key: "muro_procedimientos",      label: "Muro de Procedimientos",     icon: "📌", desc: "Consultar procedimientos operativos vigentes" },
            { key: "capacitacion",             label: "Capacitación",               icon: "🎓", desc: "Ver y subir cursos y materiales de formación" },
        ],
    },
    {
        grupo:  "Administrativo",
        rol:    "administrativo",
        icon:   "🗂️",
        color:  "orange",
        modulos: [
            { key: "muro_comunicacion",   label: "Muro de Comunicación",   icon: "📢", desc: "Ver y publicar comunicaciones para el personal" },
            { key: "dashboard_personal",  label: "Dashboard de personal",  icon: "👥", desc: "Estado y novedades del personal" },
            { key: "informes",            label: "Informes",               icon: "📄", desc: "Ver y crear informes" },
            { key: "planillas",           label: "Planillas",              icon: "📊", desc: "Planillas operativas" },
            { key: "turnos",              label: "Turnos de trabajo",      icon: "🕐", desc: "Visualizar los horarios del personal" },
            { key: "actualizacion_datos", label: "Actualización de datos", icon: "🗂️", desc: "Legajos, clientes, objetivos, vehículos y más" },
            { key: "facturacion",         label: "Facturación",            icon: "💰", desc: "Gestión de facturación al cliente" },
            { key: "control_horas",       label: "Control de horas",       icon: "⏱️", desc: "Control de horas trabajadas y facturadas" },
            { key: "ausentismo",          label: "Ausentismo",             icon: "📉", desc: "Registro y seguimiento de ausentismo" },
            { key: "muro_procedimientos", label: "Muro de Procedimientos", icon: "📌", desc: "Consultar procedimientos operativos vigentes" },
            { key: "capacitacion",        label: "Capacitación",           icon: "🎓", desc: "Ver y subir cursos y materiales de formación" },
        ],
    },
    {
        grupo:  "Vigilador",
        rol:    "vigilador",
        icon:   "👷",
        color:  "gray",
        modulos: [
            { key: "muro_comunicacion",   label: "Muro de Comunicación",   icon: "📢", desc: "Novedades y comunicados de la empresa" },
            { key: "libro_actas",         label: "Libro de Actas Digital", icon: "📖", desc: "Registrar novedades y actas del turno" },
            { key: "realizar_ronda",      label: "Realizar Ronda",         icon: "🗺️", desc: "Iniciar y registrar rondas de vigilancia" },
            { key: "control_vehicular",   label: "Control de Vehículo",    icon: "🚗", desc: "Checklist del vehículo asignado" },
            { key: "planillas",           label: "Planillas",              icon: "📊", desc: "Planillas operativas del puesto" },
            { key: "informes",            label: "Informes",               icon: "📄", desc: "Crear y consultar informes del puesto" },
            { key: "turnos_ver",          label: "Mis Turnos",             icon: "🕐", desc: "Ver turnos y calendario asignados" },
            { key: "pedido_insumos",      label: "Pedido de Insumos",      icon: "📦", desc: "Solicitar materiales o insumos para el puesto" },
            { key: "inventarios",         label: "Inventarios",            icon: "🗃️", desc: "Gestionar el inventario del puesto" },
            { key: "muro_procedimientos", label: "Muro de Procedimientos", icon: "📌", desc: "Consultar procedimientos operativos vigentes" },
            { key: "capacitacion",        label: "Capacitación",           icon: "🎓", desc: "Ver cursos y materiales de formación" },
        ],
    },
];

// Helper: obtener módulos de un rol específico
export const modulosPorRol = (rol) =>
    MODULOS_DEF.find(g => g.rol === rol)?.modulos ?? [];

// Todos los módulos como objeto flat { key: label }
export const TODOS_LOS_MODULOS = MODULOS_DEF.flatMap(g => g.modulos)
    .reduce((acc, m) => { acc[m.key] = m; return acc; }, {});

// ── Perfiles predefinidos de módulos por rol ──────────────────
//  Gerencia puede aplicar un perfil como punto de partida
//  y luego ajustar módulo por módulo.
export const PERFILES = {
    supervisor: [
        {
            id:      "supervisor_full",
            label:   "Supervisor completo",
            desc:    "Acceso a todos los módulos de supervisor",
            modulos: Object.fromEntries(
                MODULOS_DEF.find(g => g.rol === "supervisor")?.modulos.map(m => [m.key, true]) ?? []
            ),
        },
        {
            id:      "supervisor_basico",
            label:   "Supervisor básico",
            desc:    "Solo supervisión y planillas",
            modulos: {
                muro_comunicacion:        true,
                supervision:              true,
                planillas:                true,
                informes:                 true,
                turnos:                   false,
                rondas_plantillas:        false,
                rondas_monitor:           false,
                auditoria_puesto:         false,
                dashboard_personal:       false,
                felicitaciones_sanciones: false,
                informe_gestion:          false,
                informe_visita:           false,
                muro_procedimientos:      true,
                capacitacion:             true,
            },
        },
    ],
    vigilador: [
        {
            id:      "vigilador_full",
            label:   "Vigilador completo",
            desc:    "Acceso a todos los módulos de vigilador",
            modulos: Object.fromEntries(
                MODULOS_DEF.find(g => g.rol === "vigilador")?.modulos.map(m => [m.key, true]) ?? []
            ),
        },
        {
            id:      "vigilador_basico",
            label:   "Vigilador básico",
            desc:    "Solo libro de actas e informes",
            modulos: {
                muro_comunicacion:   true,
                libro_actas:         true,
                realizar_ronda:      false,
                control_vehicular:   false,
                planillas:           true,
                informes:            true,
                turnos_ver:          true,
                pedido_insumos:      false,
                inventarios:         false,
                muro_procedimientos: true,
                capacitacion:        true,
            },
        },
    ],
    administrativo: [
        {
            id:      "administrativo_full",
            label:   "Administrativo completo",
            desc:    "Acceso a todos los módulos administrativos",
            modulos: Object.fromEntries(
                MODULOS_DEF.find(g => g.rol === "administrativo")?.modulos.map(m => [m.key, true]) ?? []
            ),
        },
    ],
};

// ── Función central de acceso ─────────────────────────────────
//
//  tieneAcceso(empresaModulos, user, key)
//
//  Reglas:
//    1. SuperAdmin → siempre tiene acceso
//    2. empresa.modulos[key] === false → bloqueado (no contrató ese módulo)
//    3. user.permisosModulos[key] === false → bloqueado por Gerencia
//    4. Si no hay restricción explícita → acceso permitido
//
export function tieneAcceso(empresaModulos, user, key) {
    if (!user) return false;
    if (user.rol === ROLES.SUPER_ADMIN) return true;
    if (empresaModulos?.[key] === false) return false;
    const pm = user.permisosModulos;
    if (pm && pm[key] === false) return false;
    return true;
}

// ── Helpers de rol ────────────────────────────────────────────
export const esSuperAdmin    = (rol) => rol === ROLES.SUPER_ADMIN;
export const esAdminContrato = (rol) => rol === ROLES.ADMIN_CONTRATO;
export const esVigilador     = (rol) => rol === ROLES.VIGILADOR;
export const esAdmin         = (rol) => [ROLES.SUPER_ADMIN, ROLES.ADMIN_CONTRATO].includes(rol);

// ── Compatibilidad hacia atrás ────────────────────────────────
export const tienePermiso = (permisos, modulo) => permisos?.[modulo] === true;
export function resolverPermisos(rol, permisosOverride = {}) {
    return { ...permisosOverride };
}
