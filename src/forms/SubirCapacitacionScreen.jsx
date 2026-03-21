// src/forms/SubirCapacitacionScreen.jsx
// Formulario para publicar un curso o material de capacitación.

import { useState } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db }         from "../firebase";
import "./CrearComunicacionScreen.css"; // reutiliza estilos cc-*

const CATEGORIAS = [
    "Seguridad privada",
    "Primeros auxilios",
    "Uso de equipos",
    "Atención al cliente",
    "Legislación vigente",
    "Procedimientos internos",
    "Otro",
];

const TIPOS = [
    { value: "curso",     label: "🎓 Curso" },
    { value: "material",  label: "📖 Material de lectura" },
    { value: "video",     label: "🎥 Video" },
    { value: "evaluacion",label: "📝 Evaluación" },
];

export default function SubirCapacitacionScreen({ onBack }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaLogos } = useAppData();

    const now      = new Date();
    const fechaStr = now.toLocaleDateString("es-AR");
    const horaStr  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const [form, setForm] = useState({
        tipo:      "curso",
        categoria: CATEGORIAS[0],
        titulo:    "",
        descripcion: "",
        duracion:  "",
        linkExterno: "",
    });
    const [guardando,  setGuardando]  = useState(false);
    const [guardadoId, setGuardadoId] = useState(null);
    const [error,      setError]      = useState(null);

    const set = (field, val) => setForm(p => ({ ...p, [field]: val }));
    const canSubmit = form.titulo.trim() && form.descripcion.trim();

    const handleGuardar = async () => {
        if (!canSubmit) return;
        setGuardando(true);
        setError(null);
        try {
            await addDoc(collection(db, "capacitaciones"), {
                empresa:      empresaNombre   || "",
                tipo:         form.tipo,
                categoria:    form.categoria,
                titulo:       form.titulo.trim(),
                descripcion:  form.descripcion.trim(),
                duracion:     form.duracion.trim(),
                linkExterno:  form.linkExterno.trim(),
                creadoPor:    user?.name      || "",
                creadoPorId:  user?.uid       || "",
                logoUrl:      empresaLogos?.panel || null,
                fecha:        fechaStr,
                hora:         horaStr,
                creadoEn:     serverTimestamp(),
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
                    <h2 className="cc-success-title">Capacitación publicada</h2>
                    <p className="cc-success-sub">
                        Ya está disponible para todos los usuarios de la empresa.
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
                <span className="cc-header-title">🎓 Subir Capacitación</span>
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
                    <label className="cc-label">Tipo</label>
                    <div className="cc-tipo-row">
                        {TIPOS.map(t => (
                            <button
                                key={t.value}
                                className={`cc-tipo-btn ${form.tipo === t.value ? "cc-tipo-btn--on" : ""}`}
                                onClick={() => set("tipo", t.value)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
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
                    <label className="cc-label">Título</label>
                    <input
                        className="cc-input"
                        value={form.titulo}
                        onChange={e => set("titulo", e.target.value)}
                        placeholder="Ej: Primeros auxilios básicos"
                    />
                </div>

                <div className="cc-field">
                    <label className="cc-label">Descripción / Contenido</label>
                    <textarea
                        className="cc-textarea"
                        value={form.descripcion}
                        onChange={e => set("descripcion", e.target.value)}
                        placeholder="Describí los objetivos y contenido de la capacitación..."
                        rows={7}
                    />
                </div>

                <div className="cc-field">
                    <label className="cc-label">Duración estimada (opcional)</label>
                    <input
                        className="cc-input"
                        value={form.duracion}
                        onChange={e => set("duracion", e.target.value)}
                        placeholder="Ej: 2 horas, 30 minutos"
                        style={{ maxWidth: 200 }}
                    />
                </div>

                <div className="cc-field">
                    <label className="cc-label">Link externo (opcional)</label>
                    <input
                        className="cc-input"
                        value={form.linkExterno}
                        onChange={e => set("linkExterno", e.target.value)}
                        placeholder="https://..."
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
                        {guardando ? "Publicando..." : "🎓 Publicar capacitación"}
                    </button>
                    <p className="cc-submit-note">Quedará disponible para todo el personal</p>
                </div>

            </div>
        </div>
    );
}
