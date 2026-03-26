// src/screens/admin/ConfigPanel.jsx
import { useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import EditableList from "./EditableList";

export default function ConfigPanel({ onUpdate, showToast }) {
    const { data, resetToDefaults } = useAppData();
    const [showReset, setShowReset] = useState(false);
    return (
        <>
            <EditableList icon="🔧" title="Tipos de actividad" dataKey="tiposActividad" items={data.tiposActividad} onUpdate={onUpdate} />
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
