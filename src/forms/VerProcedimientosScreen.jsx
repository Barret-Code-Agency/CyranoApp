// src/forms/VerProcedimientosScreen.jsx
// Vista del muro de procedimientos operativos.

import { useEffect, useState } from "react";
import { useAppData }          from "../context/AppDataContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db }                  from "../firebase";
import "./VerComunicacionesScreen.css"; // reutiliza estilos vc-*

function DetalleView({ item, onBack }) {
    return (
        <div className="vc-root">
            <header className="vc-header">
                <button className="vc-back" onClick={onBack}>← Volver</button>
                <span className="vc-header-title">📌 Procedimiento</span>
            </header>
            <div className="vc-detail-wrap">
                <div className="vc-detail-card">
                    {item.logoUrl && (
                        <div className="vc-detail-logo-wrap">
                            <img src={item.logoUrl} alt="" className="vc-detail-logo" />
                        </div>
                    )}
                    <div className="vc-detail-empresa">{item.empresa}</div>
                    <span className="vc-badge vc-badge--blue">{item.categoria}</span>
                    <h1 className="vc-detail-titulo">{item.titulo}</h1>
                    <div className="vc-detail-meta">
                        <span>🔖 Versión {item.version}</span>
                        <span>📅 {item.fecha}</span>
                        <span>✍️ {item.creadoPor}</span>
                    </div>
                    <div className="vc-detail-divider" />
                    <div className="vc-detail-cuerpo">{item.cuerpo}</div>
                </div>
            </div>
        </div>
    );
}

export default function VerProcedimientosScreen({ onBack }) {
    const { empresaNombre, empresaId } = useAppData();
    const [items,   setItems]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [selItem, setSelItem] = useState(null);

    useEffect(() => {
        if (!empresaId) return;
        const q = query(
            collection(db, "procedimientos"),
            where("empresaId", "==", empresaId)
        );
        getDocs(q)
            .then(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
                setItems(docs);
            })
            .catch(e  => setError(e.message))
            .finally(()=> setLoading(false));
    }, [empresaId]);

    if (selItem) return <DetalleView item={selItem} onBack={() => setSelItem(null)} />;

    return (
        <div className="vc-root">
            <div className="vc-body">
                {loading && <div className="vc-empty">Cargando procedimientos...</div>}
                {error   && <div className="vc-error">{error}</div>}
                {!loading && !error && items.length === 0 && (
                    <div className="vc-empty-state">
                        <div className="vc-empty-icon">📭</div>
                        <div className="vc-empty-text">No hay procedimientos publicados aún</div>
                    </div>
                )}
                {items.map(item => (
                    <button key={item.id} className="vc-card" onClick={() => setSelItem(item)}>
                        <div className="vc-card-top">
                            <span className="vc-badge vc-badge--blue">{item.categoria}</span>
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
                            <span>🔖 v{item.version}</span>
                            <span>✍️ {item.creadoPor}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
