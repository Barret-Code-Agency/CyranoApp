// src/screens/ControlVehicularScreen.jsx
import { useState } from "react";
import { todayDate, nowTime } from "../utils/helpers";
import "../styles/ControlVehicularScreen.css";
import { generarPDFControlVehicular } from "../utils/generarPDF_ControlVehicular";

// ── Secciones del checklist (basado en el formulario original) ─────────────
const SECCIONES = [
    {
        id: "exterior", titulo: "Exterior", icono: "🚗",
        items: [
            "Guardabarros del. izq.", "Espejo izq.", "Puerta delantera izq.",
            "Puerta trasera izq.", "Guardabarros tras. izq.", "Paragolpes trasero",
            "Ópticas traseras", "Portón / tapa baúl", "Guardabarros tras. der.",
            "Puerta trasera der.", "Puerta delantera der.", "Espejo der.",
            "Guardabarros del. der.", "Parrilla", "Ópticas delanteras",
            "Luces auxiliares", "Capot", "Parabrisas", "Escobillas",
            "Techo", "Logos imantados",
        ],
    },
    {
        id: "interior", titulo: "Interior", icono: "🪑",
        items: [
            "Tablero", "Estéreo", "Luz de cortesía", "Parasoles",
            "Gaveta inferior", "Gaveta superior", "Gaveta central",
            "Cubre alfombras", "Tapizados del.", "Tapizados tras.",
            "Cinturones del.", "Cinturones tras.", "Apoya cabezas",
            "Puertas del.", "Puertas tras.", "Limpieza",
            "Manual de garantía", "Botiquín", "Extintor 1kg",
            "Jaula interna", "Espejo retrovisor",
        ],
    },
    {
        id: "equipamiento", titulo: "Equipamiento", icono: "🔧",
        items: [
            "Libro de novedades", "Conos (5)", "Binocular",
            "Pistola de Radar", "Reflectores", "Antena imantada",
            "Radio base (VHF)", "Radio Handy", "Celular", "Antena GPS",
            "Bastones luminosos", "Linterna Apolo", "Criquet",
            "Llave criquet", "Varillas criquet", "Jaula antivuelco",
            "Extintor 5kg.", "Calza de seguridad", "1er Auxilio",
            "2do auxilio", "Pértiga", "Barra estrobo ámbar",
            "Luz estrobo Azul", "Alarma de retroceso", "Enganche",
            "Check point", "Bocha de enganche",
        ],
    },
    {
        id: "sistemas", titulo: "Sistemas", icono: "⚙️",
        items: ["Frenos", "Transmisión", "4×4", "Suspensión", "Neumáticos", "Calefacción / Refrig."],
    },
    {
        id: "fluidos", titulo: "Fluidos", icono: "💧",
        items: ["Aceite", "Líquido refrigerante", "Agua limp. Parabrisas", "Líquido Hidráulico", "Líquido de Frenos"],
    },
    {
        id: "documentacion", titulo: "Documentación", icono: "📄",
        items: ["Registro de conducir", "Tarjeta verde", "Póliza de seguro"],
    },
    {
        id: "enlace", titulo: "Prueba de Enlace", icono: "📡",
        items: ["Funciona?", "Se recibe bien?", "Botón antipánico?"],
    },
];

const TOTAL_ITEMS = SECCIONES.reduce((s, sec) => s + sec.items.length, 0);

// ── Estado inicial de checks ──────────────────────────────────────────────
const initChecks = () => {
    const c = {};
    SECCIONES.forEach(sec => sec.items.forEach(item => { c[`${sec.id}__${item}`] = null; }));
    return c;
};

