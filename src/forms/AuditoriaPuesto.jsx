// src/forms/AuditoriaPuesto.jsx
// Auditoría de seguridad en puesto — con puntaje en tiempo real,
// categorías agrupadas, Firebase y campos de encabezado.
import { useState, useMemo } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAppData } from "../context/AppDataContext";
import "./AuditoriaPuesto.css";

// ── Items de auditoría agrupados ─────────────────────────────────────────────
const CATEGORIAS = [
    {
        id: "presencia",
        label: "Presencia",
        icon: "🧍",
        color: "#1565c0",
        items: [
            "Uniforme completo, limpio y en buen estado",
            "Portación de credencial identificatoria visible",
            "Aseo personal y postura profesional",
            "Ausencia de distracciones (uso de celular personal)",
            "Puntualidad y presencia en el puesto asignado",
        ],
    },
    {
        id: "registros",
        label: "Registros",
        icon: "📒",
        color: "#6a1b9a",
        items: [
            "Libro de Novedades sin tachaduras ni hojas arrancadas",
            "Relación lógica entre hora de registro y evento real",
            "Caligrafía legible y prolijidad en el archivo",
            "Firma y cierre de guardia correctamente ejecutado",
            "Planillas de visitas/proveedores con datos completos",
        ],
    },
    {
        id: "consignas",
        label: "Consignas",
        icon: "📋",
        color: "#2e7d32",
        items: [
            "Conocimiento del Plan de Emergencia y Evacuación",
            "Dominio de protocolos específicos del objetivo",
            "Identificación de números de emergencia y contactos clave",
            "Manejo fluido de sistemas de monitoreo/alarmas",
            "Correcto tratamiento y escalado de novedades críticas",
        ],
    },
    {
        id: "instalaciones",
        label: "Instalaciones",
        icon: "🏗️",
        color: "#e65100",
        items: [
            "Orden y limpieza general de la garita o puesto",
            "Visibilidad óptima (vidrios limpios, sin obstáculos)",
            "Estado y carga de equipos de comunicación",
            "Funcionamiento de elementos de ronda (bastón/puntos)",
            "Disponibilidad y estado de EPP (chalecos, linternas)",
        ],
    },
    {
        id: "operatividad",
        label: "Operatividad",
        icon: "⚙️",
        color: "#37474f",
        items: [
            "Verificación física de cierres, candados y perímetros",
            "Reporte de luminarias o zonas ciegas detectadas",
            "Estado de integridad de cercos y muros perimetrales",
            "Carpeta de Servicio completa y actualizada",
            "Entrevista de satisfacción/feedback con el cliente",
        ],
    },
];

// Aplanar a preguntas con id global y referencia a categoría
const PREGUNTAS = CATEGORIAS.flatMap((cat, ci) =>
    cat.items.map((text, ii) => ({
        id: `${cat.id}_${ii}`,
        catId: cat.id,
        text,
    }))
);

const TOTAL_PUNTOS = PREGUNTAS.length * 2;

function colorScore(pct) {
    if (pct >= 80) return "#2e7d32";
    if (pct >= 60) return "#f57f17";
    return "#c62828";
}

