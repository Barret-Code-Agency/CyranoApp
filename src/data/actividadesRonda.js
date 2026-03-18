// src/data/actividadesRonda.js
// 40 actividades predefinidas para las rondas de seguridad.
// Cada checkpoint puede tener cualquier combinación de estas actividades.

export const ACTIVIDADES_RONDA = [
    // ── Accesos (9) ───────────────────────────────────────────────────────────
    { id:"a01", cat:"Accesos",           nombre:"Candado en buen estado y cerrado",            icono:"🔒" },
    { id:"a02", cat:"Accesos",           nombre:"Portón principal cerrado",                    icono:"🚪" },
    { id:"a03", cat:"Accesos",           nombre:"Portón de servicio cerrado",                  icono:"🚪" },
    { id:"a04", cat:"Accesos",           nombre:"Puerta de emergencia libre y cerrada",        icono:"🆘" },
    { id:"a05", cat:"Accesos",           nombre:"Control de acceso de personal",               icono:"👷" },
    { id:"a06", cat:"Accesos",           nombre:"Control de acceso de visitas",                icono:"🧑‍💼" },
    { id:"a07", cat:"Accesos",           nombre:"Barrera vehicular operativa",                 icono:"🚧" },
    { id:"a08", cat:"Accesos",           nombre:"Vallado perimetral sin daños",                icono:"⛓️" },
    { id:"a09", cat:"Accesos",           nombre:"Molinetes/torniquetes operativos",            icono:"🔄" },

    // ── Seguridad electrónica (8) ─────────────────────────────────────────────
    { id:"a10", cat:"Seg. electrónica",  nombre:"Cámaras operativas y sin obstrucción",       icono:"📹" },
    { id:"a11", cat:"Seg. electrónica",  nombre:"Panel de alarma sin alertas activas",        icono:"🔔" },
    { id:"a12", cat:"Seg. electrónica",  nombre:"Sistema de alarma activado",                 icono:"🚨" },
    { id:"a13", cat:"Seg. electrónica",  nombre:"Iluminación de seguridad exterior OK",       icono:"💡" },
    { id:"a14", cat:"Seg. electrónica",  nombre:"Iluminación de emergencia funcional",        icono:"🔦" },
    { id:"a15", cat:"Seg. electrónica",  nombre:"DVR/NVR sin fallas",                        icono:"📺" },
    { id:"a16", cat:"Seg. electrónica",  nombre:"Radio de comunicación operativa",            icono:"📻" },
    { id:"a17", cat:"Seg. electrónica",  nombre:"Sistema de intercomunicación operativo",     icono:"📞" },

    // ── Instalaciones (11) ────────────────────────────────────────────────────
    { id:"a18", cat:"Instalaciones",     nombre:"Sala de servidores temperatura normal",      icono:"🖥️" },
    { id:"a19", cat:"Instalaciones",     nombre:"Tablero eléctrico sin anomalías",            icono:"⚡" },
    { id:"a20", cat:"Instalaciones",     nombre:"Generador de emergencia en standby",         icono:"🔋" },
    { id:"a21", cat:"Instalaciones",     nombre:"Aire acondicionado apagado",                 icono:"❄️" },
    { id:"a22", cat:"Instalaciones",     nombre:"Recepción/lobby en orden",                   icono:"🏢" },
    { id:"a23", cat:"Instalaciones",     nombre:"Depósito/almacén sin novedades",             icono:"📦" },
    { id:"a24", cat:"Instalaciones",     nombre:"Azotea/terraza sin anomalías",               icono:"🏚️" },
    { id:"a25", cat:"Instalaciones",     nombre:"Sótano/subsuelo sin anomalías",              icono:"⬇️" },
    { id:"a26", cat:"Instalaciones",     nombre:"Sala de máquinas sin anomalías",             icono:"⚙️" },
    { id:"a27", cat:"Instalaciones",     nombre:"Sala de reuniones en orden",                 icono:"🪑" },
    { id:"a28", cat:"Instalaciones",     nombre:"Baños y vestuarios en orden",                icono:"🚿" },

    // ── Contra incendios (6) ──────────────────────────────────────────────────
    { id:"a29", cat:"Contra incendios",  nombre:"Extintores en lugar y precintados",          icono:"🧯" },
    { id:"a30", cat:"Contra incendios",  nombre:"Hidrantes operativos y accesibles",          icono:"🚒" },
    { id:"a31", cat:"Contra incendios",  nombre:"Sistema de rociadores sin obstrucción",      icono:"💧" },
    { id:"a32", cat:"Contra incendios",  nombre:"Salidas de emergencia despejadas",           icono:"🏃" },
    { id:"a33", cat:"Contra incendios",  nombre:"Señalización de emergencia visible",         icono:"🪧" },
    { id:"a34", cat:"Contra incendios",  nombre:"Detectores de humo operativos",              icono:"🔴" },

    // ── Vehículos (4) ─────────────────────────────────────────────────────────
    { id:"a35", cat:"Vehículos",         nombre:"Sin vehículos en zona restringida",          icono:"🚗" },
    { id:"a36", cat:"Vehículos",         nombre:"Estacionamiento en orden",                   icono:"🅿️" },
    { id:"a37", cat:"Vehículos",         nombre:"Registro de vehículos de carga al día",      icono:"🚛" },
    { id:"a38", cat:"Vehículos",         nombre:"Vehículos de la empresa en orden",           icono:"🚙" },

    // ── Personal (2) ──────────────────────────────────────────────────────────
    { id:"a39", cat:"Personal",          nombre:"Personal presente y en puesto",              icono:"👮" },
    { id:"a40", cat:"Personal",          nombre:"Botiquín de primeros auxilios completo",     icono:"🩺" },
];

/** Categorías únicas en orden de aparición */
export const CATS_ACTIVIDADES = [...new Set(ACTIVIDADES_RONDA.map(a => a.cat))];

/** Busca una actividad por ID */
export const getActividad = (id) => ACTIVIDADES_RONDA.find(a => a.id === id);
