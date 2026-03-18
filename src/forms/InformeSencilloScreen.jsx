// src/forms/InformeSencilloScreen.jsx
// Formulario de informe sencillo — replica el formato oficial.
// Una vez guardado en Firestore queda inmutable (estado: "firmado").

import { useState, useRef, useEffect } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db }         from "../firebase";
import { generarPDFInformeSencillo } from "../utils/generarPDFInforme";
import { useClientesData } from "../hooks/useClientesData";
import "./InformeSencilloScreen.css";

const generarCodigo = (tipo, identificador) => {
    const now = new Date();
    const fecha = now.toISOString().split("T")[0].replace(/-/g, "");
    const hora  = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    const slug  = (identificador || "SIN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const pre   = tipo === "novedad" ? "IN" : "IS";
    return `${pre}-${slug}-${fecha}-${hora}`;
};

export default function InformeSencilloScreen({ onBack }) {
    const { user }                       = useAuth();
    const { empresaNombre, empresaLogos } = useAppData();

    const now = new Date();
    const fechaConfeccion = now.toLocaleDateString("es-AR");
    const horaConfeccion  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const [form, setForm] = useState({
        fechaHecho:         now.toISOString().split("T")[0],
        ref:                "",
        cuerpo:             "",
        paraConocimientoDe: "",
    });

    const [selCliente,  setSelCliente]  = useState("");
    const [selObjetivo, setSelObjetivo] = useState("");
    const [selPuesto,   setSelPuesto]   = useState("");

    const [firmado,       setFirmado]       = useState(false);
    const [firmaDataUrl,  setFirmaDataUrl]  = useState(null);
    const [guardando,     setGuardando]     = useState(false);
    const [guardadoId,    setGuardadoId]    = useState(null);
    const [guardadoCodigo,setGuardadoCodigo]= useState(null);
    const [error,         setError]         = useState(null);

    const { clientes, objetivos, puestos } = useClientesData(empresaNombre);

    const objetivosFiltrados = objetivos.filter(o => o.clienteId === selCliente);
    const puestosFiltrados   = puestos.filter(p => p.objetivoId === selObjetivo);
    const puestoObj          = puestos.find(p => p.id === selPuesto);
    const clienteObj         = clientes.find(c => c.id === selCliente);
    const objetivoObj        = objetivos.find(o => o.id === selObjetivo);

    const canvasRef = useRef(null);
    const drawing   = useRef(false);
    const lastPos   = useRef(null);

    // Inicializar canvas
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
        return {
            x: (src.clientX - rect.left) * scaleX,
            y: (src.clientY - rect.top)  * scaleY,
        };
    };

    const startDraw = (e) => {
        e.preventDefault();
        drawing.current  = true;
        lastPos.current  = getPos(e, canvasRef.current);
    };

    const draw = (e) => {
        e.preventDefault();
        if (!drawing.current) return;
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext("2d");
        const pos    = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
    };

    const stopDraw = (e) => { drawing.current = false; };

    const clearFirma = () => {
        const canvas = canvasRef.current;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        setFirmado(false);
        setFirmaDataUrl(null);
    };

    const confirmarFirma = () => {
        const canvas = canvasRef.current;
        const data   = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        const tiene  = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
        if (!tiene) { setError("Por favor firmá antes de confirmar"); return; }
        setFirmaDataUrl(canvas.toDataURL("image/png"));
        setFirmado(true);
        setError(null);
    };

    const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

    const canSubmit = selCliente && selObjetivo && selPuesto && form.fechaHecho && form.ref && form.cuerpo && firmado;

    const handleGuardar = async () => {
        if (!canSubmit) return;
        setGuardando(true);
        setError(null);
        try {
            const codigo = generarCodigo("sencillo", clienteObj?.nombre || form.ref);
            const docRef = await addDoc(collection(db, "informes"), {
                tipo:               "sencillo",
                codigo,
                clienteId:          selCliente,
                clienteNombre:      clienteObj?.nombre      || "",
                objetivoId:         selObjetivo,
                objetivoNombre:     objetivoObj?.nombre     || "",
                puestoId:           selPuesto,
                puestoNombre:       puestoObj?.nombre       || "",
                direccion:          puestoObj?.direccion    || "",
                telefono:           puestoObj?.telefono     || "",
                fecha:              form.fechaHecho,
                fechaConfeccion,
                horaConfeccion,
                ref:                form.ref,
                cuerpo:             form.cuerpo,
                paraConocimientoDe: form.paraConocimientoDe,
                producidoPor:       user?.name   || "",
                producidoPorId:     user?.uid    || "",
                empresa:            empresaNombre || "",
                firma:              firmaDataUrl,
                estado:             "firmado",
                creadoEn:           serverTimestamp(),
            });
            setGuardadoId(docRef.id);
            setGuardadoCodigo(codigo);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const handlePDF = () => {
        generarPDFInformeSencillo({
            objetivo:           objetivoObj?.nombre     || "",
            cliente:            clienteObj?.nombre      || "",
            puesto:             puestoObj?.nombre       || "",
            direccion:          puestoObj?.direccion    || "",
            telefono:           puestoObj?.telefono     || "",
            fecha:              form.fechaHecho,
            fechaConfeccion,
            horaConfeccion,
            ref:                form.ref,
            cuerpo:             form.cuerpo,
            paraConocimientoDe: form.paraConocimientoDe,
            producidoPor:       user?.name   || "",
            empresa:            empresaNombre || "",
            logoUrl:            empresaLogos?.panel || null,
            firma:              firmaDataUrl,
        });
    };

    // ── Pantalla de éxito ────────────────────────────────────────
    if (guardadoId) {
        return (
            <div className="is-root">
                <div className="is-success">
                    <div className="is-success-icon">✅</div>
                    <h2 className="is-success-title">Informe guardado</h2>
                    {guardadoCodigo && (
                        <div className="is-success-codigo">{guardadoCodigo}</div>
                    )}
                    <p className="is-success-sub">
                        El informe quedó registrado y no puede ser modificado.
                    </p>
                    <button className="is-btn is-btn--primary" onClick={handlePDF}>
                        📄 Descargar PDF
                    </button>
                    <button className="is-btn is-btn--ghost" onClick={onBack}>
                        ← Volver al panel
                    </button>
                </div>
            </div>
        );
    }

    // ── Formulario ───────────────────────────────────────────────
    return (
        <div className="is-root">
            <header className="is-header">
                <button className="is-back" onClick={onBack}>← Volver</button>
                <span className="is-header-title">📝 Informe Sencillo</span>
            </header>

            <div className="is-body">

                {/* Título oficial */}
                <div className="is-doc-title">I N F O R M E</div>
                <div className="is-empresa-sub">{empresaNombre}</div>

                {/* Confección (readonly) */}
                <div className="is-confeccion-row">
                    <div className="is-confeccion-field">
                        <span className="is-label">Producido por</span>
                        <span className="is-readonly-val">{user?.name || "—"}</span>
                    </div>
                    <div className="is-confeccion-field">
                        <span className="is-label">Fecha de confección</span>
                        <span className="is-readonly-val">{fechaConfeccion}</span>
                    </div>
                    <div className="is-confeccion-field">
                        <span className="is-label">Hora</span>
                        <span className="is-readonly-val">{horaConfeccion}</span>
                    </div>
                </div>

                {/* Cliente */}
                <div className="is-field">
                    <label className="is-label">Cliente</label>
                    <select className="is-input is-select"
                        value={selCliente}
                        onChange={e => { setSelCliente(e.target.value); setSelObjetivo(""); setSelPuesto(""); }}>
                        <option value="">— Seleccioná cliente —</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} · ` : ""}{c.nombre}</option>)}
                    </select>
                </div>

                {/* Objetivo */}
                <div className="is-row2">
                    <div className="is-field is-field--grow">
                        <label className="is-label">Objetivo / Servicio</label>
                        <select className="is-input is-select"
                            value={selObjetivo}
                            onChange={e => { setSelObjetivo(e.target.value); setSelPuesto(""); }}
                            disabled={!selCliente}>
                            <option value="">— Seleccioná objetivo —</option>
                            {objetivosFiltrados.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                        </select>
                    </div>
                    <div className="is-field is-field--date">
                        <label className="is-label">Fecha del hecho</label>
                        <input className="is-input" type="date" value={form.fechaHecho}
                            onChange={e => set("fechaHecho", e.target.value)} />
                    </div>
                </div>

                {/* Puesto */}
                <div className="is-field">
                    <label className="is-label">Puesto</label>
                    <select className="is-input is-select"
                        value={selPuesto}
                        onChange={e => setSelPuesto(e.target.value)}
                        disabled={!selObjetivo}>
                        <option value="">— Seleccioná puesto —</option>
                        {puestosFiltrados.sort((a,b) => (a.numero??999)-(b.numero??999)).map(p => <option key={p.id} value={p.id}>{clienteObj?.codigo ? `${clienteObj.codigo}/${p.numero ?? "?"} · ` : ""}{p.nombre}</option>)}
                    </select>
                </div>

                {/* Dirección y teléfono (auto, readonly) */}
                {puestoObj && (
                    <div className="is-row2">
                        <div className="is-field is-field--grow">
                            <label className="is-label">Dirección</label>
                            <input className="is-input is-input--readonly" value={puestoObj.direccion || "—"} readOnly />
                        </div>
                        <div className="is-field is-field--date">
                            <label className="is-label">Teléfono</label>
                            <input className="is-input is-input--readonly" value={puestoObj.telefono || "—"} readOnly />
                        </div>
                    </div>
                )}

                {/* REF */}
                <div className="is-field">
                    <label className="is-label">REF</label>
                    <input className="is-input" value={form.ref}
                        onChange={e => set("ref", e.target.value)}
                        placeholder="Asunto o referencia del informe" />
                </div>

                {/* Cuerpo */}
                <div className="is-field">
                    <label className="is-label">Contenido</label>
                    <textarea className="is-textarea" value={form.cuerpo}
                        onChange={e => set("cuerpo", e.target.value)}
                        placeholder="Redactá el informe aquí..." rows={10} />
                </div>

                {/* Para conocimiento de */}
                <div className="is-field">
                    <label className="is-label">Para conocimiento de</label>
                    <input className="is-input" value={form.paraConocimientoDe}
                        onChange={e => set("paraConocimientoDe", e.target.value)}
                        placeholder="Ej: Supervisor, RRHH..." />
                </div>

                {/* Firma */}
                <div className="is-field">
                    <label className="is-label">Firma del vigilador</label>
                    {!firmado ? (
                        <div className="is-firma-panel">
                            <p className="is-firma-hint">Firmá en el recuadro con el dedo o el mouse</p>
                            <canvas
                                ref={canvasRef}
                                className="is-firma-canvas"
                                width={600}
                                height={140}
                                onMouseDown={startDraw}
                                onMouseMove={draw}
                                onMouseUp={stopDraw}
                                onMouseLeave={stopDraw}
                                onTouchStart={startDraw}
                                onTouchMove={draw}
                                onTouchEnd={stopDraw}
                            />
                            <div className="is-firma-btns">
                                <button className="is-btn is-btn--ghost is-btn--sm" onClick={clearFirma}>
                                    🗑 Borrar
                                </button>
                                <button className="is-btn is-btn--primary is-btn--sm" onClick={confirmarFirma}>
                                    ✔ Confirmar firma
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="is-firma-confirmed">
                            <img src={firmaDataUrl} alt="Firma" className="is-firma-img" />
                            <div className="is-firma-ok">✅ Firma confirmada — {user?.name}</div>
                            <button
                                className="is-btn is-btn--ghost is-btn--sm"
                                onClick={() => { setFirmado(false); setFirmaDataUrl(null); }}
                            >
                                Volver a firmar
                            </button>
                        </div>
                    )}
                </div>

                {error && <div className="is-error">{error}</div>}

                <div className="is-submit-area">
                    <button
                        className="is-btn is-btn--primary is-btn--full"
                        onClick={handleGuardar}
                        disabled={!canSubmit || guardando}
                    >
                        {guardando ? "Guardando..." : "📨 Guardar informe firmado"}
                    </button>
                    <p className="is-submit-note">Una vez guardado no puede modificarse</p>
                </div>

            </div>
        </div>
    );
}
