// src/forms/VerInformesScreen.jsx
// Lista de informes con búsqueda por código, cliente y fecha.
// Visible para vigiladores (solo propios), supervisores y admins (todos del empresa).

import { useState, useEffect } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { generarPDFInformeSencillo }  from "../utils/generarPDFInforme";
import { generarPDFInformeNovedad }   from "../utils/generarPDFInforme";
import "./VerInformesScreen.css";

const TIPOS = [
    { id: "todos",    label: "Todos" },
    { id: "sencillo", label: "Sencillo" },
    { id: "novedad",  label: "Novedad" },
];

export default function VerInformesScreen({ onBack, soloPropio = false }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaLogos } = useAppData();

    const [informes,  setInformes]  = useState([]);
    const [cargando,  setCargando]  = useState(true);
    const [busqueda,  setBusqueda]  = useState("");
    const [tipoFil,   setTipoFil]   = useState("todos");
    const [fechaDesde,setFechaDesde]= useState("");
    const [fechaHasta,setFechaHasta]= useState("");
    const [descargando, setDescargando] = useState(null); // id del que se está descargando

    useEffect(() => {
        cargar();
    }, []);

    const cargar = async () => {
        setCargando(true);
        try {
            let q = query(
                collection(db, "informes"),
                where("empresa", "==", empresaNombre || ""),
                orderBy("creadoEn", "desc")
            );
            if (soloPropio && user?.uid) {
                q = query(
                    collection(db, "informes"),
                    where("empresa", "==", empresaNombre || ""),
                    where("producidoPorId", "==", user.uid),
                    orderBy("creadoEn", "desc")
                );
            }
            const snap = await getDocs(q);
            setInformes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error cargando informes:", e);
        } finally {
            setCargando(false);
        }
    };

    const handleDescargar = async (inf) => {
        setDescargando(inf.id);
        try {
            const logoUrl = empresaLogos?.panel || null;
            if (inf.tipo === "sencillo") {
                generarPDFInformeSencillo({
                    objetivo:           inf.objetivo           || "",
                    fecha:              inf.fecha              || "",
                    ref:                inf.ref                || "",
                    cuerpo:             inf.cuerpo             || "",
                    paraConocimientoDe: inf.paraConocimientoDe || "",
                    producidoPor:       inf.producidoPor       || "",
                    empresa:            inf.empresa            || "",
                    logoUrl,
                    firma:              inf.firma              || null,
                });
            } else if (inf.tipo === "novedad") {
                generarPDFInformeNovedad({
                    datos:              inf.datos              || {},
                    hechoDenunciado:    inf.hechoDenunciado    || "",
                    cronologia:         inf.cronologia         || [],
                    quienDetecta:       inf.quienDetecta       || "",
                    acciones:           inf.acciones           || [],
                    personal:           inf.personal           || [],
                    servicioComp:       inf.servicioComp       || "",
                    consignasInc:       inf.consignasInc       ?? null,
                    consignasDetalle:   inf.consignasDetalle   || "",
                    comisaria:          inf.comisaria          || "",
                    fechaDenuncia:      inf.fechaDenuncia      || "",
                    reclamos:           inf.reclamos           || "",
                    comentarios:        inf.comentarios        || "",
                    producidoPor:       inf.producidoPor       || "",
                    empresa:            inf.empresa            || "",
                    logoUrl,
                    firma:              inf.firma              || null,
                });
            }
        } finally {
            setDescargando(null);
        }
    };

    // ── Filtrado ──────────────────────────────────────────────
    const filtrados = informes.filter(inf => {
        if (tipoFil !== "todos" && inf.tipo !== tipoFil) return false;

        const cliente = inf.tipo === "novedad"
            ? (inf.datos?.cliente || "")
            : (inf.objetivo || "");
        const texto   = [inf.codigo, cliente, inf.producidoPor, inf.ref].join(" ").toLowerCase();
        if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;

        const fechaDoc = inf.tipo === "novedad" ? inf.datos?.fecha : inf.fecha;
        if (fechaDesde && fechaDoc && fechaDoc < fechaDesde) return false;
        if (fechaHasta && fechaDoc && fechaDoc > fechaHasta) return false;

        return true;
    });

    // ── Render ────────────────────────────────────────────────
    return (
        <div className="vi-root">
            <header className="vi-header">
                <button className="vi-back" onClick={onBack}>← Volver</button>
                <span className="vi-header-title">🗂 Ver Informes</span>
                <button className="vi-refresh" onClick={cargar} title="Actualizar">↺</button>
            </header>

            {/* Filtros */}
            <div className="vi-filtros">
                <input
                    className="vi-busqueda"
                    placeholder="🔍  Buscar por código, cliente, ref..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
                <div className="vi-tipo-chips">
                    {TIPOS.map(t => (
                        <button
                            key={t.id}
                            className={`vi-chip ${tipoFil === t.id ? "vi-chip--active" : ""}`}
                            onClick={() => setTipoFil(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="vi-fechas">
                    <input className="vi-fecha-input" type="date" value={fechaDesde}
                        onChange={e => setFechaDesde(e.target.value)} title="Desde" />
                    <span className="vi-fecha-sep">—</span>
                    <input className="vi-fecha-input" type="date" value={fechaHasta}
                        onChange={e => setFechaHasta(e.target.value)} title="Hasta" />
                </div>
            </div>

            {/* Lista */}
            <div className="vi-lista">
                {cargando ? (
                    <div className="vi-empty">Cargando informes...</div>
                ) : filtrados.length === 0 ? (
                    <div className="vi-empty">
                        {informes.length === 0
                            ? "No hay informes registrados aún."
                            : "Ningún informe coincide con los filtros."}
                    </div>
                ) : (
                    filtrados.map(inf => {
                        const cliente  = inf.tipo === "novedad"
                            ? (inf.datos?.cliente || "—")
                            : (inf.objetivo || "—");
                        const fechaDoc = inf.tipo === "novedad"
                            ? inf.datos?.fecha
                            : inf.fecha;
                        const horaStr  = inf.creadoEn?.toDate
                            ? inf.creadoEn.toDate().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                            : "";

                        return (
                            <div key={inf.id} className="vi-item">
                                <div className="vi-item-top">
                                    <span className={`vi-tipo-badge vi-tipo-badge--${inf.tipo}`}>
                                        {inf.tipo === "novedad" ? "🚨 Novedad" : "📝 Sencillo"}
                                    </span>
                                    <span className="vi-codigo">{inf.codigo || "—"}</span>
                                </div>
                                <div className="vi-item-main">
                                    <span className="vi-cliente">{cliente}</span>
                                    {inf.ref && <span className="vi-ref">REF: {inf.ref}</span>}
                                </div>
                                <div className="vi-item-meta">
                                    <span>📅 {fechaDoc || "—"}</span>
                                    {horaStr && <span>🕐 {horaStr}</span>}
                                    <span>👤 {inf.producidoPor || "—"}</span>
                                </div>
                                <button
                                    className="vi-download-btn"
                                    onClick={() => handleDescargar(inf)}
                                    disabled={descargando === inf.id}
                                >
                                    {descargando === inf.id ? "Generando..." : "📄 Descargar PDF"}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
