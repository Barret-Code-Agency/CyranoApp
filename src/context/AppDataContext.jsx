// src/context/AppDataContext.jsx
// ── Migrado a Firestore ───────────────────────────────────────────────────────
// Jornadas, planesSuper, plan → Firestore (tiempo real, multi-device)
// Config, jornadaActiva, actividadActiva → localStorage (local, rápido)
import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
    collection, doc, setDoc, addDoc, getDoc,
    onSnapshot, query, where, writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";
import { otorgarTokens, tokensParaCapacitacion } from "../utils/tokenService";
import { EMPRESA_ID_FALLBACK, LS } from "../config/constants";

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
    supervisorEmail: "",
    vehiculos:       [],
    objetivos:       [],
    tiposActividad: [
        "Reparaciones (taller)","Traslado de personal","Traslado de elementos",
        "Tareas administrativas","Análisis de vulnerabilidades","Análisis de riesgos",
        "Atención de reclamos","Reunión con cliente","Visita Gremial","Almuerzo/Cena","Otras actividades",
    ],
    vigiladores:  [],
    supervisores: [],
};

const DEFAULT_PLAN = [];


const AppDataContext = createContext(null);

export function AppDataProvider({ children, uid }) {

    // ── Estado LOCAL (config + sesión activa — no necesita sync) ────────────
    const [config,          setConfig]          = useState(() => load(LS.CONFIG,    DEFAULT_CONFIG));
    const [jornadaActiva,   setJornadaActiva]   = useState(() => load(LS.JORNADA,  null));
    const [actividadActiva, setActividadActiva] = useState(() => load(LS.ACTIVIDAD, null));

    // ── Estado FIRESTORE (tiempo real, persiste en la nube) ──────────────────
    const [jornadas,      setJornadas]      = useState([]);
    const [planesSuper,   setPlanesSuper]   = useState({});
    const [plan,          setPlanState]     = useState(DEFAULT_PLAN);
    const [mantenimiento, setMantenimiento] = useState([]);
    const [dbReady,       setDbReady]       = useState(false);
    const [dbError,       setDbError]       = useState(null);

    // Datos vivos desde colecciones maestras (override config_global para esos campos)
    const [liveData, setLiveData] = useState({
        vehiculos:    null,
        objetivos:    null,
        objetivosRaw: null, // [{ label, zona }]
        vigiladores:  null,
        legajosRaw:   null, // [{ nombre, zona }]
        supervisores: null,
    });
    const [empresaLogos,   setEmpresaLogos]   = useState({ splash: null, panel: null });
    const [empresaNombre,  setEmpresaNombre]  = useState("");
    const [empresaModulos, setEmpresaModulos] = useState(null);
    const [empresaActiva,  setEmpresaActiva]  = useState(true);  // false = suscripción vencida/desactivada
    const [userZona,       setUserZona]       = useState(null); // null = sin restricción
    const [userRol,        setUserRol]        = useState(null); // null mientras carga

    // Ref para que las funciones de escritura accedan al empresaId actual sin stale closure
    const empresaIdRef = useRef(EMPRESA_ID_FALLBACK);

    // ── Persist local ────────────────────────────────────────────────────────
    useEffect(() => { save(LS.CONFIG,    config);         }, [config]);
    useEffect(() => { save(LS.JORNADA,  jornadaActiva);  }, [jornadaActiva]);
    useEffect(() => { save(LS.ACTIVIDAD, actividadActiva); }, [actividadActiva]);

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

            // Suscripción en tiempo real al doc del usuario para detectar cambios de empresaId
            let suscripcionIniciada = false;
            const unsubUser = onSnapshot(doc(db, "usuarios", firebaseUser.uid), (userSnap) => {
                const empresaId = userSnap.exists()
                    ? (userSnap.data().empresaId ?? EMPRESA_ID_FALLBACK)
                    : EMPRESA_ID_FALLBACK;
                const zona = userSnap.exists() ? (userSnap.data().zona || null) : null;
                const rol  = userSnap.exists() ? (userSnap.data().rol  || null) : null;
                setUserZona(zona);
                setUserRol(rol);

                // Si empresaId cambió (ej: migración externa), forzar recarga de suscripciones
                if (suscripcionIniciada && empresaIdRef.current !== empresaId) {
                    empresaIdRef.current = empresaId;
                    // Recargar la página para reiniciar suscripciones con el nuevo empresaId
                    window.location.reload();
                    return;
                }

                empresaIdRef.current = empresaId;
                suscripcionIniciada = true;

        // Reset live data on empresa change
        setLiveData({ vehiculos: null, objetivos: null, objetivosRaw: null, vigiladores: null, legajosRaw: null, supervisores: null });

        const unsubs = [];
        let ready = 0;
        const markReady = () => { ready++; if (ready >= 3) setDbReady(true); };

        // 0. Empresa — logos, nombre y módulos habilitados
        const LOGO_DEFAULTS = {
            splash: "/images/png-transparent-logo.png",
            panel:  "/images/png-transparent-logo.png",
        };
        try {
            unsubs.push(onSnapshot(
                doc(db, "empresas", empresaId),
                (snap) => {
                    const d = snap.exists() ? snap.data() : {};
                    setEmpresaLogos({
                        splash: d.logoSplash ?? LOGO_DEFAULTS.splash,
                        panel:  d.logoPanel  ?? LOGO_DEFAULTS.panel,
                    });
                    if (d.nombre)  setEmpresaNombre(d.nombre);
                    setEmpresaModulos(d.modulos ?? null);
                    // Control de suscripción
                    const vencida = d.vencimiento
                        ? d.vencimiento.toDate?.() < new Date()
                        : false;
                    setEmpresaActiva(d.activo !== false && !vencida);
                }
            ));
        } catch {
            setEmpresaLogos(LOGO_DEFAULTS);
        }

        // 1. Jornadas — colección principal
        try {
            const q = query(
                collection(db, "jornadas"),
                where("empresaId", "==", empresaId)
            );
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
                doc(db, "empresas", empresaId, "datos", "planes_super"),
                (snap) => {
                    if (snap.exists()) {
                        setPlanesSuper(snap.data().planes || {});
                    } else {
                        const local = load("cyrano_planes_super", {});
                        setPlanesSuper(local);
                        if (Object.keys(local).length > 0) {
                            setDoc(
                                doc(db, "empresas", empresaId, "datos", "planes_super"),
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
                doc(db, "empresas", empresaId, "datos", "plan_global"),
                (snap) => {
                    if (snap.exists()) {
                        setPlanState(snap.data().objetivos || DEFAULT_PLAN);
                    } else {
                        const local = load("cyrano_plan", DEFAULT_PLAN);
                        setPlanState(local);
                        setDoc(
                            doc(db, "empresas", empresaId, "datos", "plan_global"),
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

        // 4. Config global (tiposActividad, distritos, etc.)
        try {
            unsubs.push(onSnapshot(
                doc(db, "empresas", empresaId, "datos", "config_global"),
                (snap) => {
                    if (snap.exists() && snap.data().config) {
                        setConfig(prev => ({ ...DEFAULT_CONFIG, ...snap.data().config }));
                    }
                },
                (err) => { console.warn("[Firestore] config_global:", err.code); }
            ));
        } catch (e) { /* usa DEFAULT_CONFIG */ }

        // 5. Vehículos desde colección maestra (tiempo real)
        try {
            unsubs.push(onSnapshot(
                query(collection(db, "vehiculos"), where("empresaId", "==", empresaId)),
                (snap) => {
                    const list = snap.docs
                        .map(d => d.data().patente)
                        .filter(Boolean)
                        .sort();
                    setLiveData(p => ({ ...p, vehiculos: list }));
                },
                (err) => { console.warn("[AppData] vehiculos:", err.code); }
            ));
        } catch {}

        // 6. Objetivos desde colección maestra (tiempo real)
        try {
            unsubs.push(onSnapshot(
                query(collection(db, "objetivos"), where("empresaId", "==", empresaId)),
                (snap) => {
                    const rawObs = snap.docs
                        .map(d => {
                            const o = d.data();
                            const codigo = [o.cCosto, o.numProyecto, o.numObjetivo].filter(Boolean).join("-");
                            const label  = [codigo, o.nombreProyecto, o.nombre].filter(Boolean).join(" ");
                            return label ? { label, zona: o.zona || null, cliente: o.nombreProyecto || "" } : null;
                        })
                        .filter(Boolean)
                        .sort((a, b) => a.label.localeCompare(b.label));
                    const obs = rawObs.map(o => o.label);
                    setLiveData(p => ({ ...p, objetivos: obs, objetivosRaw: rawObs }));
                },
                (err) => { console.warn("[AppData] objetivos:", err.code); }
            ));
        } catch {}

        // 7. Legajos → vigiladores y supervisores (tiempo real)
        try {
            unsubs.push(onSnapshot(
                query(collection(db, "legajos"), where("empresaId", "==", empresaId)),
                (snap) => {
                    const docs = snap.docs.map(d => d.data());
                    const nombre = (d) =>
                        `${d.apellido || ""} ${d.nombre || ""}`.trim() ||
                        `${d.nombre || ""} ${d.apellido || ""}`.trim();
                    const esSuper = (d) => d.esSupervisor === true || /supervis/i.test(d.rol || d.cargo || "");
                    // Raw con zona para filtrado posterior
                    const legajosRaw = docs
                        .filter(d => !esSuper(d))
                        .map(d => ({ nombre: nombre(d), zona: d.zona || null }))
                        .filter(d => d.nombre);
                    const vig = legajosRaw.map(d => d.nombre).sort();
                    const sup = docs
                        .filter(esSuper)
                        .map(nombre)
                        .filter(Boolean)
                        .sort();
                    setLiveData(p => ({ ...p, vigiladores: vig, legajosRaw, supervisores: sup }));
                },
                (err) => { console.warn("[AppData] legajos:", err.code); }
            ));
        } catch {}

            unsubs.forEach(u => u && unsubFirestore.push(u));
            }, (err) => {
                console.error("[AppData] onSnapshot usuario:", err);
                setDbReady(true);
            });
            unsubFirestore.push(unsubUser);
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
            if (dbReady) {
                setDoc(
                    doc(db, "empresas", empresaIdRef.current, "datos", "config_global"),
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
                doc(db, "empresas", empresaIdRef.current, "datos", "plan_global"),
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
                doc(db, "empresas", empresaIdRef.current, "datos", "planes_super"),
                { planes: nuevos, updatedAt: new Date().toISOString() }
            );
        } catch (err) {
            console.error("savePlanSupervisor:", err);
            save("cyrano_planes_super", nuevos);
        }
    };

    const getPlanSupervisor = (emailOrNombre) => {
        if (!emailOrNombre) return null;

        // 1. Exacto por clave
        if (planesSuper[emailOrNombre]) return planesSuper[emailOrNombre];

        const src = emailOrNombre.trim().toLowerCase();

        // 2. Case-insensitive: clave o v.nombre igual al buscado
        let found = Object.entries(planesSuper).find(([k, v]) =>
            k.trim().toLowerCase() === src ||
            (v.nombre || "").trim().toLowerCase() === src
        );
        if (found) return found[1];

        // 3. Primer+último token (normalizado, case-insensitive)
        const tokens = src.split(/\s+/);
        const normSrc = tokens.length >= 2 ? `${tokens[0]} ${tokens[tokens.length - 1]}` : src;
        found = Object.entries(planesSuper).find(([k, v]) => {
            const kT = k.trim().toLowerCase().split(/\s+/);
            const vT = (v.nombre || "").trim().toLowerCase().split(/\s+/);
            const normK = kT.length >= 2 ? `${kT[0]} ${kT[kT.length - 1]}` : kT[0] || "";
            const normV = vT.length >= 2 ? `${vT[0]} ${vT[vT.length - 1]}` : vT[0] || "";
            return normK === normSrc || normV === normSrc;
        });
        if (found) return found[1];

        // 4. Apellido solo (último token ≥ 3 chars, sin @)
        const apellido = tokens[tokens.length - 1] || "";
        if (apellido.length >= 3 && !apellido.includes("@")) {
            found = Object.entries(planesSuper).find(([k, v]) => {
                const kAp = (k.trim().toLowerCase().split(/\s+/).pop() || "");
                const vAp = ((v.nombre || "").trim().toLowerCase().split(/\s+/).pop() || "");
                return kAp === apellido || vAp === apellido;
            });
            if (found) return found[1];
        }

        // 5. Email-prefix: parte antes del @ (cubre "girelli@" vs clave "girelli")
        if (src.includes("@")) {
            const prefix = src.split("@")[0];
            if (prefix.length >= 3) {
                found = Object.entries(planesSuper).find(([k, v]) => {
                    const kL = k.trim().toLowerCase();
                    const vL = (v.nombre || "").trim().toLowerCase();
                    return kL === prefix || vL === prefix ||
                           kL.startsWith(prefix) || prefix.startsWith(kL);
                });
                if (found) return found[1];
            }
        }

        // 6. Token compartido: algún token ≥4 chars del buscado aparece en la clave o viceversa
        const srcTokens = src.split(/[\s.@_-]+/).filter(t => t.length >= 4 && !/^\d+$/.test(t));
        if (srcTokens.length > 0) {
            found = Object.entries(planesSuper).find(([k, v]) => {
                const kToks = k.toLowerCase().split(/[\s.@_-]+/);
                const vToks = (v.nombre || "").toLowerCase().split(/[\s.@_-]+/);
                return srcTokens.some(t => kToks.includes(t) || vToks.includes(t));
            });
            if (found) return found[1];
        }

        return null;
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
        // Usa liveData (legajos con esSupervisor=true) si disponible, sino config_global
        const listaSuper = liveData.supervisores ?? config.supervisores ?? [];
        const conEmail = Object.entries(planesSuper).map(([email, v]) => {
            const nombrePlan   = v.nombre || email;
            const nombreConfig = listaSuper.find(n => normNombre(n) === normNombre(nombrePlan));
            return { email, nombre: nombreConfig || normNombre(nombrePlan), turnoBase: v.turnoBase || "mixto" };
        });
        const emailsConPlan = new Set(conEmail.map(s => normNombre(s.nombre)));
        const sinEmail = listaSuper
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
        const j = { ...datos, estado: "activa", actividades: [], creadaEn: new Date().toISOString(), empresaId: empresaIdRef.current };
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
        // Otorgar tokens por capacitación completada
        if (actividadActiva.tipo === "cap" && uid && empresaIdRef.current) {
            const cantidad = tokensParaCapacitacion(actividadActiva.horaInicio, datosFin.horaFin);
            otorgarTokens(uid, empresaIdRef.current, cantidad, "Capacitación completada").catch(console.error);
        }
    };

    const cancelarActividad = () => setActividadActiva(null);

    const cerrarJornada = async (datosCierre) => {
        if (!jornadaActiva) return;
        const cerrada = {
            ...jornadaActiva, ...datosCierre,
            estado: "cerrada", cerradaEn: new Date().toISOString(), empresaId: empresaIdRef.current,
        };
        try {
            const ref = await addDoc(collection(db, "jornadas"), cerrada);
            cerrada._id = ref.id;
        } catch (err) {
            console.error("[Firestore] cerrarJornada:", err);
            // Fallback: guardar local y encolar para subir después
            const locales = load(LS.PENDIENTES, []);
            save(LS.PENDIENTES, [cerrada, ...locales]);
            setJornadas(p => [cerrada, ...p]);
        }
        setJornadaActiva(null);
        setActividadActiva(null);
        return cerrada;
    };

    // Subir jornadas pendientes cuando vuelve la conexión
    useEffect(() => {
        if (!dbReady) return;
        const pendientes = load(LS.PENDIENTES, []);
        if (!pendientes.length) return;
        (async () => {
            try {
                for (const j of pendientes) {
                    await addDoc(collection(db, "jornadas"), { ...j, empresaId: empresaIdRef.current });
                }
                save(LS.PENDIENTES, []);
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

    // Mezcla: las colecciones maestras tienen prioridad sobre config_global para esos campos
    // Filtro por zona: si el usuario tiene zona asignada Y NO es admin, solo ve items de su zona (o sin zona)
    const esAdminRol = userRol === "admin_contrato" || userRol === "super_admin";
    const zonaFiltrar = (items, rawItems) => {
        if (!userZona || !rawItems || esAdminRol) return items;
        return rawItems.filter(i => !i.zona || i.zona === userZona).map(i => i.label ?? i.nombre);
    };
    // Mapa label → cliente (nombreProyecto) para auto-rellenar en auditorías
    const clienteDeObjetivo = {};
    if (liveData.objetivosRaw) {
        liveData.objetivosRaw.forEach(o => { if (o.label && o.cliente) clienteDeObjetivo[o.label] = o.cliente; });
    }
    const mergedData = {
        ...config,
        vehiculos:         liveData.vehiculos   ?? config.vehiculos,
        objetivos:         zonaFiltrar(liveData.objetivos, liveData.objetivosRaw) ?? liveData.objetivos ?? config.objetivos,
        vigiladores:       zonaFiltrar(liveData.vigiladores, liveData.legajosRaw) ?? liveData.vigiladores ?? config.vigiladores,
        supervisores:      liveData.supervisores ?? config.supervisores,
        clienteDeObjetivo,
    };

    return (
        <AppDataContext.Provider value={{
            data: mergedData, updateConfig, resetConfig, update: updateConfig, resetToDefaults: resetConfig,
            plan, savePlan,
            planesSuper, savePlanSupervisor, getPlanSupervisor, getObjetivosSemana, getSupervisoresConEmail,
            mantenimiento, addMantenimiento, updateMantenimiento, deleteMantenimiento, getAlertasMantenimiento,
            jornadas, jornadaActiva, actividadActiva,
            iniciarJornada, actualizarJornadaActiva,
            iniciarActividad, finalizarActividad, cancelarActividad, cerrarJornada,
            resetSesion, limpiarSimulados,
            dbReady, dbError,
            empresaId: empresaIdRef.current,
            empresaLogos,
            empresaNombre,
            empresaModulos,
            empresaActiva,
            userZona,
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
