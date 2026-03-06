// src/context/AppDataContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ── Clasificación automática de control según fecha/hora ─────────────────────
export const clasificarControl = (horaInicio, fechaISO) => {
    if (!horaInicio) return { turno: "diurno", esFinDeSemana: false };
    const [h, m]   = horaInicio.split(":").map(Number);
    const minutos  = h * 60 + (m || 0);
    const nocturno = minutos >= 18 * 60 || minutos < 6 * 60; // 18:00–05:59
    let esFinDeSemana = false;
    if (fechaISO) {
        const d = new Date(fechaISO);
        esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
    }
    return { turno: nocturno ? "nocturno" : "diurno", esFinDeSemana };
};

// ── Defaults reales ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    supervisorEmail: "supervisor@empresa.com",
    vehiculos: [
        "Prisma AC 349 CR",
        "Prisma AC 349 CZ",
        "Prisma AC 360 WC",
        "Corolla OPR 557",
        "Corolla AC 349 CQ",
        "Corolla AC 349 CS",
        "Hilux AF 373 JP",
        "Hilux AF 967 YA",
        "Hilux AF 295 SB",
        "Hilux AG 220 JI",
    ],
    objetivos: [
        "Reginald Lee Ranelagh",
        "Reginald Lee Lobos",
        "Reginald Lee La Plata",
        "Reginald Lee Mar del Plata",
        "Reginald Lee Ranelagh Puesto 1",
        "Reginald Lee Ranelagh Puesto 2",
        "Reginald Lee Ranelagh Puesto 4",
        "Reginald Lee Ranelagh Puesto 7",
        "Reginald Lee Ranelagh Puesto 8",
        "Reginald Lee Ranelagh Encargado",
        "Brinks Pergamino",
        "Brinks Movil",
        "Brinks Beron Astrada",
        "Ovnisa Berazategui",
        "Cerro Moro",
        "PAS Puesto 1",
        "PAS Puesto 2",
        "PAS Puesto 3",
        "PAS Puesto 4",
        "PAS Naty",
        "PAS CCTV Gral.",
        "PAS CCTV Fundicion",
        "PAS Encargados",
        "PAS Administrativa",
        "PAS Supervisor",
    ],
    tiposActividad: [
        "Reparaciones (taller)",
        "Traslado de personal",
        "Traslado de elementos",
        "Tareas administrativas",
        "Análisis de vulnerabilidades",
        "Análisis de riesgos",
        "Atención de reclamos",
        "Visita Gremial",
        "Almuerzo/Cena",
        "Otras actividades",
    ],
    vigiladores: [
        "Acevedo Fernando Matias","Acuña Nahuel Gonzalo","Aedo Cinthia Anahi","Aguirre Enrique Andres",
        "Agullo Rodriguez Luciano Adrian","Agüero Farias Maria Elizabeth","Albarenga Braian Martin","Almada Cristian Daniel",
        "Almiron Walter Dario","Amaya Cristian Armando","Arias Marcelo Fabian","Arnaudo Juan",
        "Avila Alejandro Mauricio","Becerra Hector Rafael","Bello Gustavo Norberto","Benitez Gustavo",
        "Blanco Claudio Lujan","Blanco Cristian Abraham","Bordon Soledad Del Valle","Bozzo Antonio",
        "Busto Lucas Abraham","Caballero Adrian Marcelo","Caceres Juan Jose","Caceres Rocio Belen",
        "Calvente Blas Leonardo","Campero Jose Damian","Campos Maximiliano Hernan","Campuzano Walter David",
        "Canelas Damian","Carpio Gloria Victoria","Casas Carlos David","Castellano Sergio Armando",
        "Castro Antonio Horacio","Cejas Maria Paula","Centeno Patricia Brenda","Chacoma Sergio Raul",
        "Coman Julio Ismael","Constancio Damian Nahuel","Copa Ana Paula","Correa Daniel Sebastian",
        "Coscueta Gustavo Walter","Cugliari Hernan Gabriel","Deramo Nicolas Mario","Dias Dana Lucia",
        "Diaz Jonathan Javier","Dos Santos Claudio Hernan Anibal","Duarte Diego Martin","Duarte Tiago Marcelo Ezequiel",
        "Espindola Sergio Walter","Fernandez Alejandro Daniel","Fernandez Cecilia","Fernandez Luis Martin",
        "Funes Gabriela Edith","Garcia Miguel Angel","Godoy Fernando Miguel","Gonzalez Carla Jacqueline",
        "Gonzalez Roberto Antonio","Gordillo Gerardo Agustin","Guiñez Duarte Cesar Daniel","Gutierrez Marcos Jose",
        "Herrera Carlos Alejandro","Herrera Gonzalo Ezequiel","Jara Elio Matias","Juarez Luis Manuel",
        "Julio Paola Gimena","Karbovniczek Jose Pedro","Kloster Rafael Alberto","Kuc Paulo Emanuel",
        "Lagorio Brian","Ledesma Matias Ezequiel","Lencina Mario Antonio","Limenza Gelma Rodolfo Federico",
        "Lobosco Cristian Ivan","Lopez Hugo Gerardo","Lopez Manuel Alejandro","Lopez Marcelo Daniel",
        "Lopez Mario Vicente","Lopez Sergio Alberto","Luna Morales Mayra Liset","Marcial Erica Marcela",
        "Marin Mario Javier","Martinez David","Martinez Sergio Ivan","Mata Raul Alberto",
        "Medina Javier","Mercado Erick Leonardo","Messina Jessica Adriana","Montivero Emanuel Antonio",
        "Morel Fabian Celestino","Morinigo Jose","Moro Cristian Eduardo","Navarro Manuel Francisco",
        "Nieto Claudio Martin","Nuñez Alejo Ismael","Nuñez Francisco Diego","Ortiz Daniel",
        "Oyarzo Sanchez Miguel Alejandro","Pedraza Juan Manuel","Pereira Carmen Gabriela","Petrucci Jose Ruben",
        "Pintos Alexis Emmanuel","Quintana Victor Hugo","Quintas Horacio Gabriel","Quinteros Walter Omar",
        "Quiroga Dana Micaela Yasmin","Racedo Julio Dante","Revilla Rodriguez Hugo Alexander","Reynoso Gustavo Alejandro",
        "Rios Adriel Guillermo Oscar","Rios Francisco Daniel","Rivarola Lucas Fernando","Rivero Giuliana Daniela",
        "Rodriguez Luciano Matias","Rodriguez Luis Alberto","Rodriguez Patricia Elizabet","Rojas Oscar Osvaldo",
        "Rolon Santiago Ramon","Romero Ciccioli Daniel Matias Ezequiel","Romero Jorge Rafael","Romero Leandro Fabian",
        "Romero Sebastian Eduardo","Ruiz Belen De Los Angeles","Ruiz Eber Juan","Santana Ezequiel Matias",
        "Segura Diego Gabriel","Suano Javier Nestor","Torres Gustavo Adolfo","Troncoso Evelyn Beatriz",
        "Tudesco Jose Luis Alberto","Ubillos Agustin Sebastian","Ugartemendia Nahuel Cruz","Varela Francisco Antonio",
        "Vega Franco Eduardo","Velazquez Carlos Alberto","Velazquez Claudio Ernesto","Villa Alberto Matias",
        "Villafañe Carlos Maximiliano","Villagra Emanuel Francisco","Vizgarra Marcelo Enrique","Zakovicz Jorge Ruben",
        "Zuñiga Nery Agustin",
    ],
    supervisores: [
        "Fernando Delgado",
        "Juan Hrchan",
        "Horacio Quintas",
        "Rodolfo Girelli",
        "Ignacio Alvarez",
        "Rolando Zuñiga",
        "Andres Aguirre",
    ],
};