function labelScore(pct) {
    if (pct >= 80) return "CONFORME";
    if (pct >= 60) return "PARCIAL";
    return "NO CONFORME";
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function AuditoriaPuesto({ onSave }) {
    const { empresaNombre } = useAppData();

    // Encabezado
    const [cabecera, setCabecera] = useState({
        objetivo:  "",
        puesto:    "",
        vigilador: "",
        auditor:   "",
        fecha:     new Date().toISOString().slice(0, 10),
    });

    // Respuestas: { [preguntaId]: 0 | 1 | 2 }
    const [respuestas, setRespuestas] = useState({});
    const [observaciones, setObservaciones] = useState("");
    const [guardando,     setGuardando]     = useState(false);
    const [resultado,     setResultado]     = useState(null); // null | { ok, msg }

    // ── Cálculo de puntaje ───────────────────────────────────────────────────
    const { totalObtenido, pctGlobal, pctPorCat } = useMemo(() => {
        const totalObtenido = Object.values(respuestas).reduce((a, b) => a + b, 0);
        const pctGlobal     = TOTAL_PUNTOS > 0 ? (totalObtenido / TOTAL_PUNTOS) * 100 : 0;

        const pctPorCat = {};
        CATEGORIAS.forEach(cat => {
            const pregs   = PREGUNTAS.filter(p => p.catId === cat.id);
            const maxCat  = pregs.length * 2;
            const obtCat  = pregs.reduce((s, p) => s + (respuestas[p.id] ?? 0), 0);
            pctPorCat[cat.id] = maxCat > 0 ? (obtCat / maxCat) * 100 : 0;
        });
        return { totalObtenido, pctGlobal, pctPorCat };
    }, [respuestas]);

    const respondidas     = Object.keys(respuestas).length;
    const todasRespondidas = respondidas === PREGUNTAS.length;

    // ── Guardar en Firestore ──────────────────────────────────────────────────
    const enviar = async (e) => {
        e.preventDefault();
        if (!todasRespondidas) {
            setResultado({ ok: false, msg: `Respondé todas las preguntas (faltan ${PREGUNTAS.length - respondidas}).` });
            return;
        }
        setGuardando(true);
        setResultado(null);
        try {
            const payload = {
                empresa:        empresaNombre || "",
                ...cabecera,
                puntosObtenidos: totalObtenido,
                puntosTotales:   TOTAL_PUNTOS,
                porcentaje:      parseFloat(pctGlobal.toFixed(1)),
                calificacion:    labelScore(pctGlobal),
                detalle:         respuestas,
                puntajePorCategoria: pctPorCat,
                observaciones,
                creadoEn:        serverTimestamp(),
            };
            const ref = await addDoc(collection(db, "auditorias"), payload);
            onSave?.({ ...payload, id: ref.id });
            setResultado({ ok: true, msg: "✅ Auditoría guardada correctamente." });
            // Reset
            setRespuestas({});
            setObservaciones("");
            setCabecera(c => ({ ...c, objetivo: "", puesto: "", vigilador: "", auditor: "" }));
        } catch (err) {
            setResultado({ ok: false, msg: "❌ Error al guardar: " + err.message });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="ap-root">

            {/* ── Barra de puntaje flotante ──────────────────────────────── */}
            <div className="ap-scorebar" style={{ "--score-color": colorScore(pctGlobal) }}>
                <div className="ap-scorebar-label">Puntaje actual</div>
                <div className="ap-scorebar-pct" style={{ color: colorScore(pctGlobal) }}>
                    {pctGlobal.toFixed(1)}%
                </div>
                <div className="ap-scorebar-pts">
                    {totalObtenido} / {TOTAL_PUNTOS} pts
                </div>
                <div className="ap-scorebar-tag" style={{ background: colorScore(pctGlobal) }}>
                    {labelScore(pctGlobal)}
                </div>
                <div className="ap-scorebar-prog">
                    <div
                        className="ap-scorebar-fill"
                        style={{ width: `${pctGlobal}%`, background: colorScore(pctGlobal) }}
                    />
                </div>
                <div className="ap-scorebar-resp">
                    {respondidas}/{PREGUNTAS.length} respondidas
                </div>
            </div>

            <form className="ap-form" onSubmit={enviar}>

                {/* ── Encabezado ─────────────────────────────────────────── */}
                <section className="ap-seccion">
                    <div className="ap-seccion-header" style={{ "--cat-color": "#1a237e" }}>
                        <span className="ap-seccion-icon">📝</span>
                        <span className="ap-seccion-title">Datos de la auditoría</span>
                    </div>
                    <div className="ap-cabecera-grid">
                        {[
                            { k: "objetivo",  l: "Objetivo / Servicio" },
                            { k: "puesto",    l: "Puesto auditado"     },
                            { k: "vigilador", l: "Nombre del vigilador"},
                            { k: "auditor",   l: "Nombre del auditor"  },
                            { k: "fecha",     l: "Fecha",              t: "date" },
                        ].map(({ k, l, t = "text" }) => (
                            <div key={k} className="ap-cab-field">
                                <label className="ap-cab-label">{l}</label>
                                <input
                                    className="ap-cab-input"
                                    type={t}
                                    value={cabecera[k]}
                                    onChange={e => setCabecera(c => ({ ...c, [k]: e.target.value }))}
                                    required
                                />
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Puntaje por categoría (mini resumen) ─────────────── */}
                <div className="ap-cat-resumen">
                    {CATEGORIAS.map(cat => (
                        <div key={cat.id} className="ap-cat-chip">
                            <span>{cat.icon}</span>
                            <span className="ap-cat-chip-label">{cat.label}</span>
                            <span
                                className="ap-cat-chip-pct"
                                style={{ color: colorScore(pctPorCat[cat.id] ?? 0) }}
                            >
                                {(pctPorCat[cat.id] ?? 0).toFixed(0)}%
                            </span>
                        </div>
                    ))}
                </div>

                {/* ── Preguntas por categoría ───────────────────────────── */}
                {CATEGORIAS.map(cat => {
                    const pregs = PREGUNTAS.filter(p => p.catId === cat.id);
                    return (
                        <section key={cat.id} className="ap-seccion">
                            <div className="ap-seccion-header" style={{ "--cat-color": cat.color }}>
                                <span className="ap-seccion-icon">{cat.icon}</span>
                                <span className="ap-seccion-title">{cat.label}</span>
                                <span
                                    className="ap-seccion-pct"
                                    style={{ color: colorScore(pctPorCat[cat.id] ?? 0) }}
                                >
                                    {(pctPorCat[cat.id] ?? 0).toFixed(0)}%
                                </span>
                            </div>

                            <div className="ap-items">
                                {pregs.map((p, idx) => {
                                    const val = respuestas[p.id];
                                    return (
                                        <div
                                            key={p.id}
                                            className={`ap-item ${val !== undefined ? "ap-item--respondida" : ""}`}
                                        >
                                            <div className="ap-item-text">
                                                <span className="ap-item-num">{idx + 1}</span>
                                                {p.text}
                                            </div>
                                            <div className="ap-opciones">
                                                {[
                                                    { v: 0, l: "No cumple", cls: "ap-op--no"  },
                                                    { v: 1, l: "Parcial",   cls: "ap-op--par" },
                                                    { v: 2, l: "Cumple",    cls: "ap-op--ok"  },
                                                ].map(op => (
                                                    <label
                                                        key={op.v}
                                                        className={`ap-opcion ${op.cls} ${val === op.v ? "ap-opcion--sel" : ""}`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={p.id}
                                                            value={op.v}
                                                            checked={val === op.v}
                                                            onChange={() =>
                                                                setRespuestas(r => ({ ...r, [p.id]: op.v }))
                                                            }
                                                        />
                                                        {op.l}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}

                {/* ── Observaciones ─────────────────────────────────────── */}
                <section className="ap-seccion">
                    <div className="ap-seccion-header" style={{ "--cat-color": "#546e7a" }}>
                        <span className="ap-seccion-icon">💬</span>
                        <span className="ap-seccion-title">Observaciones generales</span>
                    </div>
                    <textarea
                        className="ap-obs"
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        placeholder="Detallá hallazgos, incidentes, recomendaciones…"
                        rows={4}
                    />
                </section>

                {/* ── Resultado / error ──────────────────────────────────── */}
                {resultado && (
                    <div className={`ap-resultado ${resultado.ok ? "ap-resultado--ok" : "ap-resultado--err"}`}>
                        {resultado.msg}
                    </div>
                )}

                {/* ── Botón submit ────────────────────────────────────────── */}
                <button
                    type="submit"
                    className="ap-btn-submit"
                    disabled={guardando}
                >
                    {guardando ? "⏳ Guardando…" : `💾 Guardar auditoría — ${pctGlobal.toFixed(1)}%`}
                </button>

            </form>
        </div>
    );
}
