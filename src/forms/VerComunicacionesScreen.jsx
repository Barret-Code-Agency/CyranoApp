// src/forms/VerComunicacionesScreen.jsx
// Vista del muro de comunicaciones — muestra todas las publicaciones de la empresa.

import { useEffect, useState } from "react";
import { useAppData }          from "../context/AppDataContext";
import {
    collection, query, where, getDocs,
    deleteDoc, doc, updateDoc, arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import "./VerComunicacionesScreen.css";

const TIPO_META = {
    comunicacion: { label: "Comunicación", color: "blue"  },
    novedad:      { label: "Novedad",      color: "amber" },
};

function TipoBadge({ tipo }) {
    const meta = TIPO_META[tipo] ?? TIPO_META.comunicacion;
    return <span className={`vc-badge vc-badge--${meta.color}`}>{meta.label}</span>;
}

// ── Vista de detalle ────────────────────────────────────────────────────────
function DetalleView({ item, onBack }) {
    return (
        <div className="vc-root">
            <div className="vc-subpanel-top">
                <button className="vc-back" onClick={onBack}>← Volver</button>
                <div className="vc-titulo">📢 Comunicación</div>
            </div>

            <div className="vc-detail-wrap">
                <div className="vc-detail-card">
                    {/* Logo + empresa */}
                    {item.logoUrl && (
                        <div className="vc-detail-logo-wrap">
                            <img src={item.logoUrl} alt="" className="vc-detail-logo" />
                        </div>
                    )}
                    <div className="vc-detail-empresa">{item.empresa}</div>
                    {item.numero && (
                        <div className="vc-detail-numero">{item.numero}</div>
                    )}

                    <TipoBadge tipo={item.tipo} />

                    <h1 className="vc-detail-titulo">{item.titulo}</h1>

                    <div className="vc-detail-meta">
                        <span>📅 {item.fecha}{item.hora ? ` — ${item.hora}` : ""}</span>
                        {item.para && <span>👥 Dirigido a: {item.para}</span>}
                        <span>✍️ {item.creadoPor}</span>
                    </div>

                    <div className="vc-detail-divider" />

                    <div className="vc-detail-cuerpo">{item.cuerpo}</div>
                </div>
            </div>
        </div>
    );
}

// ── Vista principal ─────────────────────────────────────────────────────────
export default function VerComunicacionesScreen({ onBack, canDelete = false, currentUserId = null }) {
    const { empresaId, userZona } = useAppData();
    const [items,      setItems]      = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [selItem,    setSelItem]    = useState(null);
    const [borrando,   setBorrando]   = useState(null);  // id del item en proceso de borrado

    useEffect(() => {
        if (!empresaId) return;
        const q = query(
            collection(db, "comunicaciones"),
            where("empresaId", "==", empresaId)
        );
        getDocs(q)
            .then(snap => {
                let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (userZona) {
                    docs = docs.filter(d => !d.zona || d.zona === userZona);
                }
                docs.sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
                setItems(docs);
            })
            .catch(e  => setError(e.message))
            .finally(() => setLoading(false));
    }, [empresaId, userZona]);

    // Abrir detalle y marcar como leída
    const handleAbrir = async (item) => {
        setSelItem(item);
        if (!currentUserId) return;
        if ((item.leidoPor || []).includes(currentUserId)) return;
        try {
            await updateDoc(doc(db, "comunicaciones", item.id), {
                leidoPor: arrayUnion(currentUserId),
            });
            // Actualizar estado local para que el calendario se refresque al volver
            setItems(prev => prev.map(i =>
                i.id === item.id
                    ? { ...i, leidoPor: [...(i.leidoPor || []), currentUserId] }
                    : i
            ));
        } catch (e) { /* sin bloquear */ }
    };

    // Borrar comunicación
    const handleBorrar = async (item) => {
        if (!window.confirm(`¿Eliminar la comunicación "${item.titulo}"? Esta acción no se puede deshacer.`)) return;
        setBorrando(item.id);
        try {
            await deleteDoc(doc(db, "comunicaciones", item.id));
            setItems(prev => prev.filter(i => i.id !== item.id));
            if (selItem?.id === item.id) setSelItem(null);
        } catch (e) {
            alert("Error al eliminar: " + e.message);
        } finally {
            setBorrando(null);
        }
    };

    if (selItem) return <DetalleView item={selItem} onBack={() => setSelItem(null)} />;

    return (
        <div className="vc-root">
            <div className="vc-subpanel-top">
                <button className="vc-back" onClick={onBack}>← Volver al panel</button>
                <div className="vc-titulo">📢 Muro de Comunicación y Novedades</div>
            </div>

            <div className="vc-body">
                {loading && <div className="vc-empty">Cargando comunicaciones...</div>}
                {error   && <div className="vc-error">{error}</div>}

                {!loading && !error && items.length === 0 && (
                    <div className="vc-empty-state">
                        <div className="vc-empty-icon">📭</div>
                        <div className="vc-empty-text">No hay comunicaciones publicadas aún</div>
                    </div>
                )}

                {items.map(item => {
                    const leida = currentUserId && (item.leidoPor || []).includes(currentUserId);
                    return (
                        <div key={item.id} className={`vc-card-wrap${leida ? " vc-card-wrap--leida" : ""}`}>
                            <button className="vc-card" onClick={() => handleAbrir(item)}>
                                <div className="vc-card-top">
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <TipoBadge tipo={item.tipo} />
                                        {!leida && <span className="vc-unread-dot" title="No leída" />}
                                    </div>
                                    <span className="vc-card-fecha">{item.fecha}</span>
                                </div>

                                {item.logoUrl && (
                                    <img src={item.logoUrl} alt="" className="vc-card-logo" />
                                )}

                                <div className="vc-card-titulo">{item.titulo}</div>
                                <div className="vc-card-preview">
                                    {item.cuerpo.slice(0, 140)}{item.cuerpo.length > 140 ? "…" : ""}
                                </div>

                                <div className="vc-card-footer">
                                    {item.para && <span>👥 {item.para}</span>}
                                    <span>✍️ {item.creadoPor}</span>
                                </div>
                            </button>

                            {canDelete && (
                                <button
                                    className="vc-btn-borrar"
                                    onClick={() => handleBorrar(item)}
                                    disabled={borrando === item.id}
                                    title="Eliminar comunicación"
                                >
                                    {borrando === item.id ? "⏳" : "🗑️"}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
