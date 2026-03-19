// src/screens/admin/ConfigPanel.jsx
import { useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import EditableList from "./EditableList";

export default function ConfigPanel({ onUpdate, showToast }) {
    const { data, resetToDefaults } = useAppData();
    const [email, setEmail] = useState(data.supervisorEmail);
    const [showReset, setShowReset] = useState(false);
    const handleSaveEmail = () => { if (!email.includes("@")) return; onUpdate("supervisorEmail", email.trim()); showToast("✓ Email guardado"); };
    return (
        <>
            <div className="admin-email-section">
                <div className="admin-email-label"><span>📧</span> Email del supervisor</div>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supervisor@empresa.com" />
                    </div>
                    <button className="btn btn-primary" style={{ width: "auto", padding: "10px 18px" }} onClick={handleSaveEmail} disabled={!email.includes("@")}>Guardar</button>
                </div>
            </div>
            <EditableList icon="🚗" title="Vehículos"           dataKey="vehiculos"      items={data.vehiculos}          onUpdate={onUpdate} />
            <EditableList icon="🎯" title="Objetivos / Puestos" dataKey="objetivos"      items={data.objetivos}          onUpdate={onUpdate} />
            <EditableList icon="👮" title="Vigiladores"         dataKey="vigiladores"    items={data.vigiladores}        onUpdate={onUpdate} />
            <EditableList icon="🔧" title="Tipos de actividad"  dataKey="tiposActividad" items={data.tiposActividad}     onUpdate={onUpdate} />
            <EditableList icon="👤" title="Supervisores"        dataKey="supervisores"   items={data.supervisores || []} onUpdate={onUpdate} />
            {!showReset ? (
                <button className="btn btn-secondary" style={{ color: "var(--color-danger)", borderColor: "rgba(226,1,19,0.3)", marginTop: "var(--space-2)" }} onClick={() => setShowReset(true)}>
                    Restaurar configuración por defecto
                </button>
            ) : (
                <div className="admin-reset-confirm">
                    <p>¿Restaurar <strong>todos los datos</strong> a los valores por defecto?</p>
                    <div className="admin-reset-confirm-actions">
                        <button className="btn btn-secondary" onClick={() => setShowReset(false)}>Cancelar</button>
                        <button className="btn btn-danger" onClick={() => { resetToDefaults(); setShowReset(false); showToast("↺ Restaurado"); }}>Sí, restaurar</button>
                    </div>
                </div>
            )}
        </>
    );
}
