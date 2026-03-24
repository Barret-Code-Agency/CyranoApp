// src/screens/vigilador/TokensScreen.jsx

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import {
    doc, getDoc, collection, query, where, orderBy,
    getDocs, addDoc, serverTimestamp,
} from "firebase/firestore";
import "./TokensScreen.css";

export default function TokensScreen({ onBack }) {
    const { user } = useAuth();
    const [saldo,     setSaldo]     = useState(null);
    const [movs,      setMovs]      = useState([]);
    const [premios,   setPremios]   = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [canjeando, setCanjeando] = useState(null);
    const [canjeOk,   setCanjeOk]   = useState(null);
    const [vista,     setVista]     = useState(null); // null | "historial" | "canje"

    useEffect(() => {
        if (!user?.uid || !user?.empresaId) { setLoading(false); return; }
        Promise.all([
            getDoc(doc(db, "tokens", user.uid)),
            getDocs(query(
                collection(db, "tokensMovimientos"),
                where("uid", "==", user.uid),
                orderBy("creadoEn", "desc"),
            )).catch(() => getDocs(query(
                collection(db, "tokensMovimientos"),
                where("uid", "==", user.uid),
            ))),
            getDocs(query(
                collection(db, "premios"),
                where("empresaId", "==", user.empresaId),
                where("activo", "==", true),
            )).catch(() => ({ docs: [] })),
        ]).then(([tokenSnap, movsSnap, premiosSnap]) => {
            setSaldo(tokenSnap.exists() ? (tokenSnap.data().saldo ?? 0) : 0);
            setMovs(movsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setPremios(premiosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(console.error).finally(() => setLoading(false));
    }, [user?.uid, user?.empresaId]);

    const solicitarCanje = async (premio) => {
        if (!user?.uid || !user?.empresaId) return;
        if (saldo < premio.costo) return;
        if (!confirm(`¿Canjear "${premio.nombre}" por ${premio.costo} tokens?`)) return;
        setCanjeando(premio.id);
        try {
            await addDoc(collection(db, "canjes"), {
                uid:          user.uid,
                nombre:       user.name || user.email || "",
                empresaId:    user.empresaId,
                premioId:     premio.id,
                premioNombre: premio.nombre,
                costo:        premio.costo,
                estado:       "pendiente",
                creadoEn:     serverTimestamp(),
            });
            setCanjeOk(premio.nombre);
            setSaldo(s => s - premio.costo);
        } catch (e) {
            console.error(e);
            alert("Error al solicitar el canje. Intentá de nuevo.");
        } finally {
            setCanjeando(null);
        }
    };

    // ── Vista Historial ──
    if (vista === "historial") return (
        <div className="tok-root">
            <div className="tok-subpanel">
                <button className="tok-back" onClick={() => setVista(null)}>← Volver al panel</button>
                <div className="tok-header-title">📋 Historial</div>
                <div className="tok-grid">
                    {loading ? (
                        <div className="tok-empty">Cargando...</div>
                    ) : movs.length === 0 ? (
                        <div className="tok-empty">Todavía no tenés movimientos.</div>
                    ) : movs.map(m => {
                        const fecha = m.creadoEn?.toDate?.()?.toLocaleDateString("es-AR") ?? "";
                        return (
                            <div key={m.id} className="tok-mov">
                                <div className="tok-mov-info">
                                    <div className="tok-mov-motivo">{m.motivo}</div>
                                    <div className="tok-mov-fecha">{fecha}</div>
                                </div>
                                <div className={`tok-mov-cant ${m.cantidad > 0 ? "tok-mov-cant--pos" : "tok-mov-cant--neg"}`}>
                                    {m.cantidad > 0 ? "+" : ""}{m.cantidad}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    // ── Vista Canje ──
    if (vista === "canje") {
        if (canjeOk) return (
            <div className="tok-root">
                <div className="tok-subpanel">
                    <button className="tok-back" onClick={() => { setCanjeOk(null); setVista(null); }}>← Volver al panel</button>
                    <div className="tok-header-title">🎁 Canje</div>
                    <div className="tok-ok">
                        <div className="tok-ok-icon">🎉</div>
                        <div className="tok-ok-title">¡Canje solicitado!</div>
                        <div className="tok-ok-sub">Pediste <strong>{canjeOk}</strong>. Un administrador lo aprobará pronto.</div>
                        <button className="tok-btn-primary" onClick={() => setCanjeOk(null)}>Ver mis tokens</button>
                    </div>
                </div>
            </div>
        );
        return (
            <div className="tok-root">
                <div className="tok-subpanel">
                    <button className="tok-back" onClick={() => setVista(null)}>← Volver al panel</button>
                    <div className="tok-header-title">🎁 Canje</div>
                    <div className="tok-grid">
                        {loading ? (
                            <div className="tok-empty">Cargando...</div>
                        ) : premios.length === 0 ? (
                            <div className="tok-empty">No hay premios disponibles por ahora.</div>
                        ) : premios.map(p => (
                            <div key={p.id} className={`tok-premio ${saldo < p.costo ? "tok-premio--bloq" : ""}`}>
                                <div className="tok-premio-info">
                                    <div className="tok-premio-nombre">{p.icon ?? "🎁"} {p.nombre}</div>
                                    {p.desc && <div className="tok-premio-desc">{p.desc}</div>}
                                    <div className="tok-premio-costo">{p.costo} tokens</div>
                                </div>
                                <button
                                    className="tok-btn-canjear"
                                    disabled={saldo < p.costo || canjeando === p.id}
                                    onClick={() => solicitarCanje(p)}
                                >
                                    {canjeando === p.id ? "..." : saldo < p.costo ? "Sin saldo" : "Canjear"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Vista principal ──
    return (
        <div className="tok-root">
            <div className="tok-subpanel">
                <button className="tok-back" onClick={onBack}>← Volver al panel</button>
                <div className="tok-header-title">🎟️ Mis Tokens</div>
                <div className="tok-grid">
                    <div className="tok-saldo-card">
                        <div className="tok-saldo-label">Tu saldo actual de tokens es</div>
                        <div className="tok-saldo-num">{saldo === null ? "..." : saldo}</div>
                    </div>
                    <div className="tok-acciones">
                        <button className="tok-accion" onClick={() => setVista("historial")}>
                            <span className="tok-accion-icon">📋</span>
                            <strong>Historial</strong>
                        </button>
                        <button className="tok-accion" onClick={() => setVista("canje")}>
                            <span className="tok-accion-icon">🎁</span>
                            <strong>Canje</strong>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
