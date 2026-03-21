// src/screens/JornadaScreen.jsx
import { useState, useEffect } from "react";
import { nowTime, todayDate, genID } from "../../utils/helpers";
import { useAppData } from "../../context/AppDataContext";
import "./JornadaScreen.css";
import ControlVehicularScreen from "./ControlVehicularScreen";

export default function JornadaScreen({ user, onStarted, onBack }) {
    const { data, iniciarJornada } = useAppData();

    const [form, setForm] = useState({
        jornadaID:  genID(),
        fecha:      todayDate(),
        vehiculo:   "",
        kmInicial:  "",
        horaInicio: nowTime(),
    });

    const [nombre, apellido] = user.name.includes(" ")
        ? [user.name.split(" ")[0], user.name.split(" ").slice(1).join(" ")]
        : [user.name, ""];

    const [editNombre,   setEditNombre]   = useState(nombre);
    const [editApellido, setEditApellido] = useState(apellido);

    const set   = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const valid = !!editNombre;
    const [step, setStep] = useState("datos"); // "datos" | "control_vehicular"
    const [controlVeh, setControlVeh] = useState(null);

    useEffect(() => {
        const t = setInterval(() => set("horaInicio", nowTime()), 15000);
        return () => clearInterval(t);
    }, []);

    const doStart = (controlVehicular = null) => {
        const jornada = iniciarJornada({
            ...form,
            nombre:     `${editNombre} ${editApellido}`.trim(),
            email:      user.email,
            supervisor: user.name,
            controlVehicular,
        });
        onStarted(jornada);
    };

    const handleStart = () => {
        if (form.vehiculo) {
            setStep("control_vehicular");
        } else {
            doStart(null);
        }
    };

    const handleControlConfirmado = (datos) => {
        setControlVeh(datos);
        doStart(datos);
    };

    if (step === "control_vehicular") {
        return (
            <ControlVehicularScreen
                vehiculo={form.vehiculo}
                supervisor={`${editNombre} ${editApellido}`.trim()}
                onConfirmar={handleControlConfirmado}
                onOmitir={() => doStart(null)}
            />
        );
    }

    return (
        <>
            <div className="screen-title">Inicio de Jornada</div>
            <div className="screen-sub">Completá los datos — se guardan al presionar Iniciar</div>

            <div className="progress-wrap">
                <div className="progress-steps">
                    {[1,2,3,4].map((i) => (
                        <div key={i} className={`progress-step ${i === 1 ? "active" : ""}`} />
                    ))}
                </div>
                <div className="progress-label">Paso 1 de 4</div>
            </div>

            <div className="card">
                <div className="card-title">Identificación del Operador</div>
                <div className="jornada-id-badge">{form.jornadaID}</div>
                <div className="row">
                    <div className="field">
                        <label className="label">Fecha</label>
                        <input value={form.fecha} readOnly />
                    </div>
                    <div className="field">
                        <label className="label">Hora de inicio</label>
                        <input value={form.horaInicio} readOnly />
                    </div>
                </div>
                <div className="row">
                    <div className="field">
                        <label className="label">Nombre</label>
                        <input value={editNombre} readOnly style={{ background: "var(--color-surface2)", color: "var(--color-muted)", cursor: "not-allowed" }} />
                    </div>
                    <div className="field">
                        <label className="label">Apellido</label>
                        <input value={editApellido} readOnly style={{ background: "var(--color-surface2)", color: "var(--color-muted)", cursor: "not-allowed" }} />
                    </div>
                </div>
                <div className="field">
                    <label className="label">Email</label>
                    <input value={user.email} readOnly />
                </div>
            </div>

            <div className="card">
                <div className="card-title">Vehículo &amp; Kilometraje</div>
                <div className="field">
                    <label className="label">Vehículo asignado <span style={{fontSize:"0.75em",color:"var(--color-muted)",fontWeight:400}}>(opcional)</span></label>
                    <select value={form.vehiculo} onChange={(e) => set("vehiculo", e.target.value)}>
                        <option value="">— Seleccionar vehículo —</option>
                        {data.vehiculos.map((v) => <option key={v}>{v}</option>)}
                    </select>
                </div>
                <div className="field">
                    <label className="label">Km Inicial <span style={{fontSize:"0.75em",color:"var(--color-muted)",fontWeight:400}}>(opcional)</span></label>
                    <input type="number" placeholder="Ej: 87450" value={form.kmInicial}
                        onChange={(e) => set("kmInicial", e.target.value)} />
                </div>
            </div>

            <button className="btn btn-primary" disabled={!valid} onClick={handleStart}>
                {form.vehiculo ? "🚗 Continuar → Control Vehicular" : "💾 Guardar e Iniciar Jornada"}
            </button>
            {onBack && (
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Volver
                </button>
            )}
        </>
    );
}
