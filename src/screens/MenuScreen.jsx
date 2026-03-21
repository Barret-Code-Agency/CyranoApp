// src/screens/MenuScreen.jsx
import { useAppData } from "../context/AppDataContext";
import "./MenuScreen.css";

// key = phase name en App.jsx, tipo = valor guardado en actividadActiva.tipo
const MENU_ITEMS = [
    { key: "ctrl",         tipo: "ctrl", icon: "🎯", title: "Control de Objetivo",  desc: "Inspección y evaluación de guardia en puesto" },
    { key: "capacitacion", tipo: "cap",  icon: "📚", title: "Capacitación",         desc: "Registrar sesión de formación" },
    { key: "otra",         tipo: "otra", icon: "🔧", title: "Otra Actividad",        desc: "Traslados, reparaciones, tareas administrativas..." },
    { key: "fin",          tipo: "fin",  icon: "🏁", title: "Fin de Jornada",        desc: "Cerrar turno y enviar informe", danger: true },
];

export default function MenuScreen({ onSelect }) {
    const { jornadaActiva, actividadActiva } = useAppData();
    const session    = jornadaActiva;
    const activities = session?.actividades || [];

    const ctrl  = activities.filter((a) => a.tipo === "ctrl").length;
    const cap   = activities.filter((a) => a.tipo === "cap").length;
    const otras = activities.filter((a) => a.tipo === "otra").length;

    // Tipo legible de la actividad en curso
    const tipoLabel = (t) =>
        t === "ctrl" ? "🎯 Control en curso"
        : t === "cap"  ? "📚 Capacitación en curso"
        : "🔧 Actividad en curso";

    return (
        <>
            <div className="screen-title">¿Qué registramos?</div>
            <div className="screen-sub">Seleccioná el tipo de actividad a registrar</div>

            <div className="menu-session-badge">
                <div className="menu-session-indicator" />
                <div className="menu-session-text">
                    <strong>{session?.jornadaID}</strong> · En curso desde{" "}
                    <strong>{session?.horaInicio} hs</strong>
                    {activities.length > 0 && (
                        <span> · <strong>{activities.length}</strong> actividad{activities.length !== 1 ? "es" : ""}</span>
                    )}
                </div>
            </div>

            {/* Actividad en curso — banner de alerta */}
            {actividadActiva && (
                <div className="menu-actividad-pendiente">
                    <div className="menu-pendiente-icon">⏳</div>
                    <div className="menu-pendiente-text">
                        <strong>{tipoLabel(actividadActiva.tipo)}</strong>
                        <small>Iniciada a las {actividadActiva.horaInicio} · Pendiente de finalizar</small>
                    </div>
                    <button
                        className="menu-pendiente-btn"
                        onClick={() => {
                            const map = { ctrl: "ctrl", cap: "capacitacion", otra: "otra" };
                            onSelect(map[actividadActiva.tipo] || actividadActiva.tipo);
                        }}
                    >
                        Finalizar →
                    </button>
                </div>
            )}

            {/* Log de actividades realizadas */}
            {activities.length > 0 && (
                <div className="act-log">
                    <div className="act-log-title">Registrado hasta ahora ({activities.length})</div>
                    {activities.map((a, i) => (
                        <div key={i} className={`act-item ${a.tipo}`}>
                            <div className="act-type">
                                {a.tipo === "cap"  && "📚 Capacitación"}
                                {a.tipo === "ctrl" && "🎯 Control de Objetivo"}
                                {a.tipo === "otra" && "🔧 Otra Actividad"}
                            </div>
                            <div className="act-desc">
                                {a.tipo === "cap"  && `${a.tema || "—"} · ${a.horaInicio}–${a.horaFin}`}
                                {a.tipo === "ctrl" && `${a.objetivo} · Vigilador: ${a.vigilador}`}
                                {a.tipo === "otra" && `${a.actividad} · ${a.horaInicio}–${a.horaFin}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="menu-grid">
                {MENU_ITEMS.map((m) => {
                    const isActiva   = actividadActiva && m.tipo === actividadActiva.tipo;
                    const isDisabled = actividadActiva && !isActiva && m.key !== "fin";
                    return (
                        <div
                            key={m.key}
                            className={`menu-card${m.danger ? " danger" : ""}${isDisabled ? " disabled" : ""}`}
                            onClick={() => { if (!isDisabled) onSelect(m.key); }}
                        >
                            <span className="menu-icon">{m.icon}</span>
                            <div className="menu-info">
                                <h3>{m.title}</h3>
                                <p>{m.desc}</p>
                            </div>
                            <span className="menu-arrow">›</span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
