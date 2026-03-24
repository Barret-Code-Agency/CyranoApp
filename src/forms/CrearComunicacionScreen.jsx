// src/forms/CrearComunicacionScreen.jsx
// Formulario para publicar una comunicación o novedad en el muro.

import { useState, useMemo } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db }         from "../firebase";
import "./CrearComunicacionScreen.css";

const TIPOS = [
    { value: "comunicacion", label: "📢 Comunicación" },
    { value: "novedad",      label: "🔔 Novedad"      },
];

export default function CrearComunicacionScreen({ onBack }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaLogos, empresaId, userZona } = useAppData();

    const now     = new Date();
    const fechaStr = now.toLocaleDateString("es-AR");
    const horaStr  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const numeroCom = useMemo(() => {
        const d    = new Date();
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, "0");
        const dd   = String(d.getDate()).padStart(2, "0");
        const rand = String(Math.floor(Math.random() * 9000) + 1000);
        return `COM-${yyyy}${mm}${dd}-${rand}`;
    }, []);

    const [form, setForm] = useState({
        tipo:   "comunicacion",
        titulo: "",
        cuerpo: "",
        para:   "",
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
            const docRef = await addDoc(collection(db, "comunicaciones"), {
                numero:      numeroCom,
                empresaId:   empresaId      || "",
                empresa:     empresaNombre  || "",
                zona:        userZona       || null,
                tipo:        form.tipo,
                titulo:      form.titulo.trim(),
                cuerpo:      form.cuerpo.trim(),
                para:        form.para.trim(),
                creadoPor:   user?.name     || "",
                creadoPorId: user?.uid      || "",
                logoUrl:     empresaLogos?.panel || null,
                fecha:       fechaStr,
                hora:        horaStr,
                creadoEn:    serverTimestamp(),
            });
            setGuardadoId(docRef.id);
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
                    <h2 className="cc-success-title">Comunicación publicada</h2>
                    <div className="cc-success-codigo">{numeroCom}</div>
                    <p className="cc-success-sub">
                        Ya es visible para todos los usuarios de la empresa.
                    </p>
                    <button className="cc-btn cc-btn--ghost" onClick={onBack}>← Volver al panel</button>
                </div>
            </div>
        );
    }

    return (
        <div className="cc-root">
            <div className="cc-subpanel-top">
                <button className="cc-back" onClick={onBack}>← Volver al panel</button>
                <div className="cc-titulo">📢 Nueva Comunicación</div>
            </div>

            {/* ── Tarjeta de trazabilidad ── */}
            <div className="cc-id-card">
                <div className="cc-id-row">
                    <span className="cc-id-label">Número</span>
                    <span className="cc-id-val cc-id-val--num">{numeroCom}</span>
                </div>
                <div className="cc-id-row">
                    <span className="cc-id-label">Fecha</span>
                    <span className="cc-id-val">{fechaStr}</span>
                </div>
                <div className="cc-id-row">
                    <span className="cc-id-label">Publicado por</span>
                    <span className="cc-id-val">{user?.name || "—"}</span>
                </div>
                <div className="cc-id-row">
                    <span className="cc-id-label">Empresa</span>
                    <span className="cc-id-val">{empresaNombre || "—"}</span>
                </div>
            </div>

            <div className="cc-body">

                {/* ── Cabecera del documento con logo ── */}
                <div className="cc-doc-header">
                    {empresaLogos?.panel && (
                        <img src={empresaLogos.panel} alt={empresaNombre} className="cc-doc-logo" />
                    )}
                    <div className="cc-doc-empresa">{empresaNombre}</div>
                    <div className="cc-doc-fecha">{fechaStr} — {horaStr}</div>
                </div>

                {/* ── Tipo ── */}
                <div className="cc-field">
                    <label className="cc-label">Tipo de publicación</label>
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

                {/* ── Título ── */}
                <div className="cc-field">
                    <label className="cc-label">Título</label>
                    <input
                        className="cc-input"
                        value={form.titulo}
                        onChange={e => set("titulo", e.target.value)}
                        placeholder="Ej: Actualización de protocolo de acceso"
                    />
                </div>

                {/* ── Contenido ── */}
                <div className="cc-field">
                    <label className="cc-label">Contenido</label>
                    <textarea
                        className="cc-textarea"
                        value={form.cuerpo}
                        onChange={e => set("cuerpo", e.target.value)}
                        placeholder="Redactá el mensaje aquí..."
                        rows={8}
                    />
                </div>

                {/* ── Dirigida a ── */}
                <div className="cc-field">
                    <label className="cc-label">Dirigida a (opcional)</label>
                    <input
                        className="cc-input"
                        value={form.para}
                        onChange={e => set("para", e.target.value)}
                        placeholder="Ej: Todo el personal, Supervisores de zona norte..."
                    />
                </div>

                {/* ── Publicado por (readonly) ── */}
                <div className="cc-confeccion-row">
                    <div className="cc-confeccion-field">
                        <span className="cc-label">Publicado por</span>
                        <span className="cc-readonly-val">{user?.name || "—"}</span>
                    </div>
                    <div className="cc-confeccion-field">
                        <span className="cc-label">Fecha</span>
                        <span className="cc-readonly-val">{fechaStr}</span>
                    </div>
                    <div className="cc-confeccion-field">
                        <span className="cc-label">Hora</span>
                        <span className="cc-readonly-val">{horaStr}</span>
                    </div>
                </div>

                {error && <div className="cc-error">{error}</div>}

                <div className="cc-submit-area">
                    <button
                        className="cc-btn cc-btn--primary cc-btn--full"
                        onClick={handleGuardar}
                        disabled={!canSubmit || guardando}
                    >
                        {guardando ? "Publicando..." : "📢 Publicar comunicación"}
                    </button>
                    <p className="cc-submit-note">Una vez publicada será visible para todos los usuarios</p>
                </div>

            </div>
        </div>
    );
}
