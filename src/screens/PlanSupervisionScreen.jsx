// src/screens/PlanSupervisionScreen.jsx
import { useState, useEffect } from "react";
import { useAppData } from "../context/AppDataContext";
import "../styles/PlanSupervisionScreen.css";

export default function PlanSupervisionScreen() {
    const { data, plan, savePlan } = useAppData();
    const [localPlan, setLocalPlan] = useState([]);
    const [toast, setToast]         = useState("");
    const [dirty, setDirty]         = useState(false);

    // Inicializar: cada objetivo debe tener una entrada en el plan
    useEffect(() => {
        const merged = data.objetivos.map((obj) => {
            const existing = plan.find((p) => p.objetivo === obj);
            return existing || { objetivo: obj, visitasPorSemana: 0 };
        });
        setLocalPlan(merged);
    }, [data.objetivos, plan]);

    const setVisitas = (idx, val) => {
        const n = Math.max(0, Math.min(99, Number(val) || 0));
        setLocalPlan((prev) => {
            const updated = [...prev];
            updated[idx]  = { ...updated[idx], visitasPorSemana: n };
            return updated;
        });
        setDirty(true);
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2100); };

    const handleSave = () => {
        // Solo guardar los que tienen visitas > 0
        savePlan(localPlan.filter((p) => p.visitasPorSemana > 0));
        setDirty(false);
        showToast("✓ Plan guardado");
    };

    const totalVisitas = localPlan.reduce((s, p) => s + (p.visitasPorSemana || 0), 0);

    return (
        <>
            <div className="plan-header">
                <div>
                    <div className="screen-title" style={{ fontSize: "var(--text-2xl)" }}>
                        Plan de Supervisión
                    </div>
                    <div className="screen-sub">Definí las visitas requeridas por puesto por semana</div>
                </div>
                <div className="plan-total-badge">
                    {totalVisitas} visitas / sem.
                </div>
            </div>

            <div className="card">
                <div className="card-title">Puestos / Objetivos</div>

                <div className="plan-hint">
                    Ingresá cuántas visitas de control debe recibir cada puesto por semana.
                    Poner <strong>0</strong> excluye el puesto del plan.
                </div>

                {localPlan.map((item, idx) => (
                    <div key={item.objetivo} className="plan-row">
                        <div className="plan-row-name">{item.objetivo}</div>
                        <div className="plan-row-control">
                            <button
                                className="plan-stepper"
                                onClick={() => setVisitas(idx, item.visitasPorSemana - 1)}
                                disabled={item.visitasPorSemana <= 0}
                            >−</button>
                            <input
                                type="number"
                                min="0"
                                max="99"
                                value={item.visitasPorSemana}
                                onChange={(e) => setVisitas(idx, e.target.value)}
                                className="plan-input"
                            />
                            <button
                                className="plan-stepper"
                                onClick={() => setVisitas(idx, item.visitasPorSemana + 1)}
                            >+</button>
                        </div>
                        <div className="plan-row-label">
                            {item.visitasPorSemana > 0
                                ? <span className="tag blue">{item.visitasPorSemana}x / sem.</span>
                                : <span className="plan-no-plan">Sin plan</span>
                            }
                        </div>
                    </div>
                ))}
            </div>

            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
                💾 Guardar Plan
            </button>

            {toast && <div className="admin-toast">{toast}</div>}
        </>
    );
}
