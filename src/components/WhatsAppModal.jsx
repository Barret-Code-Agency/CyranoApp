// src/components/WhatsAppModal.jsx
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { enviarWhatsApp } from "../utils/whatsapp";
import "./WhatsAppModal.css";

export default function WhatsAppModal({ onClose }) {
    const { user } = useAuth();
    const [num,    setNum]    = useState("");
    const [key,    setKey]    = useState("");
    const [saving, setSaving] = useState(false);
    const [testing,setTesting]= useState(false);
    const [msg,    setMsg]    = useState(null); // { tipo: "ok"|"err", texto }

    useEffect(() => {
        if (!user?.uid) return;
        getDoc(doc(db, "usuarios", user.uid)).then(snap => {
            if (snap.exists()) {
                setNum(snap.data().whatsappNum || "");
                setKey(snap.data().callmebotKey || "");
            }
        });
    }, [user?.uid]);

    const guardar = async () => {
        if (!num.trim() || !key.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "usuarios", user.uid), {
                whatsappNum:   num.trim(),
                callmebotKey:  key.trim(),
            });
            setMsg({ tipo: "ok", texto: "✅ Guardado correctamente" });
        } catch {
            setMsg({ tipo: "err", texto: "❌ Error al guardar" });
        } finally {
            setSaving(false);
        }
    };

    const probar = async () => {
        if (!num.trim() || !key.trim()) return;
        setTesting(true);
        setMsg(null);
        try {
            await enviarWhatsApp(num.trim(), key.trim(), "✅ AppSup: configuración de WhatsApp correcta.");
            setMsg({ tipo: "ok", texto: "✅ Mensaje de prueba enviado" });
        } catch {
            setMsg({ tipo: "err", texto: "❌ Error al enviar prueba" });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="wa-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="wa-modal">
                <div className="wa-header">
                    <span className="wa-title">📱 Configurar WhatsApp</span>
                    <button className="wa-close" onClick={onClose}>✕</button>
                </div>

                <div className="wa-instrucciones">
                    <strong>Cómo activar CallMeBot:</strong>
                    <ol>
                        <li>Agregá el número <strong>+34 644 59 62 91</strong> a tus contactos</li>
                        <li>Enviá este mensaje por WhatsApp:<br />
                            <code>I allow callmebot to send me messages</code>
                        </li>
                        <li>Recibirás tu <strong>API key</strong> por WhatsApp</li>
                        <li>Ingresá tu número y la key abajo</li>
                    </ol>
                </div>

                <div className="wa-campo">
                    <label>Tu número de WhatsApp</label>
                    <input
                        className="wa-input"
                        placeholder="549XXXXXXXXXX (sin + ni espacios)"
                        value={num}
                        onChange={e => setNum(e.target.value)}
                    />
                    <small>Formato argentino: 549 + código de área + número (ej: 5491155556677)</small>
                </div>

                <div className="wa-campo">
                    <label>API Key de CallMeBot</label>
                    <input
                        className="wa-input"
                        placeholder="XXXXXXXX"
                        value={key}
                        onChange={e => setKey(e.target.value)}
                    />
                </div>

                {msg && (
                    <div className={`wa-msg wa-msg--${msg.tipo}`}>{msg.texto}</div>
                )}

                <div className="wa-actions">
                    <button className="wa-btn wa-btn--ghost" onClick={probar} disabled={testing || !num || !key}>
                        {testing ? "Enviando…" : "Enviar prueba"}
                    </button>
                    <button className="wa-btn wa-btn--primary" onClick={guardar} disabled={saving || !num || !key}>
                        {saving ? "Guardando…" : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
