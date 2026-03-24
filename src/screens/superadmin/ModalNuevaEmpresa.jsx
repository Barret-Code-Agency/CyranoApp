// src/screens/superadmin/ModalNuevaEmpresa.jsx
import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { MODULOS_DEF } from "../../config/roles";
import { setupEmpresa } from "../../utils/setupEmpresa";

export const MODULOS_DEFAULT = Object.fromEntries(
    MODULOS_DEF.flatMap(g => g.modulos.map(m => [m.key, true]))
);

export default function ModalNuevaEmpresa({ onCrear, onCerrar }) {
    const [form, setForm]       = useState({ id: "", nombre: "" });
    const [error, setError]     = useState("");
    const [loading, setLoading] = useState(false);

    const cambiar = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const crear = async () => {
        const id     = form.id.trim().toLowerCase().replace(/\s+/g, "_");
        const nombre = form.nombre.trim();
        if (!id)     return setError("El ID es requerido.");
        if (!nombre) return setError("El nombre es requerido.");
        setError(""); setLoading(true);
        try {
            const ref = doc(db, "empresas", id);
            await setDoc(ref, {
                nombre,
                activo:      true,
                plan:        "starter",
                vencimiento: null,
                modulos:     MODULOS_DEFAULT,
                creadoEn:    serverTimestamp(),
            });
            // Inicializar estructura de datos vacía para la empresa
            await setupEmpresa(id, nombre, MODULOS_DEFAULT);
            onCrear({ id, nombre, activo: true, modulos: MODULOS_DEFAULT });
        } catch (e) {
            setError("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sa-modal-overlay" onClick={onCerrar}>
            <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
                <div className="sa-modal-title">Nueva empresa</div>

                <div className="sa-ur-field">
                    <label className="sa-ur-label">ID de la empresa</label>
                    <input
                        className="sa-ur-input"
                        name="id"
                        value={form.id}
                        onChange={cambiar}
                        placeholder="ej: brinks"
                        autoFocus
                    />
                    <span className="sa-ur-hint">Sin espacios, en minúsculas. Ej: brinks, prosegur</span>
                </div>

                <div className="sa-ur-field">
                    <label className="sa-ur-label">Nombre visible</label>
                    <input
                        className="sa-ur-input"
                        name="nombre"
                        value={form.nombre}
                        onChange={cambiar}
                        placeholder="ej: Brinks Argentina"
                        onKeyDown={e => e.key === "Enter" && crear()}
                    />
                </div>

                {error && <div className="sa-msg sa-msg--err">{error}</div>}

                <div className="sa-modal-actions">
                    <button className="sa-ur-btn-save" onClick={crear} disabled={loading}>
                        {loading ? "Creando…" : "✅ Crear empresa"}
                    </button>
                    <button className="sa-ur-btn-cancel" onClick={onCerrar}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}
