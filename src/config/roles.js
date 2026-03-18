// ═══════════════════════════════════════════════════════════════
//  src/config/roles.js
//  Fuente única de verdad para roles y permisos del sistema.
//  Importar desde cualquier pantalla o contexto — nunca hardcodear.
// ═══════════════════════════════════════════════════════════════

// ── Roles disponibles ─────────────────────────────────────────
export const ROLES = {
    SUPER_ADMIN:    "super_admin",    // Cyrano — acceso total al sistema
    ADMIN_EMPRESA:  "admin_empresa",  // Admin de empresa (ej: Brinks AR)
    ADMIN_CONTRATO: "admin_contrato", // Admin de contrato/cliente
    SUPERVISOR:     "supervisor",     // Supervisor de campo — gestiona vigiladores
    VIGILADOR:      "vigilador",      // Operador de campo
};

// ── Labels para UI ────────────────────────────────────────────
export const ROLE_LABELS = {
    super_admin:    "Super Administrador",
    admin_empresa:  "Administrador de Empresa",
    admin_contrato: "Administrador de Contrato",
    supervisor:     "Supervisor",
    vigilador:      "Vigilador",
};

export const ROLE_ICONS = {
    super_admin:    "⚙️",
    admin_empresa:  "🏛️",
    admin_contrato: "🏢",
    supervisor:     "🔍",
    vigilador:      "👷",
};

// ── Módulos del sistema ───────────────────────────────────────
// Cada key es un permiso verificable con tienePermiso()
export const MODULOS = {
    // Super Admin
    EMPRESAS:           "empresas",
    USUARIOS:           "usuarios",

    // Admin Empresa / Contrato
    SUPERVISION:        "supervision",
    CONTROL_RONDAS:     "control_rondas",
    PLAN_SEGURIDAD:     "plan_seguridad",
    PLAN_CAPACITACION:  "plan_capacitacion",
    ANALISIS_RIESGOS:   "analisis_riesgos",
    TURNOS_CARGAR:      "turnos_cargar",
    TURNOS_VER:         "turnos_ver",
    PLANILLAS:          "planillas",
    INFORMES:           "informes",

    // Vigilador
    LIBRO_ACTAS:        "libro_actas",
    REALIZAR_RONDA:     "realizar_ronda",
    PEDIDO_INSUMOS:     "pedido_insumos",
};

// ── Permisos base por rol ─────────────────────────────────────
// Estos son los defaults. Se pueden sobreescribir por usuario con permisos override.
export const PERMISOS_BASE = {

    super_admin: {
        empresas:           true,
        usuarios:           true,
        supervision:        true,
        control_rondas:     true,
        plan_seguridad:     true,
        plan_capacitacion:  true,
        analisis_riesgos:   true,
        turnos_cargar:      true,
        turnos_ver:         true,
        planillas:          true,
        informes:           true,
        libro_actas:        true,
        realizar_ronda:     true,
    },

    admin_empresa: {
        empresas:           false,
        usuarios:           true,
        supervision:        true,
        control_rondas:     true,
        plan_seguridad:     true,
        plan_capacitacion:  true,
        analisis_riesgos:   true,
        turnos_cargar:      true,
        turnos_ver:         true,
        planillas:          true,
        informes:           true,
        libro_actas:        false,
        realizar_ronda:     false,
    },

    admin_contrato: {
        empresas:           false,
        usuarios:           true,   // gestiona supervisores y vigiladores de su contrato
        supervision:        false,
        control_rondas:     true,   // ve el cumplimiento del supervisor
        plan_seguridad:     true,   // carga y edita
        plan_capacitacion:  true,   // carga y edita
        analisis_riesgos:   true,   // carga y edita
        turnos_cargar:      true,   // arma los turnos
        turnos_ver:         true,
        planillas:          true,
        informes:           true,
        libro_actas:        false,
        realizar_ronda:     false,
    },

    supervisor: {
        empresas:           false,
        usuarios:           false,
        supervision:        true,   // hace las rondas de supervisión
        control_rondas:     true,   // registra y ve sus rondas
        plan_seguridad:     false,  // solo lectura — no carga
        plan_capacitacion:  false,  // solo lectura — no carga
        analisis_riesgos:   false,  // solo lectura — no carga
        turnos_cargar:      false,
        turnos_ver:         true,
        planillas:          true,
        informes:           true,
        libro_actas:        false,
        realizar_ronda:     false,
    },

    vigilador: {
        empresas:           false,
        usuarios:           false,
        supervision:        false,
        control_rondas:     false,
        plan_seguridad:     false,
        plan_capacitacion:  false,
        analisis_riesgos:   false,
        turnos_cargar:      false,
        turnos_ver:         true,
        planillas:          true,
        informes:           true,
        libro_actas:        true,
        realizar_ronda:     true,
        pedido_insumos:     true,
        control_vehicular:  true,
    },
};

// ── Resolver permisos finales ─────────────────────────────────
// Combina los permisos base del rol con los overrides individuales del usuario.
// Los overrides solo sobreescriben lo que se define explícitamente.
export function resolverPermisos(rol, permisosOverride = {}) {
    const base = PERMISOS_BASE[rol] ?? PERMISOS_BASE.vigilador;
    return { ...base, ...permisosOverride };
}

// ── Helpers de verificación ───────────────────────────────────
export const esSuperAdmin    = (rol) => rol === ROLES.SUPER_ADMIN;
export const esAdminEmpresa  = (rol) => rol === ROLES.ADMIN_EMPRESA;
export const esAdminContrato = (rol) => rol === ROLES.ADMIN_CONTRATO;
export const esVigilador     = (rol) => rol === ROLES.VIGILADOR;

// Es admin de algún nivel (no vigilador)
export const esAdmin = (rol) =>
    [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.ADMIN_CONTRATO].includes(rol);

// Puede gestionar usuarios
export const puedeGestionarUsuarios = (rol) =>
    [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA].includes(rol);

// Puede crear otros admins de contrato
export const puedeCrarAdminContrato = (rol) =>
    [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA].includes(rol);

// Verificar un permiso puntual contra el objeto de permisos resueltos
export const tienePermiso = (permisos, modulo) => permisos?.[modulo] === true;

// ── Roles que puede crear cada rol ───────────────────────────
// Controla qué roles puede asignar cada nivel en la UI de creación de usuarios
export const ROLES_CREABLES_POR = {
    super_admin:    [ROLES.ADMIN_EMPRESA, ROLES.ADMIN_CONTRATO, ROLES.SUPERVISOR, ROLES.VIGILADOR],
    admin_empresa:  [ROLES.ADMIN_CONTRATO, ROLES.SUPERVISOR, ROLES.VIGILADOR],
    admin_contrato: [ROLES.SUPERVISOR, ROLES.VIGILADOR],
    supervisor:     [],
    vigilador:      [],
};
