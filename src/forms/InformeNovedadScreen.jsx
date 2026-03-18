// src/forms/InformeNovedadScreen.jsx
// Informe de Novedad — formato oficial BSC.
// Inmutable una vez firmado y guardado.

import { useState, useRef, useEffect } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db }         from "../firebase";
import { generarPDFInformeNovedad } from "../utils/generarPDFInforme";
import { useClientesData } from "../hooks/useClientesData";
import "./InformeNovedadScreen.css";

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);

const generarCodigo = (tipo, identificador) => {
    const now = new Date();
    const fecha = now.toISOString().split("T")[0].replace(/-/g, "");
    const hora  = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    const slug  = (identificador || "SIN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const pre   = tipo === "novedad" ? "IN" : "IS";
    return `${pre}-${slug}-${fecha}-${hora}`;
};

const rowCrono  = () => ({ id: uid(), fecha: "", hora: "", hechos: "" });
const rowAccion = () => ({ id: uid(), fecha: "", hora: "", accion: "" });
const rowPerson = () => ({ nombre: "", cargo: "", telefono: "", empresa: "" });

const SECTIONS = [
    "Datos generales",
    "Incidente",
    "Detección",
    "Acciones BSC",
    "Personal involucrado",
    "Servicio de seguridad",
    "Denuncia policial",
    "Reclamos / Comentarios",
    "Firma",
];

// ── Componente sección ────────────────────────────────────────────────────────
function Seccion({ numero, titulo, children }) {
    return (
        <section className="in-seccion">
            <div className="in-seccion-header">
                <span className="in-seccion-num">{numero}</span>
                <span className="in-seccion-titulo">{titulo}</span>
            </div>
            <div className="in-seccion-body">{children}</div>
        </section>
    );
}

// ── Input helpers ─────────────────────────────────────────────────────────────
function Field({ label, children, small }) {
    return (
        <div className={`in-field ${small ? "in-field--small" : ""}`}>
            <label className="in-label">{label}</label>
            {children}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InformeNovedadScreen({ onBack }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaLogos } = useAppData();

    // ── State ──────────────────────────────────────────────────
    const hoy = new Date().toISOString().split("T")[0];

    const nowIN = new Date();
    const fechaConfeccionIN = nowIN.toLocaleDateString("es-AR");
    const horaConfeccionIN  = nowIN.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const [datos, setDatos] = useState({
        fecha:     hoy,   // fecha del hecho
        referente: "",
        cargo:     "",
    });

    const [selCliente,  setSelCliente]  = useState("");
    const [selObjetivo, setSelObjetivo] = useState("");
    const [selPuesto,   setSelPuesto]   = useState("");

    const [hechoDenunciado, setHechoDenunciado] = useState("");
    const [cronologia, setCronologia] = useState([rowCrono()]);

    const [quienDetecta, setQuienDetecta] = useState("");

    const [acciones, setAcciones] = useState([rowAccion()]);

    const [personal, setPersonal] = useState([{ ...rowPerson(), id: uid() }]);

    const [servicioComp, setServicioComp]           = useState("");
    const [consignasInc, setConsignasInc]           = useState(null); // null / true / false
    const [consignasDetalle, setConsignasDetalle]   = useState("");

    const [comisaria, setComisaria]   = useState("");
    const [fechaDenuncia, setFechaDenuncia] = useState("");

    const [reclamos, setReclamos]   = useState("");
    const [comentarios, setComentarios] = useState("");

    const [firmado,        setFirmado]        = useState(false);
    const [firmaDataUrl,   setFirmaDataUrl]   = useState(null);
    const [guardando,      setGuardando]      = useState(false);
    const [guardadoId,     setGuardadoId]     = useState(null);
    const [guardadoCodigo, setGuardadoCodigo] = useState(null);
    const [error,          setError]          = useState(null);

    const { clientes, objetivos, puestos } = useClientesData(empresaNombre);

    const objetivosFiltrados = objetivos.filter(o => o.clienteId === selCliente);
    const puestosFiltrados   = puestos.filter(p => p.objetivoId === selObjetivo);
    const puestoObj          = puestos.find(p => p.id === selPuesto);
    const clienteObj         = clientes.find(c => c.id === selCliente);
    const objetivoObj        = objetivos.find(o => o.id === selObjetivo);

    // ── Canvas firma ──────────────────────────────────────────
    const canvasRef = useRef(null);
    const drawing   = useRef(false);
    const lastPos   = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
    }, []);

    const getPos = (e, canvas) => {
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const src    = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    };

    const startDraw = e => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvasRef.current); };
    const draw = e => {
        e.preventDefault();
        if (!drawing.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const pos = getPos(e, canvas);
        ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        lastPos.current = pos;
    };
    const stopDraw = () => { drawing.current = false; };

    const clearFirma = () => {
        canvasRef.current?.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setFirmado(false); setFirmaDataUrl(null);
    };

    const confirmarFirma = () => {
        const canvas = canvasRef.current;
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        if (!Array.from(data).some((v, i) => i % 4 === 3 && v > 0)) {
            setError("Por favor firmá antes de confirmar"); return;
        }
        setFirmaDataUrl(canvas.toDataURL("image/png"));
        setFirmado(true); setError(null);
    };

    // ── Cronología helpers ────────────────────────────────────
    const setCrono = (id, field, val) =>
        setCronologia(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
    const addCrono    = () => setCronologia(r => [...r, rowCrono()]);
    const removeCrono = id => setCronologia(r => r.filter(x => x.id !== id));

    // ── Acciones helpers ──────────────────────────────────────
    const setAccion = (id, field, val) =>
        setAcciones(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
    const addAccion    = () => setAcciones(r => [...r, rowAccion()]);
    const removeAccion = id => setAcciones(r => r.filter(x => x.id !== id));

    // ── Personal helpers ──────────────────────────────────────
    const setPersonalField = (idx, field, val) =>
        setPersonal(p => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
    const addPersona    = () => setPersonal(p => [...p, { ...rowPerson(), id: uid() }]);
    const removePersona = (idx) => setPersonal(p => p.filter((_, i) => i !== idx));

    // ── Guardar ───────────────────────────────────────────────
    const canSubmit = selCliente && selObjetivo && selPuesto && datos.fecha && hechoDenunciado && firmado;

    const handleGuardar = async () => {
        if (!canSubmit) return;
        setGuardando(true); setError(null);
        try {
            const codigo = generarCodigo("novedad", clienteObj?.nombre || "");
            const ref = await addDoc(collection(db, "informes"), {
                tipo:               "novedad",
                codigo,
                clienteId:          selCliente,
                clienteNombre:      clienteObj?.nombre      || "",
                objetivoId:         selObjetivo,
                objetivoNombre:     objetivoObj?.nombre     || "",
                puestoId:           selPuesto,
                puestoNombre:       puestoObj?.nombre       || "",
                direccion:          puestoObj?.direccion    || "",
                telefono:           puestoObj?.telefono     || "",
                fechaConfeccion:    fechaConfeccionIN,
                horaConfeccion:     horaConfeccionIN,
                datos,              // contains fecha (hecho), referente, cargo
                hechoDenunciado,
                cronologia,
                quienDetecta,
                acciones,
                personal:           personal.filter(p => p.nombre),
                servicioComp,
                consignasInc,
                consignasDetalle,
                comisaria,
                fechaDenuncia,
                reclamos,
                comentarios,
                producidoPor:       user?.name  || "",
                producidoPorId:     user?.uid   || "",
                empresa:            empresaNombre || "",
                firma:              firmaDataUrl,
                estado:             "firmado",
                creadoEn:           serverTimestamp(),
            });
            setGuardadoId(ref.id);
            setGuardadoCodigo(codigo);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const handlePDF = () => {
        generarPDFInformeNovedad({
            datos: {
                ...datos,
                cliente:   clienteObj?.nombre   || "",
                servicio:  objetivoObj?.nombre  || "",
                puesto:    puestoObj?.nombre    || "",
                direccion: puestoObj?.direccion || "",
                telefono:  puestoObj?.telefono  || "",
            },
            hechoDenunciado, cronologia, quienDetecta,
            acciones, personal: personal.filter(p => p.nombre),
            servicioComp, consignasInc, consignasDetalle,
            comisaria, fechaDenuncia, reclamos, comentarios,
            producidoPor:    user?.name   || "",
            empresa:         empresaNombre || "",
            logoUrl:         empresaLogos?.panel || null,
            firma:           firmaDataUrl,
        });
    };

    // ── Éxito ─────────────────────────────────────────────────
    if (guardadoId) {
        return (
            <div className="in-root">
                <div className="in-success">
                    <div className="in-success-icon">✅</div>
                    <h2 className="in-success-title">Informe guardado</h2>
                    {guardadoCodigo && (
                        <div className="in-success-codigo">{guardadoCodigo}</div>
                    )}
                    <p className="in-success-sub">El informe de novedad quedó registrado y no puede modificarse.</p>
                    <button className="in-btn in-btn--primary" onClick={handlePDF}>📄 Descargar PDF</button>
                    <button className="in-btn in-btn--ghost" onClick={onBack}>← Volver al panel</button>
                </div>
            </div>
        );
    }

    // ── Formulario ────────────────────────────────────────────
    const inp = (label, val, onChange, opts = {}) => (
        <Field label={label} small={opts.small}>
            <input className="in-input" value={val} onChange={e => onChange(e.target.value)}
                placeholder={opts.placeholder || ""} type={opts.type || "text"}
                readOnly={opts.readOnly} style={opts.readOnly ? { background: "var(--color-surface2)", color: "var(--color-text-secondary)" } : {}} />
        </Field>
    );

    return (
        <div className="in-root">
            <header className="in-header">
                <button className="in-back" onClick={onBack}>← Volver</button>
                <span className="in-header-title">🚨 Informe de Novedad</span>
            </header>

            <div className="in-body">
                <div className="in-doc-title">INFORME DE NOVEDAD</div>
                <div className="in-empresa-sub">{empresaNombre}</div>

                {/* ── 1. Datos generales ── */}
                <Seccion numero="1" titulo="Datos generales">
                    {/* Confección readonly */}
                    <div className="in-confeccion-row">
                        <div className="in-confeccion-field">
                            <span className="in-label">Producido por</span>
                            <span className="in-readonly-val">{user?.name || "—"}</span>
                        </div>
                        <div className="in-confeccion-field">
                            <span className="in-label">Fecha confección</span>
                            <span className="in-readonly-val">{fechaConfeccionIN}</span>
                        </div>
                        <div className="in-confeccion-field">
                            <span className="in-label">Hora</span>
                            <span className="in-readonly-val">{horaConfeccionIN}</span>
                        </div>
                    </div>

                    {/* Cliente */}
                    <Field label="Cliente">
                        <select className="in-input in-select"
                            value={selCliente}
                            onChange={e => { setSelCliente(e.target.value); setSelObjetivo(""); setSelPuesto(""); }}>
                            <option value="">— Seleccioná cliente —</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} · ` : ""}{c.nombre}</option>)}
                        </select>
                    </Field>

                    <div className="in-row2">
                        <Field label="Servicio / Objetivo">
                            <select className="in-input in-select"
                                value={selObjetivo}
                                onChange={e => { setSelObjetivo(e.target.value); setSelPuesto(""); }}
                                disabled={!selCliente}>
                                <option value="">— Seleccioná objetivo —</option>
                                {objetivosFiltrados.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                            </select>
                        </Field>
                        <Field label="Fecha del hecho" small>
                            <input className="in-input" type="date" value={datos.fecha}
                                onChange={e => setDatos(d => ({ ...d, fecha: e.target.value }))} />
                        </Field>
                    </div>

                    <Field label="Puesto">
                        <select className="in-input in-select"
                            value={selPuesto}
                            onChange={e => setSelPuesto(e.target.value)}
                            disabled={!selObjetivo}>
                            <option value="">— Seleccioná puesto —</option>
                            {puestosFiltrados.sort((a,b) => (a.numero??999)-(b.numero??999)).map(p => <option key={p.id} value={p.id}>{clienteObj?.codigo ? `${clienteObj.codigo}/${p.numero ?? "?"} · ` : ""}{p.nombre}</option>)}
                        </select>
                    </Field>

                    {puestoObj && (
                        <div className="in-row2">
                            <Field label="Dirección">
                                <input className="in-input" value={puestoObj.direccion || "—"} readOnly
                                    style={{ background: "var(--color-surface2)", color: "var(--color-text-secondary)" }} />
                            </Field>
                            <Field label="Teléfono" small>
                                <input className="in-input" value={puestoObj.telefono || "—"} readOnly
                                    style={{ background: "var(--color-surface2)", color: "var(--color-text-secondary)" }} />
                            </Field>
                        </div>
                    )}

                    <div className="in-row2">
                        <Field label="Referente (cliente)">
                            <input className="in-input" value={datos.referente}
                                onChange={e => setDatos(d => ({ ...d, referente: e.target.value }))}
                                placeholder="Nombre del referente en el cliente" />
                        </Field>
                        <Field label="Cargo">
                            <input className="in-input" value={datos.cargo}
                                onChange={e => setDatos(d => ({ ...d, cargo: e.target.value }))}
                                placeholder="Cargo del referente" />
                        </Field>
                    </div>
                </Seccion>

                {/* ── 2. Incidente ── */}
                <Seccion numero="2" titulo="Incidente">
                    <Field label="Hecho denunciado">
                        <textarea className="in-textarea" value={hechoDenunciado}
                            onChange={e => setHechoDenunciado(e.target.value)}
                            placeholder="Describí el hecho denunciado..." rows={4} />
                    </Field>

                    <div className="in-subsection-title">Relación cronológica</div>
                    <div className="in-table-wrap">
                        <div className="in-table-head in-crono-grid">
                            <span>Fecha</span><span>Hora</span><span>Hechos</span><span></span>
                        </div>
                        {cronologia.map(row => (
                            <div key={row.id} className="in-table-row in-crono-grid">
                                <input className="in-input in-input--sm" type="date" value={row.fecha}
                                    onChange={e => setCrono(row.id, "fecha", e.target.value)} />
                                <input className="in-input in-input--sm" type="time" value={row.hora}
                                    onChange={e => setCrono(row.id, "hora", e.target.value)} />
                                <input className="in-input in-input--sm" value={row.hechos}
                                    onChange={e => setCrono(row.id, "hechos", e.target.value)}
                                    placeholder="Descripción del hecho..." />
                                {cronologia.length > 1 && (
                                    <button className="in-row-del" onClick={() => removeCrono(row.id)}>✕</button>
                                )}
                            </div>
                        ))}
                        <button className="in-add-row" onClick={addCrono}>+ Agregar fila</button>
                    </div>
                </Seccion>

                {/* ── 3. Detección ── */}
                <Seccion numero="3" titulo="Detección de la novedad">
                    <Field label="¿Quién detecta?">
                        <textarea className="in-textarea" value={quienDetecta}
                            onChange={e => setQuienDetecta(e.target.value)}
                            placeholder="Indicá quién detectó la novedad y cómo..." rows={3} />
                    </Field>
                </Seccion>

                {/* ── 4. Acciones BSC ── */}
                <Seccion numero="4" titulo="Acciones inmediatas (BSC)">
                    <div className="in-table-wrap">
                        <div className="in-table-head in-crono-grid">
                            <span>Fecha</span><span>Hora</span><span>Acción tomada</span><span></span>
                        </div>
                        {acciones.map(row => (
                            <div key={row.id} className="in-table-row in-crono-grid">
                                <input className="in-input in-input--sm" type="date" value={row.fecha}
                                    onChange={e => setAccion(row.id, "fecha", e.target.value)} />
                                <input className="in-input in-input--sm" type="time" value={row.hora}
                                    onChange={e => setAccion(row.id, "hora", e.target.value)} />
                                <input className="in-input in-input--sm" value={row.accion}
                                    onChange={e => setAccion(row.id, "accion", e.target.value)}
                                    placeholder="Descripción de la acción..." />
                                {acciones.length > 1 && (
                                    <button className="in-row-del" onClick={() => removeAccion(row.id)}>✕</button>
                                )}
                            </div>
                        ))}
                        <button className="in-add-row" onClick={addAccion}>+ Agregar fila</button>
                    </div>
                </Seccion>

                {/* ── 5. Personal involucrado ── */}
                <Seccion numero="5" titulo="Personal involucrado">
                    {personal.map((p, i) => (
                        <div key={p.id ?? i} className="in-personal-card">
                            <div className="in-personal-card-header">
                                <span className="in-personal-num">Persona {i + 1}</span>
                                <button className="in-row-del" onClick={() => removePersona(i)}>✕</button>
                            </div>
                            <div className="in-row2">
                                <Field label="Nombre">
                                    <input className="in-input" value={p.nombre}
                                        onChange={e => setPersonalField(i, "nombre", e.target.value)}
                                        placeholder="Nombre completo" />
                                </Field>
                                <Field label="Cargo">
                                    <input className="in-input" value={p.cargo}
                                        onChange={e => setPersonalField(i, "cargo", e.target.value)}
                                        placeholder="Cargo o función" />
                                </Field>
                            </div>
                            <div className="in-row2">
                                <Field label="Teléfono">
                                    <input className="in-input" value={p.telefono} type="tel"
                                        onChange={e => setPersonalField(i, "telefono", e.target.value)}
                                        placeholder="Teléfono de contacto" />
                                </Field>
                                <Field label="Empresa">
                                    <input className="in-input" value={p.empresa}
                                        onChange={e => setPersonalField(i, "empresa", e.target.value)}
                                        placeholder="Empresa a la que pertenece" />
                                </Field>
                            </div>
                        </div>
                    ))}
                    <button className="in-add-row" onClick={addPersona}>+ Agregar persona</button>
                </Seccion>

                {/* ── 6. Servicio de seguridad ── */}
                <Seccion numero="6" titulo="Servicio de seguridad">
                    <Field label="Servicio compuesto por">
                        <textarea className="in-textarea" value={servicioComp}
                            onChange={e => setServicioComp(e.target.value)}
                            placeholder="Describí cómo está compuesto el servicio de seguridad..." rows={3} />
                    </Field>
                    <Field label="¿Hay consignas incumplidas?">
                        <div className="in-bool-group">
                            <button
                                className={`in-bool-btn ${consignasInc === true ? "in-bool-btn--si" : ""}`}
                                onClick={() => setConsignasInc(true)}
                            >SÍ</button>
                            <button
                                className={`in-bool-btn ${consignasInc === false ? "in-bool-btn--no" : ""}`}
                                onClick={() => setConsignasInc(false)}
                            >NO</button>
                        </div>
                    </Field>
                    {consignasInc === true && (
                        <Field label="Detalle de consignas incumplidas">
                            <textarea className="in-textarea" value={consignasDetalle}
                                onChange={e => setConsignasDetalle(e.target.value)}
                                placeholder="Describí qué consignas no fueron cumplidas..." rows={3} />
                        </Field>
                    )}
                </Seccion>

                {/* ── 7. Denuncia policial ── */}
                <Seccion numero="7" titulo="Denuncia policial">
                    <div className="in-row2">
                        <Field label="Comisaría">
                            <input className="in-input" value={comisaria}
                                onChange={e => setComisaria(e.target.value)}
                                placeholder="Nombre o número de comisaría" />
                        </Field>
                        <Field label="Fecha de denuncia" small>
                            <input className="in-input" type="date" value={fechaDenuncia}
                                onChange={e => setFechaDenuncia(e.target.value)} />
                        </Field>
                    </div>
                </Seccion>

                {/* ── 8. Reclamos y comentarios ── */}
                <Seccion numero="8" titulo="Reclamos y comentarios">
                    <Field label="Reclamos del cliente">
                        <textarea className="in-textarea" value={reclamos}
                            onChange={e => setReclamos(e.target.value)}
                            placeholder="Reclamos formales del cliente..." rows={3} />
                    </Field>
                    <Field label="Comentarios adicionales">
                        <textarea className="in-textarea" value={comentarios}
                            onChange={e => setComentarios(e.target.value)}
                            placeholder="Cualquier información adicional relevante..." rows={3} />
                    </Field>
                    <Field label="Producido por">
                        <input className="in-input" value={user?.name || ""} readOnly
                            style={{ background: "var(--color-surface2)", color: "var(--color-text-secondary)" }} />
                    </Field>
                </Seccion>

                {/* ── 9. Firma ── */}
                <Seccion numero="9" titulo="Firma del vigilador">
                    {!firmado ? (
                        <div className="in-firma-panel">
                            <p className="in-firma-hint">Firmá en el recuadro con el dedo o el mouse</p>
                            <canvas ref={canvasRef} className="in-firma-canvas" width={600} height={140}
                                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                            <div className="in-firma-btns">
                                <button className="in-btn in-btn--ghost in-btn--sm" onClick={clearFirma}>🗑 Borrar</button>
                                <button className="in-btn in-btn--primary in-btn--sm" onClick={confirmarFirma}>✔ Confirmar firma</button>
                            </div>
                        </div>
                    ) : (
                        <div className="in-firma-confirmed">
                            <img src={firmaDataUrl} alt="Firma" className="in-firma-img" />
                            <div className="in-firma-ok">✅ Firma confirmada — {user?.name}</div>
                            <button className="in-btn in-btn--ghost in-btn--sm"
                                onClick={() => { setFirmado(false); setFirmaDataUrl(null); }}>
                                Volver a firmar
                            </button>
                        </div>
                    )}
                </Seccion>

                {error && <div className="in-error">{error}</div>}

                <div className="in-submit-area">
                    <button className="in-btn in-btn--danger in-btn--full"
                        onClick={handleGuardar} disabled={!canSubmit || guardando}>
                        {guardando ? "Guardando..." : "🚨 Guardar informe de novedad"}
                    </button>
                    <p className="in-submit-note">Una vez guardado no puede modificarse</p>
                </div>
            </div>
        </div>
    );
}
