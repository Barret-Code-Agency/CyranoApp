// src/forms/ReporteCondicionInseguraScreen.jsx
// Formulario de reporte de condiciones/actos inseguros.

import { useState, useMemo } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db }         from "../firebase";
import { fmtObjetivo } from "../utils/formatters";
import { useClientesData } from "../hooks/useClientesData";
import FirmaPanel from "../components/FirmaPanel";
import "./ReporteCondicionInseguraScreen.css";

// ── Listas de características ─────────────────────────────────────────────────
const CARACT_CONDICION = [
    "Equipos en mal estado",
    "Pisos en mal estado",
    "No demarcar o asegurar áreas",
    "Gases, polvos, humos, vapores",
    "Diseño de locales de trabajo inseguros",
    "Señalizaciones inadecuadas o insuficientes",
    "Herramientas defectuosas",
    "Carencia de sistemas de alarma",
    "Falta de orden y aseo",
    "Escasez de espacio para trabajar",
    "Almacenamiento incorrecto",
    "Niveles de ruido excesivo",
    "Iluminación o ventilación inadecuada",
];

const CARACT_ACTO = [
    "No usar el equipo de protección personal",
    "Operar sin autorización",
    "Operar a una velocidad inadecuada",
    "Usar equipo defectuoso",
    "Trabajar bajo el efecto de sustancias psicoactivas",
    "Ignorar las condiciones de peligro",
    "Usar el equipo incorrecto",
    "Adoptar una posición incorrecta",
    "Efectuar mantenimiento a equipo en movimiento",
    "Crear distracciones en el sitio de trabajo",
    "Colocarse debajo de cargas suspendidas",
];

