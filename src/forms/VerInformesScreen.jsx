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
    { id: "condicion", label: "⚠️ Cond. Insegura" },
];

export default function VerInformesScreen({ onBack, soloPropio = false, zonaFija = null }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaId, empresaLogos } = useAppData();

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
            const eid = empresaId || "";

            // ── Informes (sencillo + novedad) ──
            const qInformes = soloPropio && user?.uid
                ? query(collection(db, "informes"),
                    where("empresaId", "==", eid),
                    where("producidoPorId", "==", user.uid),
                    orderBy("creadoEn", "desc"))
                : query(collection(db, "informes"),
                    where("empresaId", "==", eid),
                    orderBy("creadoEn", "desc"));

            // ── Condiciones inseguras ──
            const qCond = soloPropio && user?.uid
                ? query(collection(db, "condicionesInseguras"),
                    where("empresaId", "==", eid),
                    where("uid", "==", user.uid),
                    orderBy("creadoEn", "desc"))
                : query(collection(db, "condicionesInseguras"),
                    where("empresaId", "==", eid),
                    orderBy("creadoEn", "desc"));

            const [snapInf, snapCond] = await Promise.all([
                getDocs(qInformes).catch(() => ({ docs: [] })),
                getDocs(qCond).catch(() => ({ docs: [] })),
            ]);

            let docs = [
                ...snapInf.docs.map(d => ({ id: d.id, ...d.data() })),
                ...snapCond.docs.map(d => ({ id: d.id, tipo: "condicion", ...d.data() })),
            ];

            if (zonaFija) docs = docs.filter(d => !d.zona || d.zona === zonaFija);

            // Ordenar por fecha descendente
            docs.sort((a, b) => {
                const ta = a.creadoEn?.toMillis?.() ?? 0;
                const tb = b.creadoEn?.toMillis?.() ?? 0;
                return tb - ta;
            });

            setInformes(docs);
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
            : inf.tipo === "condicion"
                ? (inf.clienteNombre || "")
                : (inf.clienteNombre || inf.objetivo || "");
        const texto = [
            inf.codigo, inf.numero, cliente,
            inf.producidoPor, inf.nombreReportante,
            inf.ref, inf.lugar,
        ].join(" ").toLowerCase();
        if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;

        const fechaDoc = inf.tipo === "novedad" ? inf.datos?.fecha
            : inf.tipo === "condicion" ? inf.fecha
            : inf.fecha;
        if (fechaDesde && fechaDoc && fechaDoc < fechaDesde) return false;
        if (fechaHasta && fechaDoc && fechaDoc > fechaHasta) return false;

        return true;
    });

    // ── Render ────────────────────────────────────────────────
    return (
        <div className="vi-root">
            <div className="vi-subpanel-top">
                <button className="vi-back" onClick={onBack}>← Volver al panel</button>
                <div className="vi-titulo-row">
                    <div className="vi-titulo">🗂 Ver Informes</div>
                    <button className="vi-refresh" onClick={cargar} title="Actualizar">↺</button>
                </div>
            </div>

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
                        const esCond   = inf.tipo === "condicion";
                        const esNoVed  = inf.tipo === "novedad";

                        const cliente  = esCond  ? (inf.clienteNombre || "—")
                            : esNoVed ? (inf.datos?.cliente || inf.clienteNombre || "—")
                            : (inf.clienteNombre || inf.objetivo || "—");

                        const objetivo = esCond  ? (inf.objetivoNombre || "")
                            : esNoVed ? (inf.objetivoNombre || "")
                            : (inf.objetivoNombre || "");

                        const fechaDoc = esNoVed ? inf.datos?.fecha : inf.fecha;
                        const horaStr  = inf.creadoEn?.toDate
                            ? inf.creadoEn.toDate().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                            : "";
                        const autor    = esCond ? (inf.nombreReportante || "—") : (inf.producidoPor || "—");
                        const codigo   = inf.numero || inf.codigo || "—";
                        const badgeLabel = esCond ? "⚠️ Cond. Insegura" : esNoVed ? "🚨 Novedad" : "📝 Sencillo";

                        return (
                            <div key={inf.id} className="vi-item">
                                <div className="vi-item-top">
                                    <span className={`vi-tipo-badge vi-tipo-badge--${inf.tipo}`}>
                                        {badgeLabel}
                                    </span>
                                    <span className="vi-codigo">{codigo}</span>
                                </div>
                                <div className="vi-item-main">
                                    <span className="vi-cliente">{cliente}</span>
                                    {objetivo && <span className="vi-ref">{objetivo}</span>}
                                    {inf.ref   && <span className="vi-ref">REF: {inf.ref}</span>}
                                    {inf.lugar && <span className="vi-ref">📍 {inf.lugar}</span>}
                                </div>
                                <div className="vi-item-meta">
                                    <span>📅 {fechaDoc || "—"}</span>
                                    {horaStr && <span>🕐 {horaStr}</span>}
                                    <span>👤 {autor}</span>
                                </div>
                                {!esCond && (
                                    <button
                                        className="vi-download-btn"
                                        onClick={() => handleDescargar(inf)}
                                        disabled={descargando === inf.id}
                                    >
                                        {descargando === inf.id ? "Generando..." : "📄 Descargar PDF"}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
