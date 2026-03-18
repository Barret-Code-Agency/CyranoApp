// src/context/AppDataContext.jsx
// ── Migrado a Firestore ───────────────────────────────────────────────────────
// Jornadas, planesSuper, plan → Firestore (tiempo real, multi-device)
// Config, jornadaActiva, actividadActiva → localStorage (local, rápido)
import { createContext, useContext, useState, useEffect } from "react";
import {
    collection, doc, setDoc, addDoc,
    onSnapshot, query, where, writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";

// ── localStorage helpers (solo para config y sesión activa) ──────────────────
const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ── Clasificación automática de control ──────────────────────────────────────
export const clasificarControl = (horaInicio, fechaISO) => {
    if (!horaInicio) return { turno: "diurno", esFinDeSemana: false };
    const [h, m]   = horaInicio.split(":").map(Number);
    const minutos  = h * 60 + (m || 0);
    const nocturno = minutos >= 18 * 60 || minutos < 6 * 60;
    let esFinDeSemana = false;
    if (fechaISO) { const d = new Date(fechaISO); esFinDeSemana = d.getDay() === 0 || d.getDay() === 6; }
    return { turno: nocturno ? "nocturno" : "diurno", esFinDeSemana };
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    supervisorEmail: "supervisor@empresa.com",
    vehiculos: [
        "Prisma AC 349 CR","Prisma AC 349 CZ","Prisma AC 360 WC",
        "Corolla OPR 557","Corolla AC 349 CQ","Corolla AC 349 CS",
        "Hilux AF 373 JP","Hilux AF 967 YA","Hilux AF 295 SB","Hilux AG 220 JI",
    ],
    objetivos: [
        "Reginald Lee Ranelagh","Reginald Lee Lobos","Reginald Lee La Plata",
        "Reginald Lee Mar del Plata","Reginald Lee Ranelagh Puesto 1",
        "Reginald Lee Ranelagh Puesto 2","Reginald Lee Ranelagh Puesto 4",
        "Reginald Lee Ranelagh Puesto 7","Reginald Lee Ranelagh Puesto 8",
        "Reginald Lee Ranelagh Encargado","Brinks Pergamino","Brinks Movil",
        "Brinks Beron Astrada","Ovnisa Berazategui","Cerro Moro",
        "PAS Puesto 1","PAS Puesto 2","PAS Puesto 3","PAS Puesto 4",
        "PAS Naty","PAS CCTV Gral.","PAS CCTV Fundicion",
        "PAS Encargados","PAS Administrativa","PAS Supervisor",
    ],
    tiposActividad: [
        "Reparaciones (taller)","Traslado de personal","Traslado de elementos",
        "Tareas administrativas","Análisis de vulnerabilidades","Análisis de riesgos",
        "Atención de reclamos","Visita Gremial","Almuerzo/Cena","Otras actividades",
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
        "Fernando Delgado","Juan Hrchan","Horacio Quintas",
        "Rodolfo Girelli","Ignacio Alvarez","Rolando Zuñiga","Andres Aguirre",
    ],
};

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

// ── ID de empresa (hardcoded — multi-tenant en versión SaaS) ─────────────────
const EMPRESA_ID = "brinks_ar";

const AppDataContext = createContext(null);

export function AppDataProvider({ children, uid }) {

    // ── Estado LOCAL (config + sesión activa — no necesita sync) ────────────
    const [config,          setConfig]          = useState(() => load("cyrano_config", DEFAULT_CONFIG));
    const [jornadaActiva,   setJornadaActiva]   = useState(() => load("cyrano_jornada_activa", null));
    const [actividadActiva, setActividadActiva] = useState(() => load("cyrano_actividad_activa", null));

    // ── Estado FIRESTORE (tiempo real, persiste en la nube) ──────────────────
    const [jornadas,      setJornadas]      = useState([]);
    const [planesSuper,   setPlanesSuper]   = useState({});
    const [plan,          setPlanState]     = useState(DEFAULT_PLAN);
    const [mantenimiento, setMantenimiento] = useState([]);
    const [dbReady,       setDbReady]       = useState(false);
    const [dbError,       setDbError]       = useState(null);
    const [empresaLogos,  setEmpresaLogos]  = useState({ splash: null, panel: null });
    const [empresaNombre, setEmpresaNombre] = useState("Brinks");

    // ── Persist local ────────────────────────────────────────────────────────
    useEffect(() => { save("cyrano_config",           config);          }, [config]);
    useEffect(() => { save("cyrano_jornada_activa",   jornadaActiva);   }, [jornadaActiva]);
    useEffect(() => { save("cyrano_actividad_activa", actividadActiva); }, [actividadActiva]);

    // ── Suscripciones Firestore — arrancan cuando Firebase confirma sesión ────
    useEffect(() => {
        let unsubFirestore = [];
        const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
            // Limpiar suscripciones anteriores
            unsubFirestore.forEach(u => u && u());
            unsubFirestore = [];

            if (!firebaseUser) {
                // No sobreescribir — mantener datos en memoria hasta nuevo login
                setDbReady(true);
                return;
            }
            // Usuario autenticado — abrir suscripciones
            (() => {
        const unsubs = [];
        let ready = 0;
        const markReady = () => { ready++; if (ready >= 3) setDbReady(true); };

        // 0. Logos de empresa (doc raíz) — fallback a imágenes estáticas si no hay en Firestore
        const LOGO_DEFAULTS = {
            splash: "/images/png-transparent-logo.png",
            panel:  "/images/png-transparent-logo.png",
        };
        try {
            unsubs.push(onSnapshot(
                doc(db, "empresas", EMPRESA_ID),
                (snap) => {
                    const d = snap.exists() ? snap.data() : {};
                    setEmpresaLogos({
                        splash: d.logoSplash ?? LOGO_DEFAULTS.splash,
                        panel:  d.logoPanel  ?? LOGO_DEFAULTS.panel,
                    });
                    if (d.nombre) setEmpresaNombre(d.nombre);
                }
            ));
        } catch {
            setEmpresaLogos(LOGO_DEFAULTS);
        }

        // 1. Jornadas — colección principal
        try {
            const q = query(
                collection(db, "jornadas"),
                where("empresaId", "==", EMPRESA_ID)
            ); // sin orderBy para no requerir índice compuesto — se ordena en JS
            unsubs.push(onSnapshot(q,
                (snap) => {
                    setJornadas(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
                    markReady();
                },
                (err) => {
                    console.error("[Firestore] jornadas:", err.code, err.message);
                    setDbError(err.code);
                    setJornadas(load("cyrano_jornadas", []));
                    markReady();
                }
            ));
        } catch (e) { setJornadas(load("cyrano_jornadas", [])); markReady(); }

        // 2. Planes de supervisores — doc único por empresa
        try {
            unsubs.push(onSnapshot(
                doc(db, "empresas", EMPRESA_ID, "datos", "planes_super"),
                (snap) => {
                    if (snap.exists()) {
                        setPlanesSuper(snap.data().planes || {});
                    } else {
                        // Primera vez: migrar desde localStorage
                        const local = load("cyrano_planes_super", {});
                        setPlanesSuper(local);
                        if (Object.keys(local).length > 0) {
                            setDoc(
                                doc(db, "empresas", EMPRESA_ID, "datos", "planes_super"),
                                { planes: local, updatedAt: new Date().toISOString() }
                            ).catch(console.error);
                        }
                    }
                    markReady();
                },
                (err) => {
                    console.error("[Firestore] planes_super:", err.code);
                    setPlanesSuper(load("cyrano_planes_super", {}));
                    markReady();
                }
            ));
        } catch (e) { setPlanesSuper(load("cyrano_planes_super", {})); markReady(); }

        // 3. Plan global
        try {
            unsubs.push(onSnapshot(
                doc(db, "empresas", EMPRESA_ID, "datos", "plan_global"),
                (snap) => {
                    if (snap.exists()) {
                        setPlanState(snap.data().objetivos || DEFAULT_PLAN);
                    } else {
                        const local = load("cyrano_plan", DEFAULT_PLAN);
                        setPlanState(local);
                        setDoc(
                            doc(db, "empresas", EMPRESA_ID, "datos", "plan_global"),
                            { objetivos: local, updatedAt: new Date().toISOString() }
                        ).catch(console.error);
                    }
                    markReady();
                },
                (err) => {
                    console.error("[Firestore] plan_global:", err.code);
                    setPlanState(load("cyrano_plan", DEFAULT_PLAN));
                    markReady();
                }
            ));
        } catch (e) { setPlanState(load("cyrano_plan", DEFAULT_PLAN)); markReady(); }

        // 4. Config global (objetivos, vehículos, vigiladores, etc.)
        try {
            unsubs.push(onSnapshot(
                doc(db, "empresas", EMPRESA_ID, "datos", "config_global"),
                (snap) => {
                    if (snap.exists() && snap.data().config) {
                        setConfig(prev => ({ ...DEFAULT_CONFIG, ...snap.data().config }));
                    }
                },
                (err) => { console.warn("[Firestore] config_global:", err.code); }
            ));
        } catch (e) { /* usa DEFAULT_CONFIG */ }

            unsubs.forEach(u => u && unsubFirestore.push(u));
            })();
        });

        return () => {
            unsubAuth();
            unsubFirestore.forEach(u => u && u());
        };
    }, []);

    // ── Config ────────────────────────────────────────────────────────────────
    const updateConfig = (key, value) => {
        setConfig((p) => {
            const next = { ...p, [key]: value };
            // Persistir en Firestore para que todos los dispositivos lo vean
            if (dbReady) {
                setDoc(
                    doc(db, "empresas", EMPRESA_ID, "datos", "config_global"),
                    { config: next, updatedAt: new Date().toISOString() }
                ).catch(err => console.error("updateConfig Firestore:", err));
            }
            return next;
        });
    };
    const resetConfig  = () => setConfig(DEFAULT_CONFIG);

    // ── Plan global ───────────────────────────────────────────────────────────
    const savePlan = async (nuevoPlan) => {
        setPlanState(nuevoPlan);
        try {
            await setDoc(
                doc(db, "empresas", EMPRESA_ID, "datos", "plan_global"),
                { objetivos: nuevoPlan, updatedAt: new Date().toISOString() }
            );
        } catch (err) {
            console.error("savePlan:", err);
            save("cyrano_plan", nuevoPlan);
        }
    };

    // ── Planes supervisores ───────────────────────────────────────────────────
    const normNombre = (n) => {
        const p = (n || "").trim().split(/\s+/);
        return p.length >= 2 ? `${p[0]} ${p[p.length - 1]}` : n;
    };

    const savePlanSupervisor = async (emailOrNombre, datos) => {
        if (!emailOrNombre) return;
        const nuevos = { ...planesSuper, [emailOrNombre]: datos };
        setPlanesSuper(nuevos);
        try {
            await setDoc(
                doc(db, "empresas", EMPRESA_ID, "datos", "planes_super"),
                { planes: nuevos, updatedAt: new Date().toISOString() }
            );
        } catch (err) {
            console.error("savePlanSupervisor:", err);
            save("cyrano_planes_super", nuevos);
        }
    };

    const getPlanSupervisor = (emailOrNombre) => {
        if (!emailOrNombre) return null;
        if (planesSuper[emailOrNombre]) return planesSuper[emailOrNombre];
        const norm = normNombre(emailOrNombre);
        const found = Object.entries(planesSuper).find(([k, v]) =>
            normNombre(k) === norm || normNombre(v.nombre || "") === norm
        );
        return found ? found[1] : null;
    };

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
            turnoEfectivo: (!o.turno || o.turno === "base") ? (ps.turnoBase || "mixto") : o.turno,
        }));
    };

    const getSupervisoresConEmail = () => {
        const conEmail = Object.entries(planesSuper).map(([email, v]) => {
            const nombrePlan   = v.nombre || email;
            const nombreConfig = (config.supervisores || []).find(n => normNombre(n) === normNombre(nombrePlan));
            return { email, nombre: nombreConfig || normNombre(nombrePlan), turnoBase: v.turnoBase || "mixto" };
        });
        const emailsConPlan = new Set(conEmail.map(s => normNombre(s.nombre)));
        const sinEmail = (config.supervisores || [])
            .filter(n => !emailsConPlan.has(normNombre(n)))
            .map(n => ({ email: null, nombre: n, turnoBase: null }));
        return [...conEmail, ...sinEmail];
    };

    // ── Mantenimiento ─────────────────────────────────────────────────────────
    const addMantenimiento    = (e) => { const n = { ...e, id: "M-" + Date.now().toString().slice(-8), creadoEn: new Date().toISOString() }; setMantenimiento(p => [n, ...p]); return n; };
    const updateMantenimiento = (id, d) => setMantenimiento(p => p.map(m => m.id === id ? { ...m, ...d } : m));
    const deleteMantenimiento = (id)    => setMantenimiento(p => p.filter(m => m.id !== id));
    const getAlertasMantenimiento = () => {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        return mantenimiento
            .filter(m => m.proximoService?.fecha)
            .map(m => ({ ...m, diasRestantes: Math.round((new Date(m.proximoService.fecha) - hoy) / 86400000) }))
            .filter(m => m.diasRestantes <= 30)
            .sort((a, b) => a.diasRestantes - b.diasRestantes);
    };

    // ── Jornadas ──────────────────────────────────────────────────────────────
    const iniciarJornada = (datos) => {
        const j = { ...datos, estado: "activa", actividades: [], creadaEn: new Date().toISOString(), empresaId: EMPRESA_ID };
        setJornadaActiva(j);
        return j;
    };

    const actualizarJornadaActiva = (datos) =>
        setJornadaActiva((p) => p ? { ...p, ...datos } : p);

    const iniciarActividad = (tipo, datosInicio) => {
        const a = { id: Date.now().toString(), tipo, estado: "en_curso", ...datosInicio, iniciadaEn: new Date().toISOString() };
        if (tipo === "ctrl") {
            const { turno, esFinDeSemana } = clasificarControl(datosInicio.horaInicio, new Date().toISOString());
            a.turno = turno; a.esFinDeSemana = esFinDeSemana;
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

    const cerrarJornada = async (datosCierre) => {
        if (!jornadaActiva) return;
        const cerrada = {
            ...jornadaActiva, ...datosCierre,
            estado: "cerrada", cerradaEn: new Date().toISOString(), empresaId: EMPRESA_ID,
        };
        try {
            const ref = await addDoc(collection(db, "jornadas"), cerrada);
            cerrada._id = ref.id;
        } catch (err) {
            console.error("[Firestore] cerrarJornada:", err);
            // Fallback: guardar local y encolar para subir después
            const locales = load("cyrano_jornadas_pendientes", []);
            save("cyrano_jornadas_pendientes", [cerrada, ...locales]);
            setJornadas(p => [cerrada, ...p]);
        }
        setJornadaActiva(null);
        setActividadActiva(null);
        return cerrada;
    };

    // Subir jornadas pendientes cuando vuelve la conexión
    useEffect(() => {
        if (!dbReady) return;
        const pendientes = load("cyrano_jornadas_pendientes", []);
        if (!pendientes.length) return;
        (async () => {
            try {
                for (const j of pendientes) {
                    await addDoc(collection(db, "jornadas"), { ...j, empresaId: EMPRESA_ID });
                }
                save("cyrano_jornadas_pendientes", []);
                console.log("[Sync] Jornadas pendientes subidas:", pendientes.length);
            } catch (err) {
                console.warn("[Sync] No se pudieron subir pendientes:", err);
            }
        })();
    }, [dbReady]);

    const limpiarSimulados = () =>
        setJornadas(p => p.filter(j => !j.jornadaID?.startsWith("J0") && !j.simulado));

    const resetSesion = () => {
        setJornadaActiva(null);
        setActividadActiva(null);
    };

    return (
        <AppDataContext.Provider value={{
            data: config, updateConfig, resetConfig, update: updateConfig, resetToDefaults: resetConfig,
            plan, savePlan,
            planesSuper, savePlanSupervisor, getPlanSupervisor, getObjetivosSemana, getSupervisoresConEmail,
            mantenimiento, addMantenimiento, updateMantenimiento, deleteMantenimiento, getAlertasMantenimiento,
            jornadas, jornadaActiva, actividadActiva,
            iniciarJornada, actualizarJornadaActiva,
            iniciarActividad, finalizarActividad, cancelarActividad, cerrarJornada,
            resetSesion, limpiarSimulados,
            dbReady, dbError,
            empresaId: EMPRESA_ID,
            empresaLogos,
            empresaNombre,
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