function toggleItem(arr, item) {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

function CheckGrid({ items, selected, onChange, otrosKey, otrosVal, onOtros }) {
    return (
        <div className="rci-check-grid">
            {items.map(item => (
                <label key={item} className={`rci-check-item ${selected.includes(item) ? "rci-check-item--on" : ""}`}>
                    <input type="checkbox" checked={selected.includes(item)} onChange={() => onChange(item)} />
                    <span>{item}</span>
                </label>
            ))}
            <label className={`rci-check-item ${selected.includes("__otros__") ? "rci-check-item--on" : ""}`}>
                <input type="checkbox" checked={selected.includes("__otros__")} onChange={() => onChange("__otros__")} />
                <span>Otros:</span>
            </label>
            {selected.includes("__otros__") && (
                <input
                    className="rci-otros-input"
                    type="text"
                    placeholder="Describí el otro caso…"
                    value={otrosVal}
                    onChange={e => onOtros(e.target.value)}
                />
            )}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ReporteCondicionInseguraScreen({ onBack }) {
    const { user }                    = useAuth();
    const { empresaId, empresaNombre } = useAppData();

    const { clientes, objetivos } = useClientesData(empresaId);
    const [selCliente, setSelCliente] = useState("");
    const [selObjetivo, setSelObjetivo] = useState("");
    const objetivosFiltrados = objetivos.filter(o => o.clienteId === selCliente);
    const clienteObj = clientes.find(c => c.id === selCliente);
    const objetivoObj = objetivos.find(o => o.id === selObjetivo);

    const numeroReporte = useMemo(() => {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth()+1).padStart(2,"0");
        const dd = String(hoy.getDate()).padStart(2,"0");
        const rand = String(Math.floor(Math.random()*9000)+1000);
        return `RCI-${yyyy}${mm}${dd}-${rand}`;
    }, []);

    const hoy = new Date().toLocaleDateString("es-AR");

    const [form, setForm] = useState({
        fecha:                hoy,
        lugar:                "",
        descripcionCondicion: "",
        caractCondicion:      [],
        otrosCondicion:       "",
        descripcionActo:      "",
        caractActo:           [],
        otrosActo:            "",
        alternativas:         "",
        tienesFoto:           null,   // true | false | null
        nombreReportante:     user?.name ?? "",
        emailReportante:      user?.email ?? "",
    });

    const [estado,    setEstado]    = useState("idle"); // idle | guardando | ok | error
    const [errorMsg,  setErrorMsg]  = useState("");
    const [docRefId,  setDocRefId]  = useState(null);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const guardar = async () => {
        if (!form.lugar.trim()) { setErrorMsg("Indicá el lugar."); return; }
        if (!form.descripcionCondicion.trim() && !form.descripcionActo.trim()) {
            setErrorMsg("Completá al menos una descripción."); return;
        }
        setEstado("guardando");
        setErrorMsg("");
        try {
            await addDoc(collection(db, "condicionesInseguras"), {
                empresaId,
                empresaNombre,
                uid:                  user?.uid ?? null,
                clienteId:            selCliente,
                clienteNombre:        clienteObj?.nombre || "",
                objetivoId:           selObjetivo,
                objetivoNombre:       objetivoObj?.nombre || "",
                numero:               numeroReporte,
                fecha:                form.fecha,
                lugar:                form.lugar.trim(),
                descripcionCondicion: form.descripcionCondicion.trim(),
                caractCondicion:      [
                    ...form.caractCondicion.filter(x => x !== "__otros__"),
                    ...(form.caractCondicion.includes("__otros__") && form.otrosCondicion.trim()
                        ? [`Otros: ${form.otrosCondicion.trim()}`] : []),
                ],
                descripcionActo:      form.descripcionActo.trim(),
                caractActo:           [
                    ...form.caractActo.filter(x => x !== "__otros__"),
                    ...(form.caractActo.includes("__otros__") && form.otrosActo.trim()
                        ? [`Otros: ${form.otrosActo.trim()}`] : []),
                ],
                alternativas:         form.alternativas.trim(),
                tienesFoto:           form.tienesFoto,
                nombreReportante:     form.nombreReportante.trim(),
                emailReportante:      form.emailReportante.trim(),
                creadoEn:             serverTimestamp(),
            });
            setDocRefId(ref.id);
            setEstado("ok");
        } catch (e) {
            setErrorMsg("Error al guardar: " + e.message);
            setEstado("error");
        }
    };

    if (estado === "ok") return (
        <div className="rci-root">
            <div className="rci-ok">
                <div className="rci-ok-icon">✅</div>
                <div className="rci-ok-title">Reporte enviado</div>
                <div className="rci-ok-sub">El reporte de condición insegura fue registrado correctamente.</div>
                <FirmaPanel
                    tipo="reporte_condicion_insegura"
                    referenciaId={docRefId}
                    datos={{
                        reporteId:            docRefId,
                        numero:               numeroReporte,
                        clienteNombre:        clienteObj?.nombre  || "",
                        objetivoNombre:       objetivoObj?.nombre || "",
                        fecha:                form.fecha,
                        lugar:                form.lugar,
                        descripcionCondicion: form.descripcionCondicion,
                        descripcionActo:      form.descripcionActo,
                        reportante:           form.nombreReportante,
                    }}
                    label="Firmar reporte"
                    obligatoria={false}
                    onOmitir={() => {}}
                />
                <button className="rci-btn-primary" onClick={onBack}>Volver</button>
            </div>
        </div>
    );

    return (
        <div className="rci-root">
            <div className="rci-subpanel-top">
                <button className="rci-back" onClick={onBack}>← Volver al panel</button>
                <div className="rci-titulo">⚠️ Reporte de Condición / Acto Inseguro</div>
            </div>

            <div className="rci-body">

                {/* ── Tarjeta de trazabilidad ── */}
                <div className="rci-id-card">
                    <div className="rci-id-row">
                        <span className="rci-id-label">Nro. de reporte</span>
                        <span className="rci-id-val rci-id-val--num">{numeroReporte}</span>
                    </div>
                    <div className="rci-id-row">
                        <span className="rci-id-label">Fecha</span>
                        <span className="rci-id-val">{hoy}</span>
                    </div>
                    <div className="rci-id-row">
                        <span className="rci-id-label">Creado por</span>
                        <span className="rci-id-val">{user?.name || "—"}</span>
                    </div>
                    <div className="rci-id-row">
                        <span className="rci-id-label">Cliente</span>
                        <select className="rci-id-select" value={selCliente}
                            onChange={e => { setSelCliente(e.target.value); setSelObjetivo(""); }}>
                            <option value="">— Seleccioná —</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} · ` : ""}{c.nombre}</option>)}
                        </select>
                    </div>
                    <div className="rci-id-row">
                        <span className="rci-id-label">Objetivo</span>
                        <select className="rci-id-select" value={selObjetivo}
                            onChange={e => setSelObjetivo(e.target.value)}
                            disabled={!selCliente}>
                            <option value="">— Seleccioná —</option>
                            {objetivosFiltrados.map(o => <option key={o.id} value={o.id}>{fmtObjetivo(o)}</option>)}
                        </select>
                    </div>
                </div>

                {/* ── Datos básicos ── */}
                <div className="rci-card">
                    <div className="rci-row2">
                        <div className="rci-field">
                            <label className="rci-label">Fecha de reporte</label>
                            <input className="rci-input" type="text" value={form.fecha}
                                onChange={e => set("fecha", e.target.value)} />
                        </div>
                        <div className="rci-field rci-field--wide">
                            <label className="rci-label">Lugar de la condición o acto inseguro *</label>
                            <input className="rci-input" type="text" placeholder="Ej: Sector almacén, puerta principal…"
                                value={form.lugar} onChange={e => set("lugar", e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* ── Condición insegura ── */}
                <div className="rci-card">
                    <div className="rci-section-title">DESCRIPCIÓN DE LA CONDICIÓN INSEGURA</div>
                    <textarea className="rci-textarea" rows={4}
                        placeholder="Describí la condición insegura observada…"
                        value={form.descripcionCondicion}
                        onChange={e => set("descripcionCondicion", e.target.value)} />

                    <div className="rci-subsection">CARACTERÍSTICAS DE LA CONDICIÓN INSEGURA (marcá las que aplican)</div>
                    <CheckGrid
                        items={CARACT_CONDICION}
                        selected={form.caractCondicion}
                        onChange={item => set("caractCondicion", toggleItem(form.caractCondicion, item))}
                        otrosVal={form.otrosCondicion}
                        onOtros={v => set("otrosCondicion", v)}
                    />
                </div>

                {/* ── Acto inseguro ── */}
                <div className="rci-card">
                    <div className="rci-section-title">DESCRIPCIÓN DEL ACTO INSEGURO</div>
                    <textarea className="rci-textarea" rows={4}
                        placeholder="Describí el acto inseguro observado…"
                        value={form.descripcionActo}
                        onChange={e => set("descripcionActo", e.target.value)} />

                    <div className="rci-subsection">CARACTERÍSTICAS DEL ACTO INSEGURO (marcá las que aplican)</div>
                    <CheckGrid
                        items={CARACT_ACTO}
                        selected={form.caractActo}
                        onChange={item => set("caractActo", toggleItem(form.caractActo, item))}
                        otrosVal={form.otrosActo}
                        onOtros={v => set("otrosActo", v)}
                    />
                </div>

                {/* ── Alternativas de solución ── */}
                <div className="rci-card">
                    <div className="rci-section-title">ALTERNATIVAS DE SOLUCIÓN</div>
                    <textarea className="rci-textarea" rows={4}
                        placeholder="Describí las posibles soluciones o correcciones…"
                        value={form.alternativas}
                        onChange={e => set("alternativas", e.target.value)} />
                </div>

                {/* ── Fotografía ── */}
                <div className="rci-card">
                    <div className="rci-label">¿Adiciona fotografía?</div>
                    <div className="rci-foto-row">
                        {[true, false].map(val => (
                            <label key={String(val)} className={`rci-foto-opt ${form.tienesFoto === val ? "rci-foto-opt--on" : ""}`}>
                                <input type="radio" name="foto" checked={form.tienesFoto === val}
                                    onChange={() => set("tienesFoto", val)} />
                                {val ? "SÍ" : "NO"}
                            </label>
                        ))}
                    </div>
                </div>

                {/* ── Reportante ── */}
                <div className="rci-card">
                    <div className="rci-row2">
                        <div className="rci-field">
                            <label className="rci-label">Nombre de quien reporta</label>
                            <input className="rci-input" type="text" value={form.nombreReportante}
                                onChange={e => set("nombreReportante", e.target.value)} />
                        </div>
                        <div className="rci-field">
                            <label className="rci-label">Correo de contacto</label>
                            <input className="rci-input" type="email" value={form.emailReportante}
                                onChange={e => set("emailReportante", e.target.value)} />
                        </div>
                    </div>
                    <div className="rci-firma-box">FIRMA DE QUIEN REPORTA</div>
                </div>

                {/* ── Error + Guardar ── */}
                {errorMsg && <div className="rci-error">{errorMsg}</div>}

                <div className="rci-actions">
                    <button className="rci-btn-secondary" onClick={onBack}>Cancelar</button>
                    <button className="rci-btn-primary" onClick={guardar} disabled={estado === "guardando"}>
                        {estado === "guardando" ? "Enviando…" : "📋 Enviar reporte"}
                    </button>
                </div>

            </div>
        </div>
    );
}
