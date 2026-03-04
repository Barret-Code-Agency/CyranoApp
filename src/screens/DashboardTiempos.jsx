// src/screens/DashboardTiempos.jsx
// Dashboard de tiempos por supervisor: control, capacitación, otras actividades, traslados
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import "../styles/DashboardTiempos.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

const toMinutes = (hora) => {
    if (!hora) return null;
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + (m || 0);
};

const diffMin = (ini, fin) => {
    if (!ini || !fin) return 0;
    let d = toMinutes(fin) - toMinutes(ini);
    if (d < 0) d += 24 * 60; // cruza medianoche
    return d;
};

const fmtMin = (min) => {
    if (!min || min <= 0) return "0 min";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const pct = (val, total) => total > 0 ? Math.round((val / total) * 100) : 0;

const TIPO_LABEL = { ctrl: "Control de puesto", cap: "Capacitación", otra: "Otras actividades" };
const TIPO_COLOR = { ctrl: "#003087", cap: "#e20113", otra: "#f59e0b", traslado: "#10b981" };

// Calcula tiempos de una jornada: actividades + traslados (gaps entre ellas)
const calcularTiempos = (jornada) => {
    const acts = [...(jornada.actividades || [])]
        .filter(a => a.horaInicio && a.horaFin)
        .sort((a, b) => toMinutes(a.horaInicio) - toMinutes(b.horaInicio));

    let ctrl = 0, cap = 0, otra = 0, traslado = 0;

    acts.forEach(a => {
        const dur = diffMin(a.horaInicio, a.horaFin);
        if (a.tipo === "ctrl")  ctrl  += dur;
        if (a.tipo === "cap")   cap   += dur;
        if (a.tipo === "otra")  otra  += dur;
    });

    // Gaps entre actividades consecutivas = traslados
    for (let i = 1; i < acts.length; i++) {
        const gap = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
        if (gap > 0 && gap < 180) traslado += gap; // ignorar gaps > 3h (probablemente break)
    }

    const total = ctrl + cap + otra + traslado;
    return { ctrl, cap, otra, traslado, total };
};

// ── Componente barra de tiempo ────────────────────────────────────────────────
function BarraTiempos({ ctrl, cap, otra, traslado }) {
    const total = ctrl + cap + otra + traslado || 1;
    const segmentos = [
        { key: "ctrl",     val: ctrl,     color: TIPO_COLOR.ctrl },
        { key: "cap",      val: cap,      color: TIPO_COLOR.cap },
        { key: "otra",     val: otra,     color: TIPO_COLOR.otra },
        { key: "traslado", val: traslado, color: TIPO_COLOR.traslado },
    ].filter(s => s.val > 0);

    return (
        <div className="dt-bar">
            {segmentos.map(s => (
                <div
                    key={s.key}
                    className="dt-bar-seg"
                    style={{ width: `${pct(s.val, total)}%`, background: s.color }}
                    title={`${s.key}: ${fmtMin(s.val)}`}
                />
            ))}
        </div>
    );
}

// ── Tarjeta de supervisor ─────────────────────────────────────────────────────
function TarjetaSupervisor({ nombre, jornadas, expandido, onToggle }) {
    const totales = useMemo(() => {
        const acc = { ctrl: 0, cap: 0, otra: 0, traslado: 0, total: 0 };
        jornadas.forEach(j => {
            const t = calcularTiempos(j);
            acc.ctrl     += t.ctrl;
            acc.cap      += t.cap;
            acc.otra     += t.otra;
            acc.traslado += t.traslado;
            acc.total    += t.total;
        });
        return acc;
    }, [jornadas]);

    const iniciales = nombre.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();

    return (
        <div className={`dt-card ${expandido ? "dt-card--open" : ""}`}>
            {/* Header de la tarjeta */}
            <div className="dt-card-header" onClick={onToggle}>
                <div className="dt-avatar">{iniciales}</div>
                <div className="dt-card-info">
                    <div className="dt-card-nombre">{nombre}</div>
                    <div className="dt-card-meta">
                        {jornadas.length} jornada{jornadas.length !== 1 ? "s" : ""}
                        &nbsp;·&nbsp; {fmtMin(totales.total)} totales
                    </div>
                    <BarraTiempos {...totales} />
                </div>
                <div className="dt-card-stats">
                    <div className="dt-stat" style={{ color: TIPO_COLOR.ctrl }}>
                        <span className="dt-stat-val">{fmtMin(totales.ctrl)}</span>
                        <span className="dt-stat-lbl">Control</span>
                    </div>
                    <div className="dt-stat" style={{ color: TIPO_COLOR.cap }}>
                        <span className="dt-stat-val">{fmtMin(totales.cap)}</span>
                        <span className="dt-stat-lbl">Capac.</span>
                    </div>
                    <div className="dt-stat" style={{ color: TIPO_COLOR.otra }}>
                        <span className="dt-stat-val">{fmtMin(totales.otra)}</span>
                        <span className="dt-stat-lbl">Otras</span>
                    </div>
                    <div className="dt-stat" style={{ color: TIPO_COLOR.traslado }}>
                        <span className="dt-stat-val">{fmtMin(totales.traslado)}</span>
                        <span className="dt-stat-lbl">Traslado</span>
                    </div>
                </div>
                <div className="dt-chevron">{expandido ? "▲" : "▼"}</div>
            </div>

            {/* Detalle por jornada */}
            {expandido && (
                <div className="dt-detalle">
                    <div className="dt-detalle-title">Detalle por jornada</div>
                    {jornadas.map(j => {
                        const t = calcularTiempos(j);
                        const acts = [...(j.actividades || [])]
                            .filter(a => a.horaInicio && a.horaFin)
                            .sort((a, b) => toMinutes(a.horaInicio) - toMinutes(b.horaInicio));

                        // Construir línea de tiempo: actividades + traslados intercalados
                        const linea = [];
                        for (let i = 0; i < acts.length; i++) {
                            if (i > 0) {
                                const gap = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
                                if (gap > 0 && gap < 180) {
                                    linea.push({ tipo: "traslado", horaInicio: acts[i - 1].horaFin, horaFin: acts[i].horaInicio, dur: gap });
                                }
                            }
                            linea.push({ ...acts[i], dur: diffMin(acts[i].horaInicio, acts[i].horaFin) });
                        }

                        return (
                            <div key={j.jornadaID} className="dt-jornada">
                                <div className="dt-jornada-header">
                                    <span className="dt-jornada-id">{j.jornadaID}</span>
                                    <span className="dt-jornada-fecha">{j.fecha}</span>
                                    <span className="dt-jornada-hora">{j.horaInicio} → {j.horaFin}</span>
                                    <span className="dt-jornada-total">{fmtMin(t.total)}</span>
                                </div>

                                <BarraTiempos {...t} />

                                {/* Línea de tiempo */}
                                <div className="dt-timeline">
                                    {linea.map((seg, idx) => (
                                        <div key={idx} className="dt-timeline-item">
                                            <div
                                                className="dt-timeline-dot"
                                                style={{ background: TIPO_COLOR[seg.tipo] || TIPO_COLOR.otra }}
                                            />
                                            <div className="dt-timeline-content">
                                                <span className="dt-timeline-tipo">
                                                    {seg.tipo === "traslado"
                                                        ? "🚗 Traslado"
                                                        : seg.tipo === "ctrl"
                                                            ? "🎯 " + (seg.objetivo || "Control de puesto")
                                                            : seg.tipo === "cap"
                                                                ? "📚 Capacitación"
                                                                : "🔧 " + (seg.actividad || "Otra actividad")}
                                                </span>
                                                <span className="dt-timeline-horario">
                                                    {seg.horaInicio} → {seg.horaFin}
                                                </span>
                                                <span
                                                    className="dt-timeline-dur"
                                                    style={{ color: TIPO_COLOR[seg.tipo] || TIPO_COLOR.otra }}
                                                >
                                                    {fmtMin(seg.dur)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function DashboardTiempos() {
    const { jornadas } = useAppData();
    const [expandido, setExpandido] = useState(null);
    const [filtroFecha, setFiltroFecha] = useState("7"); // días

    const jornadasFiltradas = useMemo(() => {
        const dias = parseInt(filtroFecha);
        const desde = new Date();
        desde.setDate(desde.getDate() - dias);
        return jornadas.filter(j => j.estado === "cerrada" && new Date(j.fecha) >= desde);
    }, [jornadas, filtroFecha]);

    // Agrupar por supervisor
    const porSupervisor = useMemo(() => {
        const map = {};
        jornadasFiltradas.forEach(j => {
            const nombre = j.nombre || j.supervisor || "Sin nombre";
            if (!map[nombre]) map[nombre] = [];
            map[nombre].push(j);
        });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
    }, [jornadasFiltradas]);

    // Totales globales
    const globales = useMemo(() => {
        const acc = { ctrl: 0, cap: 0, otra: 0, traslado: 0, total: 0 };
        jornadasFiltradas.forEach(j => {
            const t = calcularTiempos(j);
            acc.ctrl     += t.ctrl;
            acc.cap      += t.cap;
            acc.otra     += t.otra;
            acc.traslado += t.traslado;
            acc.total    += t.total;
        });
        return acc;
    }, [jornadasFiltradas]);

    return (
        <div className="dt-root">
            {/* ── Header ── */}
            <div className="dt-header">
                <div>
                    <div className="screen-title">Dashboard de Tiempos</div>
                    <div className="screen-sub">Distribución de actividades por supervisor</div>
                </div>
                <div className="dt-filtro">
                    <label className="dt-filtro-label">Período</label>
                    <select
                        className="dt-filtro-select"
                        value={filtroFecha}
                        onChange={e => setFiltroFecha(e.target.value)}
                    >
                        <option value="7">Últimos 7 días</option>
                        <option value="15">Últimos 15 días</option>
                        <option value="30">Últimos 30 días</option>
                        <option value="90">Últimos 3 meses</option>
                    </select>
                </div>
            </div>

            {/* ── Resumen global ── */}
            <div className="dt-resumen">
                <div className="dt-resumen-card" style={{ borderColor: TIPO_COLOR.ctrl }}>
                    <div className="dt-resumen-icon">🎯</div>
                    <div className="dt-resumen-val">{fmtMin(globales.ctrl)}</div>
                    <div className="dt-resumen-lbl">Control de puestos</div>
                    <div className="dt-resumen-pct">{pct(globales.ctrl, globales.total)}%</div>
                </div>
                <div className="dt-resumen-card" style={{ borderColor: TIPO_COLOR.cap }}>
                    <div className="dt-resumen-icon">📚</div>
                    <div className="dt-resumen-val">{fmtMin(globales.cap)}</div>
                    <div className="dt-resumen-lbl">Capacitaciones</div>
                    <div className="dt-resumen-pct">{pct(globales.cap, globales.total)}%</div>
                </div>
                <div className="dt-resumen-card" style={{ borderColor: TIPO_COLOR.otra }}>
                    <div className="dt-resumen-icon">🔧</div>
                    <div className="dt-resumen-val">{fmtMin(globales.otra)}</div>
                    <div className="dt-resumen-lbl">Otras actividades</div>
                    <div className="dt-resumen-pct">{pct(globales.otra, globales.total)}%</div>
                </div>
                <div className="dt-resumen-card" style={{ borderColor: TIPO_COLOR.traslado }}>
                    <div className="dt-resumen-icon">🚗</div>
                    <div className="dt-resumen-val">{fmtMin(globales.traslado)}</div>
                    <div className="dt-resumen-lbl">Traslados</div>
                    <div className="dt-resumen-pct">{pct(globales.traslado, globales.total)}%</div>
                </div>
            </div>

            {/* ── Leyenda ── */}
            <div className="dt-leyenda">
                {[
                    { label: "Control de puesto", color: TIPO_COLOR.ctrl },
                    { label: "Capacitación",      color: TIPO_COLOR.cap },
                    { label: "Otras actividades", color: TIPO_COLOR.otra },
                    { label: "Traslados",          color: TIPO_COLOR.traslado },
                ].map(l => (
                    <div key={l.label} className="dt-leyenda-item">
                        <div className="dt-leyenda-dot" style={{ background: l.color }} />
                        {l.label}
                    </div>
                ))}
            </div>

            {/* ── Lista de supervisores ── */}
            {porSupervisor.length === 0 ? (
                <div className="dt-empty">
                    No hay jornadas cerradas en el período seleccionado.
                </div>
            ) : (
                <div className="dt-lista">
                    {porSupervisor.map(([nombre, jorns]) => (
                        <TarjetaSupervisor
                            key={nombre}
                            nombre={nombre}
                            jornadas={jorns}
                            expandido={expandido === nombre}
                            onToggle={() => setExpandido(expandido === nombre ? null : nombre)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
