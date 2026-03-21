// src/screens/Diagramas14x14Screen.jsx
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import { seedDiagramas14x14, seedAsignarGrupos } from "../../utils/seedFirestoreDiagramas";
import { PERSONAS_POR_GRUPO } from "../../data/seedDiagramas14x14";
import "./Diagramas14x14Screen.css";

function normNombre(s) {
    return String(s || "").toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ").trim();
}

const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_ES  = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];

function fmtDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
}

function getMesKey(iso) { return iso.slice(0, 7); } // "2026-03"

// ── Componente principal ──────────────────────────────────────────────────────
export default function Diagramas14x14Screen({ onBack }) {
    const { empresaNombre } = useAppData();

    const [grupos,    setGrupos]    = useState([]);   // [{id, grupo, nombre, francos:[]}]
    const [legajos,   setLegajos]   = useState([]);   // todos los legajos de la empresa
    const [cargando,  setCargando]  = useState(true);
    const [seeding,   setSeeding]   = useState(false);
    const [importing, setImporting] = useState(false);
    const [importRes, setImportRes] = useState(null);
    const [grupoSel,  setGrupoSel]  = useState(null); // grupo activo
    const [vistaTab,  setVistaTab]  = useState("personas"); // "personas" | "francos"
    const [mesVista,  setMesVista]  = useState(() => {
        const h = new Date();
        return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`;
    });

    // ── Carga ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!empresaNombre) return;
        (async () => {
            setCargando(true);
            try {
                const [gSnap, lSnap] = await Promise.all([
                    getDocs(collection(db, "diagramas14x14")),
                    getDocs(query(collection(db, "legajos"), where("empresa", "==", empresaNombre))),
                ]);
                setGrupos(gSnap.docs.map(d => ({ docId: d.id, ...d.data() })));
                setLegajos(lSnap.docs.map(d => ({ docId: d.id, ...d.data() })));
            } finally {
                setCargando(false);
            }
        })();
    }, [empresaNombre]);

    // ── Seed inicial ─────────────────────────────────────────────────────────
    const handleSeed = async () => {
        if (!window.confirm("¿Cargar los diagramas 14x14 en Firestore? Solo hacer una vez.")) return;
        setSeeding(true);
        await seedDiagramas14x14(empresaNombre);
        // recargar
        const snap = await getDocs(collection(db, "diagramas14x14"));
        setGrupos(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
        setSeeding(false);
    };

    // ── Importar grupos masivamente ───────────────────────────────────────────
    const handleImportarGrupos = async () => {
        if (!window.confirm("¿Asignar grupos 3 y 4 a los legajos según el diagrama oficial? Esto sobreescribe el campo grupoTurno14.")) return;
        setImporting(true);
        setImportRes(null);
        const res = await seedAsignarGrupos(empresaNombre);
        // recargar legajos
        const snap = await getDocs(query(collection(db, "legajos"), where("empresa", "==", empresaNombre)));
        setLegajos(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
        setImportRes(res);
        setImporting(false);
    };

    // ── Cambiar grupo de un legajo ────────────────────────────────────────────
    const handleCambiarGrupo = async (legajoDocId, nuevoGrupo) => {
        await updateDoc(doc(db, "legajos", legajoDocId), { grupoTurno14: nuevoGrupo });
        setLegajos(prev => prev.map(l =>
            l.docId === legajoDocId ? { ...l, grupoTurno14: nuevoGrupo } : l
        ));
    };

    // ── Cambiar régimen de un legajo ──────────────────────────────────────────
    const handleCambiarRegimen = async (legajoDocId, nuevoReg) => {
        await updateDoc(doc(db, "legajos", legajoDocId), { regimen: nuevoReg });
        setLegajos(prev => prev.map(l =>
            l.docId === legajoDocId ? { ...l, regimen: nuevoReg } : l
        ));
    };

    // ── Agregar/quitar franco ─────────────────────────────────────────────────
    const handleToggleFranco = async (grupoDocId, fecha, tieneF) => {
        const g = grupos.find(g => g.docId === grupoDocId);
        if (!g) return;
        const nuevos = tieneF
            ? g.francos.filter(f => f !== fecha)
            : [...g.francos, fecha].sort();
        await updateDoc(doc(db, "diagramas14x14", grupoDocId), { francos: nuevos });
        setGrupos(prev => prev.map(gp =>
            gp.docId === grupoDocId ? { ...gp, francos: nuevos } : gp
        ));
    };

    // ── Personas del grupo seleccionado ───────────────────────────────────────
    const personasGrupo = useMemo(() => {
        if (!grupoSel) return [];
        return legajos
            .filter(l => l.grupoTurno14 === grupoSel.grupo)
            .sort((a, b) => (Number(a.legajo)||0) - (Number(b.legajo)||0));
    }, [legajos, grupoSel]);

    const sinGrupo = useMemo(() =>
        legajos.filter(l =>
            (l.regimen === "14 x 14 x 8" || l.regimen === "14 x 14 x 12") && !l.grupoTurno14
        ).sort((a, b) => (Number(a.legajo)||0) - (Number(b.legajo)||0))
    , [legajos]);

    // ── Días del mes visible ──────────────────────────────────────────────────
    const diasMes = useMemo(() => {
        const [y, m] = mesVista.split("-").map(Number);
        const dias = [];
        // período 24 del mes anterior al 23 del mes actual
        let cur = new Date(y, m - 2, 24);
        const end = new Date(y, m - 1, 23);
        while (cur <= end) {
            dias.push(new Date(cur));
            cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
        }
        return dias;
    }, [mesVista]);

    const francosSet = useMemo(() => {
        if (!grupoSel) return new Set();
        return new Set(grupoSel.francos);
    }, [grupoSel]);

    // ── Años disponibles ──────────────────────────────────────────────────────
    const mesesDisp = useMemo(() => {
        const meses = [];
        for (let y = 2026; y <= 2028; y++) {
            for (let m = 1; m <= 12; m++) {
                meses.push(`${y}-${String(m).padStart(2,"0")}`);
            }
        }
        return meses;
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    if (cargando) return <div className="d14-loading">Cargando diagramas...</div>;

    return (
        <div className="d14-root">
            {/* Header */}
            <header className="d14-header">
                <button className="d14-back" onClick={onBack}>← Volver</button>
                <div className="d14-header-title">Diagramas 14 × 14</div>
                {grupos.length === 0 && (
                    <button className="d14-btn-seed" onClick={handleSeed} disabled={seeding}>
                        {seeding ? "Cargando..." : "⬆ Cargar datos iniciales"}
                    </button>
                )}
                <button className="d14-btn-import" onClick={handleImportarGrupos} disabled={importing}>
                    {importing ? "Importando..." : "⬇ Importar grupos del diagrama"}
                </button>
                {importRes && (
                    <span className="d14-import-res">
                        ✓ {importRes.ok} asignados
                        {importRes.noEncontrado.length > 0 && ` · ${importRes.noEncontrado.length} no encontrados`}
                    </span>
                )}
            </header>

            <div className="d14-body">
                {/* Panel izquierdo — grupos */}
                <aside className="d14-sidebar">
                    <div className="d14-sidebar-title">Grupos</div>
                    {grupos.sort((a,b) => a.grupo.localeCompare(b.grupo)).map(g => (
                        <button key={g.docId}
                            className={`d14-grupo-btn ${grupoSel?.docId === g.docId ? "d14-grupo-btn--on" : ""}`}
                            onClick={() => setGrupoSel(g)}>
                            <span className="d14-grupo-num">Grupo {g.grupo}</span>
                            <span className="d14-grupo-count">
                                {legajos.filter(l => l.grupoTurno14 === g.grupo).length} personas
                            </span>
                        </button>
                    ))}

                    <div className="d14-sidebar-resumen">
                        <div className="d14-sidebar-title" style={{marginTop:8}}>Totales por grupo</div>
                        {grupos.sort((a,b) => a.grupo.localeCompare(b.grupo)).map(g => {
                            const miembros = legajos.filter(l => l.grupoTurno14 === g.grupo);
                            const c8  = miembros.filter(l => l.regimen === "14 x 14 x 8").length;
                            const c12 = miembros.filter(l => l.regimen === "14 x 14 x 12").length;
                            return (
                                <div key={g.grupo} className="d14-resumen-grupo">
                                    <div className="d14-resumen-grupo-titulo">Grupo {g.grupo}</div>
                                    <div className="d14-resumen-fila">
                                        <span>14 × 14 × 8</span>
                                        <strong>{c8}</strong>
                                    </div>
                                    <div className="d14-resumen-fila">
                                        <span>14 × 14 × 12</span>
                                        <strong>{c12}</strong>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="d14-resumen-fila d14-resumen-total">
                            <span>Total</span>
                            <strong>{legajos.filter(l => l.grupoTurno14 === "3" || l.grupoTurno14 === "4").length}</strong>
                        </div>
                    </div>

                    {sinGrupo.length > 0 && (
                        <div className="d14-sin-grupo">
                            <div className="d14-sin-grupo-title">Sin grupo ({sinGrupo.length})</div>
                            {sinGrupo.map(l => (
                                <div key={l.docId} className="d14-sin-grupo-item">
                                    <span><strong className="d14-sg-leg">{l.legajo}</strong> {l.nombre}</span>
                                    <div className="d14-grupo-sel">
                                        {grupos.map(g => (
                                            <button key={g.grupo}
                                                className="d14-asignar-btn"
                                                onClick={() => handleCambiarGrupo(l.docId, g.grupo)}>
                                                G{g.grupo}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* Panel derecho */}
                {grupoSel ? (
                    <main className="d14-main">
                        <div className="d14-main-header">
                            <div className="d14-main-title">Grupo {grupoSel.grupo}</div>
                            <div className="d14-tabs">
                                <button className={`d14-tab ${vistaTab==="personas"?"d14-tab--on":""}`}
                                    onClick={() => setVistaTab("personas")}>👥 Personas</button>
                                <button className={`d14-tab ${vistaTab==="francos"?"d14-tab--on":""}`}
                                    onClick={() => setVistaTab("francos")}>📅 Francos</button>
                            </div>
                        </div>

                        {/* Vista personas */}
                        {vistaTab === "personas" && (
                            <div className="d14-personas">
                                {personasGrupo.length === 0
                                    ? <div className="d14-empty">No hay personas asignadas a este grupo</div>
                                    : personasGrupo.map(l => (
                                        <div key={l.docId} className="d14-persona-row">
                                            <span className="d14-persona-leg">{l.legajo}</span>
                                            <span className="d14-persona-nombre">{l.nombre}</span>
                                            <select className="d14-persona-reg-sel"
                                                value={l.regimen || ""}
                                                onChange={e => handleCambiarRegimen(l.docId, e.target.value)}>
                                                <option value="">— Régimen —</option>
                                                <option>14 x 14 x 12</option>
                                                <option>14 x 14 x 8</option>
                                            </select>
                                            <select className="d14-persona-grupo-sel"
                                                value={l.grupoTurno14 || ""}
                                                onChange={e => handleCambiarGrupo(l.docId, e.target.value)}>
                                                <option value="">— Sin grupo —</option>
                                                {grupos.map(g => (
                                                    <option key={g.grupo} value={g.grupo}>Grupo {g.grupo}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))
                                }
                            </div>
                        )}

                        {/* Vista francos */}
                        {vistaTab === "francos" && (
                            <div className="d14-francos">
                                <div className="d14-francos-nav">
                                    <select className="d14-mes-sel"
                                        value={mesVista}
                                        onChange={e => setMesVista(e.target.value)}>
                                        {mesesDisp.map(m => {
                                            const [y, mo] = m.split("-");
                                            return <option key={m} value={m}>{MESES_ES[Number(mo)-1]} {y}</option>;
                                        })}
                                    </select>
                                    <span className="d14-francos-count">
                                        {grupoSel.francos.filter(f => f.startsWith(mesVista.slice(0,4))).length} francos en {mesVista.slice(0,4)}
                                    </span>
                                </div>
                                <div className="d14-cal">
                                    {diasMes.map(d => {
                                        const iso  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                                        const esFco = francosSet.has(iso);
                                        const dow   = d.getDay();
                                        return (
                                            <button key={iso}
                                                className={[
                                                    "d14-dia",
                                                    esFco          ? "d14-dia--fco" : "d14-dia--trab",
                                                    dow===0||dow===6 ? "d14-dia--fin" : "",
                                                ].join(" ")}
                                                onClick={() => handleToggleFranco(grupoSel.docId, iso, esFco)}
                                                title={iso}>
                                                <span className="d14-dia-dow">{DIAS_ES[dow]}</span>
                                                <span className="d14-dia-num">{d.getDate()}</span>
                                                <span className="d14-dia-mes">{MESES_ES[d.getMonth()]}</span>
                                                <span className="d14-dia-tag">{esFco ? "FCO" : "TRAB"}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </main>
                ) : (
                    <main className="d14-main d14-main--empty">
                        <div className="d14-placeholder">← Seleccioná un grupo</div>
                    </main>
                )}
            </div>
        </div>
    );
}