export default function ControlVehicularScreen({ vehiculo, supervisor, onConfirmar, onOmitir }) {
    const [checks,     setChecks]     = useState(initChecks);
    const [novedades,  setNovedades]  = useState("");
    const [fotos,      setFotos]      = useState([]);
    const [sinNovedad, setSinNovedad] = useState(null); // true/false
    const [seccionAbierta, setSeccion] = useState("exterior");
    const [pdfLoading,   setPdfLoading] = useState(false);

    const setCheck = (key, val) => setChecks(p => ({ ...p, [key]: val }));

    const respondidos = Object.values(checks).filter(v => v !== null).length;
    const conNovedad  = Object.values(checks).filter(v => v === "cn").length;
    const pct         = Math.round(respondidos / TOTAL_ITEMS * 100);

    const handleFoto = (e) => {
        const files = Array.from(e.target.files).slice(0, 5 - fotos.length);
        files.forEach(f => {
            const reader = new FileReader();
            reader.onload = (ev) => setFotos(prev => [...prev, { url: ev.target.result, name: f.name }]);
            reader.readAsDataURL(f);
        });
    };

    const handleConfirmar = async () => {
        const datos = {
            fecha:       todayDate(),
            hora:        nowTime(),
            vehiculo,
            supervisor,
            checks,
            novedades:   sinNovedad === false ? novedades : "",
            sinNovedad:  sinNovedad === true,
            fotos:       fotos.map(f => f.url),
            respondidos,
            conNovedad,
        };
        // Auto-descarga PDF
        setPdfLoading(true);
        try {
            const result = await generarPDFControlVehicular(datos);
            const a = document.createElement("a");
            a.href = result.dataUrl; a.download = result.filename; a.click();
        } catch (e) {
            console.warn("PDF control vehicular:", e);
        } finally {
            setPdfLoading(false);
        }
        onConfirmar(datos);
    };

    const puedeConfirmar = respondidos === TOTAL_ITEMS && sinNovedad !== null;

    return (
        <div className="cv-root">
            <div className="cv-header">
                <div className="cv-header-icon">🚙</div>
                <div>
                    <div className="cv-header-title">Control Vehicular</div>
                    <div className="cv-header-sub">{vehiculo || "Sin vehículo asignado"}</div>
                </div>
                <div className="cv-progress-pill">
                    <span className="cv-progress-num">{pct}%</span>
                </div>
            </div>

            {/* Barra de progreso */}
            <div className="cv-progress-bar-wrap">
                <div className="cv-progress-bar-track">
                    <div className="cv-progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="cv-progress-label">{respondidos}/{TOTAL_ITEMS} ítems · {conNovedad} con novedad</div>
            </div>

            {/* Secciones */}
            {SECCIONES.map(sec => {
                const abierta  = seccionAbierta === sec.id;
                const secItems = sec.items;
                const secResp  = secItems.filter(item => checks[`${sec.id}__${item}`] !== null).length;
                const secCN    = secItems.filter(item => checks[`${sec.id}__${item}`] === "cn").length;
                const secPct   = Math.round(secResp / secItems.length * 100);

                return (
                    <div key={sec.id} className={`cv-seccion ${abierta ? "abierta" : ""}`}>
                        <button className="cv-seccion-header" onClick={() => setSeccion(abierta ? null : sec.id)}>
                            <span className="cv-sec-icon">{sec.icono}</span>
                            <span className="cv-sec-titulo">{sec.titulo}</span>
                            <div className="cv-sec-meta">
                                {secCN > 0 && <span className="cv-badge-cn">{secCN} CN</span>}
                                <span className={`cv-sec-pct ${secPct === 100 ? "completo" : ""}`}>{secPct}%</span>
                                <span className="cv-chevron">{abierta ? "▲" : "▼"}</span>
                            </div>
                        </button>

                        {abierta && (
                            <div className="cv-items-grid">
                                {secItems.map(item => {
                                    const key = `${sec.id}__${item}`;
                                    const val = checks[key];
                                    return (
                                        <div key={item} className={`cv-item ${val === "sn" ? "sn" : val === "cn" ? "cn" : val === "na" ? "na" : "sin-respuesta"}`}>
                                            <span className="cv-item-label">{item}</span>
                                            <div className="cv-item-btns">
                                                <button
                                                    className={`cv-btn-sn ${val === "sn" ? "active" : ""}`}
                                                    onClick={() => setCheck(key, val === "sn" ? null : "sn")}
                                                >S/N</button>
                                                <button
                                                    className={`cv-btn-cn ${val === "cn" ? "active" : ""}`}
                                                    onClick={() => setCheck(key, val === "cn" ? null : "cn")}
                                                >C/N</button>
                                                <button
                                                    className={`cv-btn-na ${val === "na" ? "active" : ""}`}
                                                    onClick={() => setCheck(key, val === "na" ? null : "na")}
                                                >N/A</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Novedades */}
            <div className="cv-card">
                <div className="cv-card-title">📋 Detalle de novedades</div>
                <div className="cv-novedad-btns">
                    <button
                        className={`cv-novedad-btn ${sinNovedad === true ? "active-verde" : ""}`}
                        onClick={() => setSinNovedad(true)}
                    >✓ Sin novedades</button>
                    <button
                        className={`cv-novedad-btn ${sinNovedad === false ? "active-rojo" : ""}`}
                        onClick={() => setSinNovedad(false)}
                    >⚠️ Con novedades</button>
                </div>
                {sinNovedad === false && (
                    <textarea
                        className="cv-textarea"
                        placeholder="Describí las novedades encontradas..."
                        value={novedades}
                        onChange={e => setNovedades(e.target.value)}
                        rows={4}
                    />
                )}
            </div>

            {/* Fotos */}
            <div className="cv-card">
                <div className="cv-card-title">📷 Fotos (opcional, máx. 5)</div>
                {fotos.length > 0 && (
                    <div className="cv-fotos-grid">
                        {fotos.map((f, i) => (
                            <div key={i} className="cv-foto-thumb">
                                <img src={f.url} alt={f.name} />
                                <button className="cv-foto-remove" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}>✕</button>
                            </div>
                        ))}
                    </div>
                )}
                {fotos.length < 5 && (
                    <label className="cv-foto-add">
                        <span>+ Agregar foto</span>
                        <input type="file" accept="image/*" multiple onChange={handleFoto} style={{ display: "none" }} />
                    </label>
                )}
            </div>

            {/* Acciones */}
            <button
                className="btn btn-primary"
                disabled={!puedeConfirmar}
                onClick={handleConfirmar}
            >
                {pdfLoading ? "⏳ Generando PDF..." : "✅ Confirmar control y continuar"}
            </button>
            {!puedeConfirmar && respondidos < TOTAL_ITEMS && (
                <div className="cv-hint">Respondé todos los ítems del checklist para continuar ({TOTAL_ITEMS - respondidos} pendientes)</div>
            )}
            {!puedeConfirmar && respondidos === TOTAL_ITEMS && sinNovedad === null && (
                <div className="cv-hint">Indicá si hay novedades antes de continuar</div>
            )}
            <button className="btn btn-secondary" onClick={onOmitir} style={{ color: "var(--color-muted)", borderColor: "rgba(0,0,0,0.1)" }}>
                Omitir (sin vehículo)
            </button>
        </div>
    );
}
