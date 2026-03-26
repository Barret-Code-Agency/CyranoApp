// src/screens/FinJornadaScreen.jsx
import { useState } from "react";
import { nowTime } from "../../utils/helpers";
import { useAppData } from "../../context/AppDataContext";
import "./FinJornadaScreen.css";

export default function FinJornadaScreen({ onClosed, onBack }) {
    const { jornadaActiva, cerrarJornada, data } = useAppData();
    const [kmFinal, setKmFinal] = useState("");
    const session = jornadaActiva;

    if (!session) return null;

    const horaFin = nowTime();
    const kmRec   = kmFinal && session.kmInicial
        ? Number(kmFinal) - Number(session.kmInicial) : null;

    const ctrl  = (session.actividades || []).filter((a) => a.tipo === "ctrl");
    const cap   = (session.actividades || []).filter((a) => a.tipo === "cap");
    const otras = (session.actividades || []).filter((a) => a.tipo === "otra");

    const handleCerrar = async () => {
        const jornadaCerrada = await cerrarJornada({ kmFinal, horaFin });
        onClosed(jornadaCerrada);
    };

    return (
        <>
            <div className="screen-title">Fin de Jornada</div>
            <div className="screen-sub">Cierre de turno — el informe se enviará al supervisor</div>

            <div className="progress-wrap">
                <div className="progress-steps">
                    {[1,2,3,4].map((i) => <div key={i} className="progress-step done" />)}
                </div>
                <div className="progress-label">Paso final</div>
            </div>

            <div className="card">
                <div className="card-title">Resumen del turno</div>
                <div className="fin-summary-header">
                    <div className="fin-summary-icon">🏁</div>
                    <div className="fin-summary-meta">
                        <h3>{session.nombre}</h3>
                        <p>{session.jornadaID} · {session.fecha}</p>
                    </div>
                </div>
                <div className="info-row">
                    <span className="info-k">Vehículo</span>
                    <span className="info-v">{session.vehiculo}</span>
                </div>
                <div className="info-row">
                    <span className="info-k">Horario</span>
                    <span className="info-v">{session.horaInicio} → {horaFin} hs</span>
                </div>
                <div className="info-row">
                    <span className="info-k">Email de envío</span>
                    <span className="info-v" style={{ fontSize:"var(--text-sm)" }}>{session.email}</span>
                </div>
                <div className="info-row">
                    <span className="info-k">Actividades</span>
                    <span className="info-v">
                        <span className="tag green">{ctrl.length} controles</span>
                        <span className="tag blue">{cap.length} cap.</span>
                        <span className="tag orange">{otras.length} otras</span>
                    </span>
                </div>
            </div>

            <div className="card">
                <div className="card-title">Kilometraje de cierre</div>
                <div className="row">
                    <div className="field">
                        <label className="label">Km Inicial</label>
                        <input value={session.kmInicial} readOnly />
                    </div>
                    <div className="field">
                        <label className="label">Km Final</label>
                        <input type="number" placeholder="Ingresá km final" value={kmFinal}
                            onChange={(e) => setKmFinal(e.target.value)} />
                    </div>
                </div>
                {kmRec !== null && kmRec >= 0 && (
                    <div className="fin-km-total">
                        Total recorrido <strong>{kmRec} km</strong>
                    </div>
                )}
            </div>

            <div className="fin-warning">
                ⚠️ Al cerrar se guardará el informe de jornada para <strong>{session.email}</strong>
            </div>

            <button className="btn btn-danger"
                disabled={false}
                onClick={handleCerrar}>
                🏁 Cerrar Jornada &amp; Enviar Informe
            </button>
            <button className="btn btn-secondary" onClick={onBack}>← Volver al menú</button>
        </>
    );
}
