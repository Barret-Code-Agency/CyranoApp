// src/context/AppDataContext.jsx
// TODOS los datos persisten en Firestore — sin localStorage
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
    doc, getDoc, setDoc, updateDoc, onSnapshot,
    collection, addDoc, getDocs, deleteDoc, query, where, orderBy,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Refs de documentos ────────────────────────────────────────────────────────
const REF_CONFIG       = doc(db, "empresa", "config");
const REF_PLAN         = doc(db, "empresa", "planGeneral");
const REF_PLANES_SUPER = doc(db, "empresa", "planesSuper");
const REF_MANT         = collection(db, "mantenimiento");
const REF_JORNADAS     = collection(db, "jornadas");

// ── Clasificación turno ───────────────────────────────────────────────────────
export const clasificarControl = (horaInicio, fechaISO) => {
    if (!horaInicio) return { turno: "diurno", esFinDeSemana: false };
    const [h, m]   = horaInicio.split(":").map(Number);
    const minutos  = h * 60 + (m || 0);
    const nocturno = minutos >= 18 * 60 || minutos < 6 * 60;
    let esFinDeSemana = false;
    if (fechaISO) {
        const d = new Date(fechaISO);
        esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
    }
    return { turno: nocturno ? "nocturno" : "diurno", esFinDeSemana };
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    supervisorEmail: "supervisor@empresa.com",
    vehiculos: [
        "Prisma — AC 349 CR","Prisma — AC 349 CZ","Prisma — AC 360 WC",
        "Corolla — OPR 557","Corolla — AC 349 CQ","Corolla — AC 349 CS",
        "Hilux — AF 373 JP","Hilux — AF 967 YA","Hilux — AF 295 SB","Hilux — AG 220 JI",
    ],
    objetivos: [
        "Reginald Lee — Ranelagh","Reginald Lee — Lobos","Reginald Lee — La Plata",
        "Reginald Lee — Mar del Plata","Ovnisa Berazategui","Brinks Pergamino",
        "Brinks Berón de Astrada","Brinks Móvil","Cerro Moro — General",
        "Cerro Moro — Puesto 1","Cerro Moro — Puesto 2","Cerro Moro — Puesto 3",
        "Cerro Moro — Puesto 4","Cerro Moro — CCTV General","Cerro Moro — CCTV Fundición",
        "Cerro Moro — Naty","Cerro Moro — Administrativas","Cerro Moro — Encargados",
        "Cerro Moro — Supervisor",
    ],
    tiposActividad: [
        "Reparaciones (taller)","Traslado de personal","Traslado de elementos",
        "Tareas administrativas",
        "Análisis de vulnerabilidades",
        "Análisis de riesgos",
        "Atención de reclamos",
        "Visita Gremial",
        "Almuerzo/Cena",
        "Otras actividades",
    ],
    vigiladores: [
        "PEDRAZA JUAN MANUEL","BECERRA HECTOR RAFAEL","CACERES JUAN JOSE",
        "CACERES ROCIO BELEN","CARPIO GLORIA VICTORIA","CASTELLANO SERGIO ARMANDO",
        "CEJAS MARIA PAULA","DIAS DANA LUCIA","FUNES GABRIELA EDITH",
        "GUTIERREZ MARCOS JOSE","HERRERA CARLOS ALEJANDRO","JULIO PAOLA GIMENA",
        "LEDESMA MATIAS EZEQUIEL","MARCIAL ERICA MARCELA","MARTINEZ SERGIO IVAN",
        "MERCADO ERICK LEONARDO","MONTIVERO EMANUEL ANTONIO","MORINIGO JOSE",
        "NIETO CLAUDIO MARTIN","PINTOS ALEXIS EMMANUEL","SEGURA DIEGO GABRIEL",
        "TORRES GUSTAVO ADOLFO","TRONCOSO EVELYN BEATRIZ","VARELA FRANCISCO ANTONIO",
        "VILLAGRA EMANUEL FRANCISCO","ZUÑIGA NERY AGUSTIN","MARTINEZ DAVID",
        "RODRIGUEZ PATRICIA ELIZABET","ARIAS MARCELO FABIAN","AGUIRRE ENRIQUE ANDRES",
        "COPA ANA PAULA","DIAZ JONATHAN JAVIER","OYARZO SANCHEZ MIGUEL ALEJANDRO",
        "ROMERO CICCIOLI DANIEL MATIAS EZEQUIEL","REYNOSO GUSTAVO ALEJANDRO",
        "NAVARRO MANUEL FRANCISCO","LUNA MORALES MAYRA LISET","BORDON SOLEDAD DEL VALLE",
        "CASAS CARLOS DAVID","ROMERO SEBASTIAN EDUARDO","QUIROGA DANA MICAELA YASMIN",
        "VEGA FRANCO EDUARDO","VILLAFAÑE CARLOS MAXIMILIANO","DUARTE TIAGO MARCELO EZEQUIEL",
        "AEDO CINTHIA ANAHI","AMAYA CRISTIAN ARMANDO","CHACOMA SERGIO RAUL",
        "CAMPUZANO WALTER DAVID","AGULLO RODRIGUEZ LUCIANO ADRIAN","NUÑEZ FRANCISCO DIEGO",
        "CENTENO PATRICIA BRENDA","UBILLOS AGUSTIN SEBASTIAN","AVILA ALEJANDRO MAURICIO",
        "RIVERO GIULIANA DANIELA","RIOS ADRIEL GUILLERMO OSCAR","CONSTANCIO DAMIAN NAHUEL",
        "PEREIRA CARMEN GABRIELA","HERRERA GONZALO EZEQUIEL","AGÜERO FARIAS MARIA ELIZABETH",
        "JARA ELIO MATIAS","MESSINA JESSICA ADRIANA","KUC PAULO EMANUEL",
        "GODOY FERNANDO MIGUEL","RIVAROLA LUCAS FERNANDO","DERAMO NICOLAS MARIO",
        "RACEDO JULIO DANTE","ROLON SANTIAGO RAMON","FERNANDEZ CECILIA",
        "VILLA ALBERTO MATIAS","CAMPOS MAXIMILIANO HERNAN","ROMERO JORGE RAFAEL",
        "CAMPERO JOSE DAMIAN","ALMIRON WALTER DARIO","QUINTAS HORACIO GABRIEL",
        "DOS SANTOS CLAUDIO HERNAN ANIBAL","GONZALEZ ROBERTO ANTONIO","LOPEZ HUGO GERARDO",
        "MORO CRISTIAN EDUARDO","RODRIGUEZ LUCIANO MATIAS","ROJAS OSCAR OSVALDO",
        "ACUÑA NAHUEL GONZALO","CUGLIARI HERNAN GABRIEL","GUIÑEZ DUARTE CESAR DANIEL",
        "BUSTO LUCAS ABRAHAM","CANELAS DAMIAN","COSCUETA GUSTAVO WALTER",
        "LOBOSCO CRISTIAN IVAN","ARNAUDO JUAN","LOPEZ MARIO VICENTE",
        "QUINTEROS WALTER OMAR","VELAZQUEZ CLAUDIO ERNESTO","ALMADA CRISTIAN DANIEL",
        "BELLO GUSTAVO NORBERTO","BENITEZ GUSTAVO","BOZZO ANTONIO",
        "CASTRO ANTONIO HORACIO","COMAN JULIO ISMAEL","DUARTE DIEGO MARTIN",
        "JUAREZ LUIS MANUEL","KLOSTER RAFAEL ALBERTO","LENCINA MARIO ANTONIO",
        "LIMENZA GELMA RODOLFO FEDERICO","LOPEZ SERGIO ALBERTO","MARIN MARIO JAVIER",
        "MATA RAUL ALBERTO","MEDINA JAVIER","ORTIZ DANIEL","QUINTANA VICTOR HUGO",
        "REVILLA RODRIGUEZ HUGO ALEXANDER","RIOS FRANCISCO DANIEL","ROMERO LEANDRO FABIAN",
        "SUANO JAVIER NESTOR","TUDESCO JOSE LUIS ALBERTO","VELAZQUEZ CARLOS ALBERTO",
        "ZAKOVICZ JORGE RUBEN","LOPEZ MARCELO DANIEL","CABALLERO ADRIAN MARCELO",
        "KARBOVNICZEK JOSE PEDRO","CALVENTE BLAS LEONARDO","CORREA DANIEL SEBASTIAN",
        "SANTANA EZEQUIEL MATIAS","NUÑEZ ALEJO ISMAEL","VIZGARRA MARCELO ENRIQUE",
        "GORDILLO GERARDO AGUSTIN","LAGORIO BRIAN","ACEVEDO FERNANDO MATIAS",
        "RODRIGUEZ LUIS ALBERTO","ESPINDOLA SERGIO WALTER","LOPEZ MANUEL ALEJANDRO",
        "FERNANDEZ ALEJANDRO DANIEL","FERNANDEZ LUIS MARTIN","PETRUCCI JOSE RUBEN",
        "RUIZ EBER JUAN","MOREL FABIAN CELESTINO","RUIZ BELEN DE LOS ANGELES",
        "ALBARENGA BRAIAN MARTIN","GONZALEZ CARLA JACQUELINE","BLANCO CLAUDIO LUJAN",
        "BLANCO CRISTIAN ABRAHAM","UGARTEMENDIA NAHUEL CRUZ","GARCIA MIGUEL ANGEL",
    ],
    supervisores: [
        "Fernando Hector Delgado","Juan Nazareno Hrchan","Horacio Gabriel Quintas",
        "Rodolfo Sebastian Girelli","Ignacio Alvarez","Rolando Alfonso Zuñiga",
        "Andres Enrique Aguirre",
    ],
};

