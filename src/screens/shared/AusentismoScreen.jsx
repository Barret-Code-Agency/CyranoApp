// src/screens/shared/AusentismoScreen.jsx
// Pantalla de ausentismo — tabla de ausencias por empleado + estadísticas.
// Solo muestra códigos que generan ausentismo real (no francos ni vacaciones).

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import { getDias, fmtKey, DIAS_ES, MESES_ES, MESES_CORTO, REAL_AUS_CODES } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";
import "../../styles/AusentismoScreen.css";

// REAL_AUS_CODES con significado real (Enf, Art, Asa, Aca, Sus, Lic) importados desde periodoUtils
const AUS_META  = {
    Enf: { label: "Enf",  desc: "Enfermedad",         bg: "#fbbf24", fg: "#000" },
    Art: { label: "ART",  desc: "Accidente trabajo",   bg: "#0369a1", fg: "#fff" },
    Asa: { label: "ASA",  desc: "Lic. especial",       bg: "#dc2626", fg: "#fff" },
    Aca: { label: "ACA",  desc: "Lic. causal",         bg: "#ef4444", fg: "#fff" },
    Sus: { label: "Sus",  desc: "Suspensión",           bg: "#7c3aed", fg: "#fff" },
    Lic: { label: "Lic",  desc: "Licencia",             bg: "#6b7280", fg: "#fff" },
};