// ── Plan de supervisión por defecto ──────────────────────────────────────────
// Todos 1 visita/semana (≈4/mes). La Plata también 1/semana pero solo nocturnas.
// Las restricciones de turno se anotan en "restriccion"
const DEFAULT_PLAN = [
    { objetivo: "Brinks Pergamino",      visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Brinks Movil",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Brinks Beron Astrada",  visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Ovnisa Berazategui",    visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro",            visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Puesto 1",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Puesto 2",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Puesto 3",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Puesto 4",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Naty",              visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS CCTV Gral.",        visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS CCTV Fundicion",    visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Encargados",        visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Administrativa",    visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "PAS Supervisor",        visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
];
const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
    const [config,           setConfig]           = useState(() => load("cyrano_config",           DEFAULT_CONFIG));
    const [plan,             setPlan]             = useState(() => load("cyrano_plan",             DEFAULT_PLAN));
    const [planesSuper,      setPlanesSuper]      = useState(() => load("cyrano_planes_super",     {}));
    const [mantenimiento,    setMantenimiento]    = useState(() => load("cyrano_mantenimiento",    []));
    const [jornadas,         setJornadas]         = useState(() => load("cyrano_jornadas",         []));
    const [jornadaActiva,    setJornadaActiva]    = useState(() => load("cyrano_jornada_activa",   null));
    const [actividadActiva,  setActividadActiva]  = useState(() => load("cyrano_actividad_activa", null));
    const [dbReady,          setDbReady]          = useState(false);

    useEffect(() => { save("cyrano_config",           config);          }, [config]);
    useEffect(() => { save("cyrano_plan",             plan);            }, [plan]);
    useEffect(() => { save("cyrano_planes_super",     planesSuper);     }, [planesSuper]);
    useEffect(() => { save("cyrano_mantenimiento",    mantenimiento);   }, [mantenimiento]);
    useEffect(() => { save("cyrano_jornadas",         jornadas);        }, [jornadas]);
    useEffect(() => { save("cyrano_jornada_activa",   jornadaActiva);   }, [jornadaActiva]);
    useEffect(() => { save("cyrano_actividad_activa", actividadActiva); }, [actividadActiva]);

    const updateConfig    = (key, value) => setConfig((p) => ({ ...p, [key]: value }));
    const resetConfig     = ()           => { setConfig(DEFAULT_CONFIG); localStorage.removeItem("cyrano_config"); };
    const savePlan        = (p)          => setPlan(p);

    // ── Planes por supervisor ────────────────────────────────────────────────
    // planesSuper[email] = {
    //   nombre, turnoBase: "diurno"|"nocturno"|"mixto",
    //   objetivos: [{ objetivo, visitasPorSemana, turno, patron, semanasCustom }]
    // }

    // Clave: email si existe, sino nombre normalizado
    const planKey = (emailOrNombre) => emailOrNombre || "";
    const savePlanSupervisor = (emailOrNombre, datos) => {
        if (!emailOrNombre) return;
        setPlanesSuper((prev) => ({ ...prev, [emailOrNombre]: datos }));
    };
    const getPlanSupervisor = (emailOrNombre) => {
        if (!emailOrNombre) return null;
        if (planesSuper[emailOrNombre]) return planesSuper[emailOrNombre];
        // Buscar por nombre normalizado como fallback
        const norm = normNombre(emailOrNombre);
        const found = Object.entries(planesSuper).find(([k, v]) =>
            normNombre(k) === norm || normNombre(v.nombre || "") === norm
        );
        return found ? found[1] : null;
    };

    // Objetivos activos para una semana dada, con turno efectivo resuelto
    const getObjetivosSemana = (email, semana) => {
        const ps = getPlanSupervisor(email);
        if (!ps) return [];
        return (ps.objetivos || []).filter(o => {
            if (o.patron === "todas")   return true;
            if (o.patron === "impares") return semana === 1 || semana === 3;
            if (o.patron === "pares")   return semana === 2 || semana === 4;
            if (o.patron === "custom")  return (o.semanasCustom || []).includes(semana);
            return true;
        }).map(o => ({
            ...o,
            turnoEfectivo: (!o.turno || o.turno === "base")
                ? (ps.turnoBase || "mixto")
                : o.turno,
        }));
    };

    // Lista supervisores: los con plan registrado + los de config sin email
    // normNombre: "Fernando Hector Delgado" → "Fernando Delgado"
    const normNombre = (n) => { const p = (n || "").trim().split(/\s+/); return p.length >= 2 ? `${p[0]} ${p[p.length-1]}` : n; };
    const getSupervisoresConEmail = () => {
        // Supervisores con email y plan guardado — usar nombre de config si matchea
        const conEmail = Object.entries(planesSuper).map(([email, v]) => {
            const nombrePlan = v.nombre || email;
            // Buscar nombre en config que normalice igual
            const nombreConfig = (config.supervisores || []).find(n => normNombre(n) === normNombre(nombrePlan));
            return { email, nombre: nombreConfig || normNombre(nombrePlan), turnoBase: v.turnoBase || "mixto" };
        });
        // Supervisores sin email (solo en config, sin plan registrado)
        const emailsConPlan = new Set(conEmail.map(s => normNombre(s.nombre)));
        const sinEmail = (config.supervisores || [])
            .filter(n => !emailsConPlan.has(normNombre(n)))
            .map(n => ({ email: null, nombre: n, turnoBase: null }));
        return [...conEmail, ...sinEmail];
    };
    // ────────────────────────────────────────────────────────────────────────


    // ── Mantenimiento de vehículos ───────────────────────────────────────────
    const addMantenimiento = (evento) => {
        const nuevo = { ...evento, id: "M-" + Date.now().toString().slice(-8), creadoEn: new Date().toISOString() };
        setMantenimiento(prev => [nuevo, ...prev]);
        return nuevo;
    };

    const updateMantenimiento = (id, datos) =>
        setMantenimiento(prev => prev.map(m => m.id === id ? { ...m, ...datos } : m));

    const deleteMantenimiento = (id) =>
        setMantenimiento(prev => prev.filter(m => m.id !== id));

    // Alertas: próximos services en los próximos 30 días o vencidos
    const getAlertasMantenimiento = () => {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const en30 = new Date(hoy); en30.setDate(en30.getDate() + 30);
        return mantenimiento
            .filter(m => m.proximoService?.fecha)
            .map(m => {
                const fecha = new Date(m.proximoService.fecha);
                const diasRestantes = Math.round((fecha - hoy) / 86400000);
                return { ...m, diasRestantes };
            })
            .filter(m => m.diasRestantes <= 30)
            .sort((a, b) => a.diasRestantes - b.diasRestantes);
    };
    // ────────────────────────────────────────────────────────────────────────

    const iniciarJornada  = (datos) => {
        const j = { ...datos, estado: "activa", actividades: [], creadaEn: new Date().toISOString() };
        setJornadaActiva(j);
        return j;
    };

    const actualizarJornadaActiva = (datos) =>
        setJornadaActiva((p) => p ? { ...p, ...datos } : p);

    const iniciarActividad = (tipo, datosInicio) => {
        const a = { id: Date.now().toString(), tipo, estado: "en_curso", ...datosInicio, iniciadaEn: new Date().toISOString() };
        // Clasificar automáticamente si es control
        if (tipo === "ctrl") {
            const { turno, esFinDeSemana } = clasificarControl(datosInicio.horaInicio, new Date().toISOString());
            a.turno         = turno;
            a.esFinDeSemana = esFinDeSemana;
        }
        setActividadActiva(a);
        return a;
    };

    const finalizarActividad = (datosFin) => {
        if (!actividadActiva || !jornadaActiva) return;
        const completa = { ...actividadActiva, ...datosFin, estado: "completada", finalizadaEn: new Date().toISOString() };
        setJornadaActiva((p) => ({ ...p, actividades: [...(p.actividades || []), completa] }));
        setActividadActiva(null);
    };

    const cancelarActividad = () => setActividadActiva(null);

    const cerrarJornada = (datosCierre) => {
        if (!jornadaActiva) return;
        const cerrada = { ...jornadaActiva, ...datosCierre, estado: "cerrada", cerradaEn: new Date().toISOString() };
        setJornadas((p) => [cerrada, ...p]);
        setJornadaActiva(null);
        setActividadActiva(null);
        return cerrada;
    };

    // Borrar datos simulados — se ejecuta una vez al montar si hay datos viejos
    const limpiarSimulados = () => {
        const reales = jornadas.filter((j) =>
            !j.jornadaID?.startsWith("J0") &&
            !j.id?.startsWith("J0") &&
            !j.simulado
        );
        setJornadas(reales);
    };

    // Auto-limpiar simulados al primer montaje
    useEffect(() => {
        const cleaned = jornadas.filter((j) =>
            !j.jornadaID?.startsWith("J0") &&
            !j.id?.startsWith("J0") &&
            !j.simulado
        );
        if (cleaned.length !== jornadas.length) {
            setJornadas(cleaned);
        }
    }, []);

    // Migración v4: forzar listas correctas + restaurar objetivos de planes vacios
    useEffect(() => {
        const migrated = localStorage.getItem("cyrano_migrated_v4");
        if (!migrated) {
            localStorage.removeItem("cyrano_migrated_v2");
            localStorage.removeItem("cyrano_migrated_v3");
            // Actualizar config con listas correctas
            setConfig(prev => ({
                ...prev,
                vehiculos:      DEFAULT_CONFIG.vehiculos,
                objetivos:      DEFAULT_CONFIG.objetivos,
                vigiladores:    DEFAULT_CONFIG.vigiladores,
                supervisores:   DEFAULT_CONFIG.supervisores,
                tiposActividad: DEFAULT_CONFIG.tiposActividad,
            }));
            // Restaurar objetivos del DEFAULT_PLAN en planes que tienen objetivos vacíos
            setPlanesSuper(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(email => {
                    if (!updated[email].objetivos || updated[email].objetivos.length === 0) {
                        updated[email] = {
                            ...updated[email],
                            objetivos: DEFAULT_PLAN.map(p => ({
                                objetivo:       p.objetivo,
                                visitasPorSemana: p.visitasPorSemana || 1,
                                turno:          "base",
                                patron:         "todas",
                                semanasCustom:  [],
                            })),
                        };
                    }
                });
                return updated;
            });
            localStorage.setItem("cyrano_migrated_v4", "1");
        }
    }, []);

    // Limpia sesión activa al hacer logout (no borra historial)
    const resetSesion = () => {
        setJornadaActiva(null);
        setActividadActiva(null);
    };

    // Simula tiempo de carga de Firebase (en producción esto lo dispara onSnapshot)
    useEffect(() => {
        const t = setTimeout(() => setDbReady(true), 800);
        return () => clearTimeout(t);
    }, []);

    return (
        <AppDataContext.Provider value={{
            data: config, updateConfig, resetConfig, update: updateConfig, resetToDefaults: resetConfig,
            plan, savePlan,
            planesSuper, savePlanSupervisor, getPlanSupervisor, getObjetivosSemana, getSupervisoresConEmail,
            mantenimiento, addMantenimiento, updateMantenimiento, deleteMantenimiento, getAlertasMantenimiento,
            jornadas, jornadaActiva, actividadActiva,
            iniciarJornada, actualizarJornadaActiva,
            iniciarActividad, finalizarActividad, cancelarActividad, cerrarJornada,
            resetSesion,
            limpiarSimulados,
            dbReady,
        }}>
            {children}
        </AppDataContext.Provider>
    );
}

export function useAppData() {
    const ctx = useContext(AppDataContext);
    if (!ctx) throw new Error("useAppData debe usarse dentro de AppDataProvider");
    return ctx;
}