const DEFAULT_PLAN = [
    { objetivo: "Reginald Lee — Ranelagh",       visitasPorSemana: 1 },
    { objetivo: "Reginald Lee — Lobos",           visitasPorSemana: 1 },
    { objetivo: "Reginald Lee — La Plata",        visitasPorSemana: 1 },
    { objetivo: "Reginald Lee — Mar del Plata",   visitasPorSemana: 1 },
    { objetivo: "Ovnisa Berazategui",             visitasPorSemana: 1 },
    { objetivo: "Brinks Pergamino",               visitasPorSemana: 1 },
    { objetivo: "Brinks Berón de Astrada",        visitasPorSemana: 1 },
    { objetivo: "Brinks Móvil",                   visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — General",           visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — Puesto 1",          visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — Puesto 2",          visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — Puesto 3",          visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — CCTV General",      visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — CCTV Fundición",    visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — Naty",              visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — Administrativas",   visitasPorSemana: 1 },
    { objetivo: "Cerro Moro — Encargados",        visitasPorSemana: 1 },
];

// ── Context ───────────────────────────────────────────────────────────────────
const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
    const [config,          setConfig]          = useState(DEFAULT_CONFIG);
    const [plan,            setPlan]            = useState(DEFAULT_PLAN);
    const [planesSuper,     setPlanesSuper]     = useState({});
    const [mantenimiento,   setMantenimiento]   = useState([]);
    const [jornadas,        setJornadas]        = useState([]);
    const [jornadaActiva,   setJornadaActiva]   = useState(null);
    const [actividadActiva, setActividadActiva] = useState(null);
    const [dbReady,         setDbReady]         = useState(false);

    // ── Carga inicial desde Firestore ─────────────────────────────────────────
    useEffect(() => {
        let unsubs = [];

        const init = async () => {
            try {
                // Config
                const cfgSnap = await getDoc(REF_CONFIG);
                if (cfgSnap.exists()) setConfig(cfgSnap.data());
                else await setDoc(REF_CONFIG, DEFAULT_CONFIG);

                // Plan general
                const planSnap = await getDoc(REF_PLAN);
                if (planSnap.exists()) setPlan(planSnap.data().items || DEFAULT_PLAN);
                else await setDoc(REF_PLAN, { items: DEFAULT_PLAN });

                // Planes supervisores — listener en tiempo real
                const unsubPS = onSnapshot(REF_PLANES_SUPER, (snap) => {
                    if (snap.exists()) setPlanesSuper(snap.data());
                }, (err) => console.error("Error escuchando planesSuper:", err));
                unsubs.push(unsubPS);

                // Jornada activa desde localStorage (sesión local)
                try {
                    const ja = localStorage.getItem("cyrano_jornada_activa");
                    const aa = localStorage.getItem("cyrano_actividad_activa");
                    if (ja) setJornadaActiva(JSON.parse(ja));
                    if (aa) setActividadActiva(JSON.parse(aa));
                } catch {}

                setDbReady(true);
            } catch (err) {
                console.error("Error cargando datos de Firestore:", err);
                setDbReady(true);
            }
        };

        init();

        // Listener en tiempo real para jornadas (últimos 60 días)
        const hace60 = new Date();
        hace60.setDate(hace60.getDate() - 60);
        const q = query(REF_JORNADAS, orderBy("creadaEn", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setJornadas(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
        }, (err) => console.error("Error escuchando jornadas:", err));
        unsubs.push(unsub);

        // Listener en tiempo real para mantenimiento
        const unsubMant = onSnapshot(REF_MANT, (snap) => {
            setMantenimiento(snap.docs
                .map(d => ({ firestoreId: d.id, ...d.data() }))
                .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
            );
        }, (err) => console.error("Error escuchando mantenimiento:", err));
        unsubs.push(unsubMant);

        return () => unsubs.forEach(u => u());
    }, []);

    // Persistir jornada activa localmente (sesión)
    useEffect(() => {
        try {
            if (jornadaActiva) localStorage.setItem("cyrano_jornada_activa", JSON.stringify(jornadaActiva));
            else localStorage.removeItem("cyrano_jornada_activa");
        } catch {}
    }, [jornadaActiva]);

    useEffect(() => {
        try {
            if (actividadActiva) localStorage.setItem("cyrano_actividad_activa", JSON.stringify(actividadActiva));
            else localStorage.removeItem("cyrano_actividad_activa");
        } catch {}
    }, [actividadActiva]);

    // ── Config ────────────────────────────────────────────────────────────────
    const updateConfig = async (key, value) => {
        const updated = { ...config, [key]: value };
        setConfig(updated);
        try { await setDoc(REF_CONFIG, updated); } catch (e) { console.error(e); }
    };

    const resetConfig = async () => {
        setConfig(DEFAULT_CONFIG);
        try { await setDoc(REF_CONFIG, DEFAULT_CONFIG); } catch (e) { console.error(e); }
    };

    // ── Plan general ──────────────────────────────────────────────────────────
    const savePlan = async (p) => {
        setPlan(p);
        try { await setDoc(REF_PLAN, { items: p, updatedAt: new Date().toISOString() }); }
        catch (e) { console.error(e); }
    };

    // ── Planes por supervisor ─────────────────────────────────────────────────
    const savePlanSupervisor = async (email, datos) => {
        const updated = { ...planesSuper, [email]: datos };
        setPlanesSuper(updated);
        try { await setDoc(REF_PLANES_SUPER, updated); }
        catch (e) { console.error(e); }
    };

    const getPlanSupervisor = useCallback((email) =>
        planesSuper[email] || null,
    [planesSuper]);

    const getObjetivosSemana = useCallback((email, semana) => {
        const ps = planesSuper[email];
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
    }, [planesSuper]);

    const getSupervisoresConEmail = useCallback(() => {
        const conEmail = Object.entries(planesSuper).map(([email, v]) => ({
            email, nombre: v.nombre || email, turnoBase: v.turnoBase || "mixto",
        }));
        const nombresConEmail = new Set(conEmail.map(s => s.nombre));
        const sinEmail = (config.supervisores || [])
            .filter(n => !nombresConEmail.has(n))
            .map(n => ({ email: null, nombre: n, turnoBase: null }));
        return [...conEmail, ...sinEmail];
    }, [planesSuper, config.supervisores]);

    // ── Mantenimiento ─────────────────────────────────────────────────────────
    const addMantenimiento = async (evento) => {
        try {
            const ref = await addDoc(REF_MANT, {
                ...evento,
                creadoEn: new Date().toISOString(),
            });
            return ref.id;
        } catch (e) { console.error(e); }
    };

    const updateMantenimiento = async (firestoreId, datos) => {
        try {
            await updateDoc(doc(db, "mantenimiento", firestoreId), datos);
        } catch (e) { console.error(e); }
    };

    const deleteMantenimiento = async (firestoreId) => {
        try {
            await deleteDoc(doc(db, "mantenimiento", firestoreId));
        } catch (e) { console.error(e); }
    };

    const getAlertasMantenimiento = useCallback(() => {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        return mantenimiento
            .filter(m => m.proximoService?.fecha)
            .map(m => {
                const fecha = new Date(m.proximoService.fecha);
                const diasRestantes = Math.round((fecha - hoy) / 86400000);
                return { ...m, diasRestantes };
            })
            .filter(m => m.diasRestantes <= 30)
            .sort((a, b) => a.diasRestantes - b.diasRestantes);
    }, [mantenimiento]);

    // ── Jornadas ──────────────────────────────────────────────────────────────
    const iniciarJornada = (datos) => {
        const j = { ...datos, estado: "activa", actividades: [], creadaEn: new Date().toISOString() };
        setJornadaActiva(j);
        return j;
    };

    const actualizarJornadaActiva = (datos) =>
        setJornadaActiva(p => p ? { ...p, ...datos } : p);

    const iniciarActividad = (tipo, datosInicio) => {
        const a = {
            id: Date.now().toString(), tipo, estado: "en_curso",
            ...datosInicio, iniciadaEn: new Date().toISOString(),
        };
        if (tipo === "ctrl") {
            const { turno, esFinDeSemana } = clasificarControl(datosInicio.horaInicio, new Date().toISOString());
            a.turno = turno; a.esFinDeSemana = esFinDeSemana;
        }
        setActividadActiva(a);
        return a;
    };

    const finalizarActividad = (datosFin) => {
        if (!actividadActiva || !jornadaActiva) return;
        const completa = {
            ...actividadActiva, ...datosFin,
            estado: "completada", finalizadaEn: new Date().toISOString(),
        };
        setJornadaActiva(p => ({ ...p, actividades: [...(p.actividades || []), completa] }));
        setActividadActiva(null);
    };

    const cancelarActividad = () => setActividadActiva(null);

    const cerrarJornada = async (datosCierre) => {
        if (!jornadaActiva) return;
        const cerrada = {
            ...jornadaActiva, ...datosCierre,
            estado: "cerrada", cerradaEn: new Date().toISOString(),
        };
        // Guardar en Firestore
        try {
            await addDoc(REF_JORNADAS, cerrada);
        } catch (e) { console.error("Error guardando jornada:", e); }
        setJornadaActiva(null);
        setActividadActiva(null);
        return cerrada;
    };

    const resetSesion = () => {
        setJornadaActiva(null);
        setActividadActiva(null);
    };

    const limpiarSimulados = () => {}; // ya no hay simulados

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
