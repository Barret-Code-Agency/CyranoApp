// src/forms/VerCapacitacionesScreen.jsx
// Vista de cursos y materiales de capacitación disponibles.

import { useEffect, useState } from "react";
import { useAppData }          from "../context/AppDataContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db }                  from "../firebase";
import "./VerComunicacionesScreen.css"; // reutiliza estilos vc-*

const TIPO_META = {
    curso:      { label: "Curso",               color: "blue"  },
    material:   { label: "Material de lectura", color: "amber" },
    video:      { label: "Video",               color: "blue"  },
    evaluacion: { label: "Evaluación",          color: "amber" },
};

function TipoBadge({ tipo }) {
    const meta = TIPO_META[tipo] ?? { label: tipo, color: "blue" };
    return <span className={`vc-badge vc-badge--${meta.color}`}>{meta.label}</span>;
}

function DetalleView({ item, onBack }) {
    return (
        <div className="vc-root">
            <header className="vc-header">
                <button className="vc-back" onClick={onBack}>← Volver</button>
                <span className="vc-header-title">🎓 Capacitación</span>
            </header>
            <div className="vc-detail-wrap">
                <div className="vc-detail-card">
                    {item.logoUrl && (
                        <div className="vc-detail-logo-wrap">
                            <img src={item.logoUrl} alt="" className="vc-detail-logo" />
                        </div>
                    )}
                    <div className="vc-detail-empresa">{item.empresa}</div>
                    <TipoBadge tipo={item.tipo} />
                    <h1 className="vc-detail-titulo">{item.titulo}</h1>
                    <div className="vc-detail-meta">
                        <span>📂 {item.categoria}</span>
                        {item.duracion && <span>⏱️ {item.duracion}</span>}
                        <span>📅 {item.fecha}</span>
                        <span>✍️ {item.creadoPor}</span>
                    </div>
                    <div className="vc-detail-divider" />
                    <div className="vc-detail-cuerpo">{item.descripcion}</div>
                    {item.linkExterno && (
                        <a
                            href={item.linkExterno}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vc-link-externo"
                        >
                            🔗 Acceder al material
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VerCapacitacionesScreen({ onBack }) {
    const { empresaNombre } = useAppData();
    const [items,   setItems]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [selItem, setSelItem] = useState(null);

    useEffect(() => {
        if (!empresaNombre) return;
        const q = query(
            collection(db, "capacitaciones"),
            where("empresa", "==", empresaNombre)
        );
        getDocs(q)
            .then(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (b.creadoEn?.seconds ?? 0) - (a.creadoEn?.seconds ?? 0));
                setItems(docs);
            })
            .catch(e  => setError(e.message))
            .finally(()=> setLoading(false));
    }, [empresaNombre]);

    if (selItem) return <DetalleView item={selItem} onBack={() => setSelItem(null)} />;

    return (
        <div className="vc-root">
            <header className="vc-header">
                <button className="vc-back" onClick={onBack}>← Volver</button>
                <span className="vc-header-title">🎓 Capacitación y Entrenamiento</span>
            </header>
            <div className="vc-body">
                {loading && <div className="vc-empty">Cargando capacitaciones...</div>}
                {error   && <div className="vc-error">{error}</div>}
                {!loading && !error && items.length === 0 && (
                    <div className="vc-empty-state">
                        <div className="vc-empty-icon">📭</div>
                        <div className="vc-empty-text">No hay capacitaciones disponibles aún</div>
                    </div>
                )}
                {items.map(item => (
                    <button key={item.id} className="vc-card" onClick={() => setSelItem(item)}>
                        <div className="vc-card-top">
                            <TipoBadge tipo={item.tipo} />
                            <span className="vc-card-fecha">{item.fecha}</span>
                        </div>
                        {item.logoUrl && (
                            <img src={item.logoUrl} alt="" className="vc-card-logo" />
                        )}
                        <div className="vc-card-titulo">{item.titulo}</div>
                        <div className="vc-card-preview">
                            {item.descripcion.slice(0, 140)}{item.descripcion.length > 140 ? "…" : ""}
                        </div>
                        <div className="vc-card-footer">
                            <span>📂 {item.categoria}</span>
                            {item.duracion && <span>⏱️ {item.duracion}</span>}
                            <span>✍️ {item.creadoPor}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
