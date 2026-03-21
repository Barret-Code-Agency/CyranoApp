// src/forms/SubirProcedimientoScreen.jsx
// Formulario para publicar un procedimiento operativo.

import { useState } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db }         from "../firebase";
import "./CrearComunicacionScreen.css"; // reutiliza mismos estilos cc-*

const CATEGORIAS = [
    "Protocolo de acceso",
    "Protocolo de emergencia",
    "Uso de equipos",
    "Rondas y vigilancia",
    "Atención al cliente",
    "Gestión de incidentes",
    "Otro",
];

export default function SubirProcedimientoScreen({ onBack }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaLogos } = useAppData();

    const now      = new Date();
    const fechaStr = now.toLocaleDateString("es-AR");
    const horaStr  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const [form, setForm] = useState({
        categoria: CATEGORIAS[0],
        titulo:    "",
        cuerpo:    "",
        version:   "1.0",
    });
    const [guardando,  setGuardando]  = useState(false);
    const [guardadoId, setGuardadoId] = useState(null);
    const [error,      setError]      = useState(null);

    const set = (field, val) => setForm(p => ({ ...p, [field]: val }));
    const canSubmit = form.titulo.trim() && form.cuerpo.trim();

    const handleGuardar = async () => {
        if (!canSubmit) return;
        setGuardando(true);
        setError(null);
        try {
            await addDoc(collection(db, "procedimientos"), {
                empresa:     empresaNombre  || "",
                categoria:   form.categoria,
                titulo:      form.titulo.trim(),
                cuerpo:      form.cuerpo.trim(),
                version:     form.version.trim() || "1.0",
                creadoPor:   user?.name     || "",
                creadoPorId: user?.uid      || "",
                logoUrl:     empresaLogos?.panel || null,
                fecha:       fechaStr,
                hora:        horaStr,
                creadoEn:    serverTimestamp(),
            });
            setGuardadoId(true);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    if (guardadoId) {
        return (
            <div className="cc-root">
                <div className="cc-success">
                    <div className="cc-success-icon">✅</div>
                    <h2 className="cc-success-title">Procedimiento publicado</h2>
                    <p className="cc-success-sub">
                        Ya es visible para todos los usuarios de la empresa.
                    </p>
                    <button className="cc-btn cc-btn--ghost" onClick={onBack}>← Volver</button>
                </div>
            </div>
        );
    }

    return (
        <div className="cc-root">
            <header className="cc-header">
                <button className="cc-back" onClick={onBack}>← Volver</button>
                <span className="cc-header-title">📌 Subir Procedimiento</span>
            </header>

            <div className="cc-body">

                <div className="cc-doc-header">
                    {empresaLogos?.panel && (
                        <img src={empresaLogos.panel} alt={empresaNombre} className="cc-doc-logo" />
                    )}
                    <div className="cc-doc-empresa">{empresaNombre}</div>
                    <div className="cc-doc-fecha">{fechaStr} — {horaStr}</div>
                </div>

                <div className="cc-field">
                    <label className="cc-label">Categoría</label>
                    <select
                        className="cc-input"
                        value={form.categoria}
                        onChange={e => set("categoria", e.target.value)}
                        style={{ cursor: "pointer" }}
                    >
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="cc-field">
                    <label className="cc-label">Título del procedimiento</label>
                    <input
                        className="cc-input"
                        value={form.titulo}
                        onChange={e => set("titulo", e.target.value)}
                        placeholder="Ej: Protocolo de acceso vehicular"
                    />
                </div>

                <div className="cc-field">
                    <label className="cc-label">Versión</label>
                    <input
                        className="cc-input"
                        value={form.version}
                        onChange={e => set("version", e.target.value)}
                        placeholder="Ej: 1.0"
                        style={{ maxWidth: 120 }}
                    />
                </div>

                <div className="cc-field">
                    <label className="cc-label">Contenido del procedimiento</label>
                    <textarea
                        className="cc-textarea"
                        value={form.cuerpo}
                        onChange={e => set("cuerpo", e.target.value)}
                        placeholder="Describí los pasos y lineamientos del procedimiento..."
                        rows={10}
                    />
                </div>

                <div className="cc-confeccion-row">
                    <div className="cc-confeccion-field">
                        <span className="cc-label">Publicado por</span>
                        <span className="cc-readonly-val">{user?.name || "—"}</span>
                    </div>
                    <div className="cc-confeccion-field">
                        <span className="cc-label">Fecha</span>
                        <span className="cc-readonly-val">{fechaStr}</span>
                    </div>
                </div>

                {error && <div className="cc-error">{error}</div>}

                <div className="cc-submit-area">
                    <button
                        className="cc-btn cc-btn--primary cc-btn--full"
                        onClick={handleGuardar}
                        disabled={!canSubmit || guardando}
                    >
                        {guardando ? "Publicando..." : "📌 Publicar procedimiento"}
                    </button>
                    <p className="cc-submit-note">Quedará disponible para todo el personal</p>
                </div>

            </div>
        </div>
    );
}
