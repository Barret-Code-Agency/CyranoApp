// src/screens/gerencia/DesignarSupervisoresPanel.jsx
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";

export default function DesignarSupervisoresPanel({ empresaId, onBack }) {
    const [legajos,  setLegajos]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [filtro,   setFiltro]   = useState("");
    const [toggling, setToggling] = useState(null); // docId en proceso

    useEffect(() => {
        if (!empresaId) return;
        getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)))
            .then(snap => {
                const docs = snap.docs
                    .map(d => ({ _docId: d.id, ...d.data() }))
                    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setLegajos(docs);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [empresaId]);

    const toggle = async (legajo) => {
        const nuevoValor = !legajo.esSupervisor;
        setToggling(legajo._docId);
        try {
            await updateDoc(doc(db, "legajos", legajo._docId), { esSupervisor: nuevoValor });
            setLegajos(prev =>
                prev.map(l => l._docId === legajo._docId ? { ...l, esSupervisor: nuevoValor } : l)
            );
        } catch (e) {
            console.error("toggle supervisor:", e);
        } finally {
            setToggling(null);
        }
    };

    const filtrados = filtro.length >= 2
        ? legajos.filter(l => (l.nombre || "").toLowerCase().includes(filtro.toLowerCase()) ||
                               (l.cargo  || "").toLowerCase().includes(filtro.toLowerCase()))
        : legajos;

    const supervisores = legajos.filter(l => l.esSupervisor);

    return (
        <>
            <button className="vh-back" onClick={onBack}>← Volver</button>
            <div className="vh-subpanel-title">👤 Designar Supervisores</div>

            {supervisores.length > 0 && (
                <div className="card" style={{ marginBottom: "var(--space-3)" }}>
                    <div className="card-title">Supervisores activos ({supervisores.length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                        {supervisores.map(s => (
                            <span key={s._docId} style={{
                                background: "var(--color-primary)",
                                color: "#fff",
                                borderRadius: "var(--radius-sm)",
                                padding: "2px 10px",
                                fontSize: "var(--text-sm)",
                            }}>
                                {s.nombre}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-title">Personal</div>
                <input
                    type="text"
                    placeholder="Filtrar por nombre o cargo..."
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    style={{ marginBottom: "var(--space-3)" }}
                />

                {loading && <div style={{ color: "var(--color-muted)", padding: "var(--space-3)" }}>Cargando personal…</div>}

                {!loading && filtrados.length === 0 && (
                    <div style={{ color: "var(--color-muted)", padding: "var(--space-2)" }}>Sin resultados.</div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {filtrados.map(l => (
                        <div key={l._docId} style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px var(--space-3)",
                            borderRadius: "var(--radius-sm)",
                            background: l.esSupervisor ? "rgba(59,130,246,0.08)" : "var(--color-surface2)",
                            border: l.esSupervisor ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                        }}>
                            <div>
                                <div style={{ fontWeight: l.esSupervisor ? 600 : 400, fontSize: "var(--text-sm)" }}>
                                    {l.nombre || "—"}
                                </div>
                                {(l.cargo || l.rol) && (
                                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                                        {l.cargo || l.rol}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => toggle(l)}
                                disabled={toggling === l._docId}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "var(--text-xs)",
                                    fontWeight: 600,
                                    background: l.esSupervisor ? "var(--color-primary)" : "var(--color-surface3, #e5e7eb)",
                                    color: l.esSupervisor ? "#fff" : "var(--color-text)",
                                    opacity: toggling === l._docId ? 0.6 : 1,
                                }}
                            >
                                {toggling === l._docId ? "…" : l.esSupervisor ? "✓ Supervisor" : "Designar"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