export default function AusentismoScreen({ año: añoProp, mes: mesProp }) {
    const { empresaId, empresaNombre } = useAppData();
    const hoy = new Date();
    const [añoSel,  setAñoSel]  = useState(añoProp  ?? hoy.getFullYear());
    const [mesSel,  setMesSel]  = useState(mesProp  ?? hoy.getMonth() + 1);
    const [docs,    setDocs]    = useState([]);
    const [cargando, setCargando] = useState(false);
    const [busq,    setBusq]    = useState("");
    const [zonaFiltro, setZonaFiltro] = useState("");

    const dias = useMemo(() => getDias(añoSel, mesSel), [añoSel, mesSel]);

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);
        getDocs(query(collection(db, "programacionServicios"), where("empresaId", "==", empresaId)))
            .then(snap => {
                setDocs(
                    snap.docs
                        .map(d => ({ docId: d.id, ...d.data() }))
                        .filter(d => d.año === añoSel && d.mes === mesSel)
                );
            })
            .catch(e => console.error("[AusentismoScreen] Error cargando programación:", e))
            .finally(() => setCargando(false));
    }, [empresaId, añoSel, mesSel]);

    // ── Nómina total (todos los empleados del período, con o sin ausencias) ──
    const nominaTotal = useMemo(() => {
        const legs = new Set();
        docs.forEach(doc => (doc.personal || []).forEach(p => {
            if (p.legajo) legs.add(String(p.legajo));
        }));
        return legs.size || 1;
    }, [docs]);

    // ── Construir filas: un objeto por legajo, mergeando todos los docs ───────
    const filasRaw = useMemo(() => {
        const byLeg = {};
        docs.forEach(doc => {
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (!leg) return;
                if (!byLeg[leg]) {
                    byLeg[leg] = {
                        legajo:  leg,
                        nombre:  p.nombre || "",
                        zona:    doc.zona || doc.proyectoNombre || "",
                        dias:    {},
                    };
                }
                const data = p.real || p.programado || {};
                Object.entries(data).forEach(([key, val]) => {
                    if (REAL_AUS_CODES.includes(val)) {
                        byLeg[leg].dias[key] = val;
                    }
                });
            });
        });
        return Object.values(byLeg)
            .filter(r => Object.keys(r.dias).length > 0)
            .sort((a, b) => (Number(a.legajo) || 0) - (Number(b.legajo) || 0));
    }, [docs]);

    // ── Zonas disponibles ─────────────────────────────────────────────────────
    const zonas = useMemo(() => {
        const set = new Set(filasRaw.map(f => f.zona).filter(Boolean));
        return [...set].sort();
    }, [filasRaw]);

    // ── Aplicar filtros ───────────────────────────────────────────────────────
    const filas = useMemo(() => {
        let base = filasRaw;
        if (zonaFiltro) base = base.filter(f => f.zona === zonaFiltro);
        if (busq) {
            const q = busq.toLowerCase();
            base = base.filter(f =>
                f.nombre.toLowerCase().includes(q) || f.legajo.includes(q)
            );
        }
        return base;
    }, [filasRaw, busq, zonaFiltro]);

    // ── Total días realmente asignados (denominador correcto) ────────────────
    const totalDiasAsignados = useMemo(() => {
        const byLeg = {};
        docs.forEach(doc => {
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (!leg) return;
                const data = p.real || p.programado || {};
                const count = Object.values(data).filter(v => v && v !== "").length;
                byLeg[leg] = (byLeg[leg] || 0) + count;
            });
        });
        return Object.values(byLeg).reduce((s, n) => s + n, 0) || 1;
    }, [docs]);

    // ── Estadísticas globales ─────────────────────────────────────────────────
    const stats = useMemo(() => {
        const porcod = Object.fromEntries(REAL_AUS_CODES.map(c => [c, 0]));
        let total = 0;
        filasRaw.forEach(f => {
            Object.values(f.dias).forEach(v => {
                if (porcod[v] !== undefined) { porcod[v]++; total++; }
            });
        });
        const diasLab = dias.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
        const indice = (total / totalDiasAsignados) * 100;
        return { porcod, total, indice, diasLab, nominaTotal };
    }, [filasRaw, dias, nominaTotal, totalDiasAsignados]);

    const años = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 2 + i);
    const colIndice = stats.indice < 3 ? "#10b981" : stats.indice < 6 ? "#f59e0b" : "#ef4444";

    return (
        <div className="aus-root">
            {/* ── Toolbar (solo controles) ── */}
            <div className="aus-toolbar">
                <div className="aus-toolbar-controls">
                    <select className="aus-sel" value={mesSel} onChange={e => setMesSel(Number(e.target.value))}>
                        {MESES_ES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className="aus-sel" value={añoSel} onChange={e => setAñoSel(Number(e.target.value))}>
                        {años.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {zonas.length > 0 && (
                        <select className="aus-sel" value={zonaFiltro} onChange={e => setZonaFiltro(e.target.value)}>
                            <option value="">Todas las zonas</option>
                            {zonas.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    )}
                    <input
                        className="aus-busq"
                        placeholder="Buscar empleado…"
                        value={busq}
                        onChange={e => setBusq(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Banner: Índice de ausentismo (fórmula RRHH) ── */}
            {!cargando && (
                <div className="aus-indice-banner">
                    <div className="aus-indice-main">
                        <div className="aus-indice-label">Índice de Ausentismo</div>
                        <div className="aus-indice-val" style={{ color: colIndice }}>
                            {stats.indice.toFixed(2)}%
                        </div>
                        <div className="aus-indice-formula">
                            {stats.total} días / {totalDiasAsignados} días asignados
                        </div>
                    </div>
                    <div className="aus-indice-chips">
                        <div className="aus-indice-chip">
                            <div className="aus-indice-chip-label">Total días ausentes</div>
                            <div className="aus-indice-chip-val" style={{ color: colIndice }}>{stats.total}</div>
                            <div className="aus-indice-chip-sub">días en el período</div>
                        </div>
                        <div className="aus-indice-chip">
                            <div className="aus-indice-chip-label">Empleados afectados</div>
                            <div className="aus-indice-chip-val" style={{ color: "#f1f5f9" }}>{filasRaw.length}</div>
                            <div className="aus-indice-chip-sub">de {stats.nominaTotal} en nómina</div>
                        </div>
                        <div className="aus-indice-chip">
                            <div className="aus-indice-chip-label">Días hábiles</div>
                            <div className="aus-indice-chip-val" style={{ color: "#f1f5f9" }}>{stats.diasLab}</div>
                            <div className="aus-indice-chip-sub">{MESES_ES[mesSel-1]} {añoSel}</div>
                        </div>
                        {REAL_AUS_CODES.filter(c => stats.porcod[c] > 0).map(c => (
                            <div key={c} className="aus-indice-chip">
                                <div className="aus-indice-chip-label">{AUS_META[c].desc}</div>
                                <div className="aus-indice-chip-val" style={{ color: AUS_META[c].bg }}>
                                    {stats.porcod[c]}
                                </div>
                                <div className="aus-indice-chip-sub">días</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {cargando && <div className="aus-loading">Cargando…</div>}

            {!cargando && (
                <>
                    {filas.length === 0 ? (
                        <div className="aus-empty">Sin ausentismo registrado para este período.</div>
                    ) : (
                        <div className="aus-tabla-wrap">
                            <table className="aus-table">
                                <thead>
                                    <tr>
                                        <th className="aus-th-sticky aus-th-leg">Leg.</th>
                                        <th className="aus-th-sticky aus-th-nom">Nombre</th>
                                        {dias.map(d => {
                                            const key = fmtKey(d);
                                            const dow = d.getDay();
                                            return (
                                                <th key={key} className={[
                                                    "aus-th-dia",
                                                    dow===0||dow===6 ? "aus-th-fin" : "",
                                                    FERIADOS_ARG[key] ? "aus-th-fer" : "",
                                                ].join(" ")}>
                                                    <div className="aus-th-mes">{MESES_CORTO[d.getMonth()]}</div>
                                                    <div className="aus-th-num">{d.getDate()}</div>
                                                    <div className="aus-th-dow">{DIAS_ES[dow].slice(0,2)}</div>
                                                </th>
                                            );
                                        })}
                                        {REAL_AUS_CODES.map(c => (
                                            <th key={c} className="aus-th-sum"
                                                style={{ background: AUS_META[c].bg, color: AUS_META[c].fg }}>
                                                {AUS_META[c].label}
                                            </th>
                                        ))}
                                        <th className="aus-th-sum aus-th-total">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filas.map(f => {
                                        const cnt = Object.fromEntries(REAL_AUS_CODES.map(c => [c, 0]));
                                        let tot = 0;
                                        dias.forEach(d => {
                                            const v = f.dias[fmtKey(d)];
                                            if (v && cnt[v] !== undefined) { cnt[v]++; tot++; }
                                        });
                                        return (
                                            <tr key={f.legajo} className="aus-row">
                                                <td className="aus-td-sticky aus-td-leg">{f.legajo}</td>
                                                <td className="aus-td-sticky aus-td-nom">{f.nombre}</td>
                                                {dias.map(d => {
                                                    const key = fmtKey(d);
                                                    const val = f.dias[key];
                                                    const dow = d.getDay();
                                                    const m   = val ? AUS_META[val] : null;
                                                    return (
                                                        <td key={key}
                                                            className={["aus-celda", dow===0||dow===6 ? "aus-celda--fin" : ""].join(" ")}
                                                            style={m ? { background: m.bg, color: m.fg, fontWeight: 700 } : {}}>
                                                            {m ? m.label : ""}
                                                        </td>
                                                    );
                                                })}
                                                {REAL_AUS_CODES.map(c => (
                                                    <td key={c} className="aus-td-sum">{cnt[c] || ""}</td>
                                                ))}
                                                <td className="aus-td-sum aus-td-total">{tot}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="aus-tfoot-row">
                                        <td colSpan={2} className="aus-tfoot-label">Totales por día</td>
                                        {dias.map(d => {
                                            const key = fmtKey(d);
                                            const cnt = filas.filter(f => REAL_AUS_CODES.includes(f.dias[key])).length;
                                            return (
                                                <td key={key} className="aus-tfoot-cel">{cnt || ""}</td>
                                            );
                                        })}
                                        {REAL_AUS_CODES.map(c => (
                                            <td key={c} className="aus-tfoot-sum"
                                                style={{ background: AUS_META[c].bg, color: AUS_META[c].fg }}>
                                                {stats.porcod[c] || ""}
                                            </td>
                                        ))}
                                        <td className="aus-tfoot-sum aus-tfoot-total">{stats.total}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* ── Tarjetas por código ── */}
                    <div className="aus-stats">
                        <div className="aus-stats-header">
                            <div className="aus-stats-titulo">Detalle por motivo — {MESES_ES[mesSel-1]} {añoSel}</div>
                        </div>
                        <div className="aus-stats-grid">
                            {REAL_AUS_CODES.map(c => (
                                <div key={c} className="aus-stat-card"
                                    style={{ borderLeft: `4px solid ${AUS_META[c].bg}` }}>
                                    <div className="aus-stat-label">{AUS_META[c].label}</div>
                                    <div className="aus-stat-desc">{AUS_META[c].desc}</div>
                                    <div className="aus-stat-val" style={{ color: AUS_META[c].bg }}>
                                        {stats.porcod[c]}
                                    </div>
                                    <div className="aus-stat-sub">
                                        días · {stats.total > 0 ? ((stats.porcod[c]/stats.total)*100).toFixed(1) : 0}% del total
                                    </div>
                                </div>
                            ))}
                            <div className="aus-stat-card aus-stat-card--total">
                                <div className="aus-stat-label">Total</div>
                                <div className="aus-stat-desc">Días de ausentismo</div>
                                <div className="aus-stat-val">{stats.total}</div>
                                <div className="aus-stat-sub">{stats.indice.toFixed(2)}% índice RRHH</div>
                            </div>
                            <div className="aus-stat-card aus-stat-card--emp">
                                <div className="aus-stat-label">Afectados</div>
                                <div className="aus-stat-desc">Empleados con ausencias</div>
                                <div className="aus-stat-val" style={{ color: "#0ea5e9" }}>{filasRaw.length}</div>
                                <div className="aus-stat-sub">de {stats.nominaTotal} en nómina</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
