// src/screens/SendModal.jsx
import { useState, useEffect } from "react";
import ShieldLogo from "../components/ShieldLogo";
import { generarHojaSupervision } from "../utils/generarPDF";
import "../styles/SendModal.css";

// ── EmailJS config ─────────────────────────────────────────────────────────────
// 1. Creá cuenta gratis en https://www.emailjs.com  (200 emails/mes sin costo)
// 2. Creá un Service conectando tu Gmail
// 3. Creá un Template con estas variables:
//    {{supervisor}} {{fecha}} {{jornada_id}} {{controles}} {{vehiculo}} {{horario}} {{resumen}}
// 4. Reemplazá los 3 valores de abajo:
const EJS_SERVICE  = "Service_bsotr9p";   // ← p.ej. "service_abc123"
const EJS_TEMPLATE = "Template_tj3tz1t";  // ← p.ej. "template_xyz456"
const EJS_KEY      = "1wp7DDAJ8xoqGkihA";   // ← p.ej. "abcDEF123456"

const EJS_OK = EJS_SERVICE !== "YOUR_SERVICE_ID";

// ── Helpers ────────────────────────────────────────────────────────────────────
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const diffMin = (a, b) => { let d = toMin(b) - toMin(a); return d < 0 ? d + 1440 : Math.max(d, 0); };
const fmtHs = (min) => { if (!min || min <= 0) return "00:00"; return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); };

const buildResumen = (session) => {
    const acts  = session.actividades || [];
    const ctrl  = acts.filter(a => a.tipo === "ctrl");
    const cap   = acts.filter(a => a.tipo === "cap");
    const otras = acts.filter(a => a.tipo === "otra");
    const km    = session.kmFinal ? Math.max(Number(session.kmFinal) - Number(session.kmInicial || 0), 0) : 0;

    let t = `=== HOJA DE SUPERVISIÓN — ${session.fecha || ""} ===\n\n`;
    t += `Supervisor : ${session.nombre}\n`;
    t += `Jornada    : ${session.jornadaID}  |  Horario: ${session.horaInicio} → ${session.horaFin}\n`;
    t += `Vehículo   : ${session.vehiculo || "—"}  |  Km recorridos: ${km > 0 ? km + " km" : "—"}\n\n`;
    t += `RESUMEN:\n  • Controles: ${ctrl.length}  • Capacitaciones: ${cap.length}  • Otras: ${otras.length}\n\n`;
    if (ctrl.length > 0) {
        t += `CONTROLES:\n`;
        ctrl.forEach((c, i) => {
            t += `  ${i + 1}. ${c.objetivo || "—"}  (${c.horaInicio}–${c.horaFin})`;
            t += `  Vigilador: ${c.vigilador || "—"}`;
            if (c.anomalia === "Sí") t += `  ⚠️ ANOMALÍA`;
            t += "\n";
        });
    }
    return t;
};

async function cargarEmailJS() {
    if (window.emailjs) return;
    await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });
    window.emailjs.init(EJS_KEY);
}

async function enviarEmail(session) {
    await cargarEmailJS();
    const acts  = session.actividades || [];
    const ctrl  = acts.filter(a => a.tipo === "ctrl");
    const km    = session.kmFinal ? Math.max(Number(session.kmFinal) - Number(session.kmInicial || 0), 0) : 0;

    return window.emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
        to_email:   session.email,
        supervisor: session.nombre,
        fecha:      session.fecha,
        jornada_id: session.jornadaID,
        controles:  ctrl.length,
        vehiculo:   session.vehiculo || "—",
        horario:    `${session.horaInicio} → ${session.horaFin}`,
        km:         km > 0 ? km + " km" : "—",
        resumen:    buildResumen(session),
    });
}

// ── Indicador de paso ──────────────────────────────────────────────────────────
function Paso({ icon, label, sub, estado }) {
    const esOk    = estado === "ok";
    const esError = estado === "error";
    const enCurso = estado === "en_curso";
    const pend    = estado === "pendiente";

    const borderColor = esOk ? "#16a34a" : esError ? "#dc2626" : enCurso ? "#003087" : "#c8d0e0";
    const bgColor     = esOk ? "#f0fdf4" : esError ? "#fef2f2" : enCurso ? "#eef2ff" : "#f5f7fa";
    const iconShow    = esOk ? "✓" : esError ? "✕" : enCurso ? "⟳" : icon;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
            <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: bgColor, border: `2px solid ${borderColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, flexShrink: 0,
                animation: enCurso ? "sm-spin 1s linear infinite" : "none",
                color: borderColor, fontWeight: 800,
            }}>
                {iconShow}
            </div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: pend ? "#8894ac" : "#0d1b3e" }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: "#8894ac", marginTop: 1 }}>{sub}</div>}
            </div>
            {esOk && <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#16a34a" }}>Listo</div>}
            {esError && <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Error</div>}
        </div>
    );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
export default function SendModal({ session, onClose }) {
    const [pasos,   setPasos]   = useState({ pdf: "en_curso", email: "pendiente" });
    const [pdfData, setPdfData] = useState(null);   // { dataUrl, filename }
    const [error,   setError]   = useState(null);
    const [listo,   setListo]   = useState(false);

    const acts  = session?.actividades || [];
    const ctrl  = acts.filter(a => a.tipo === "ctrl").length;
    const cap   = acts.filter(a => a.tipo === "cap").length;
    const otras = acts.filter(a => a.tipo === "otra").length;
    const km    = session?.kmFinal ? Math.max(Number(session.kmFinal) - Number(session.kmInicial || 0), 0) : 0;

    const set = (k, v) => setPasos(p => ({ ...p, [k]: v }));

    useEffect(() => {
        (async () => {
            // PASO 1: Generar PDF
            let pdfResult;
            try {
                pdfResult = await generarHojaSupervision(session);
                setPdfData({ dataUrl: pdfResult.dataUrl, filename: pdfResult.filename });
                set("pdf", "ok");
            } catch (e) {
                console.error("PDF error:", e);
                set("pdf", "error");
                setError("No se pudo generar el PDF. " + e.message);
                setListo(true);
                return;
            }

            // PASO 2: Enviar email
            set("email", "en_curso");
            if (EJS_OK) {
                try {
                    await enviarEmail(session);
                    set("email", "ok");
                } catch (e) {
                    console.error("Email error:", e);
                    set("email", "error");
                    setError("PDF generado OK, pero el envío de email falló. Podés descargarlo manualmente.");
                }
            } else {
                await new Promise(r => setTimeout(r, 800));
                set("email", "ok"); // modo demo
            }

            setListo(true);
        })();
    }, []);

    return (
        <div className="overlay">
            <div className="modal" style={{ maxWidth: 420 }}>

                {/* Logo + título */}
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                    <div style={{ marginBottom: 8 }}><ShieldLogo size={48} /></div>
                    <h2 style={{ fontSize: 19, fontWeight: 800, color: "#0d1b3e", margin: 0 }}>
                        {listo ? "Jornada cerrada ✓" : "Procesando jornada..."}
                    </h2>
                    <p style={{ fontSize: 12, color: "#8894ac", marginTop: 4 }}>
                        {session?.jornadaID} · {session?.nombre}
                    </p>
                </div>

                {/* Tags resumen */}
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18 }}>
                    <span className="tag green">{ctrl} controles</span>
                    <span className="tag blue">{cap} cap.</span>
                    <span className="tag orange">{otras} otras</span>
                    {km > 0 && <span className="tag">{km} km</span>}
                </div>

                {/* Pasos */}
                <div style={{ background: "#f8f9fc", borderRadius: 12, padding: "8px 16px", border: "1px solid #e8eaf2", marginBottom: 14 }}>
                    <Paso icon="📄" label="Generar PDF" sub="Hoja de Supervisión formato Brinks"
                        estado={pasos.pdf} />
                    <div style={{ width: 2, height: 6, background: "#e8eaf2", marginLeft: 15 }} />
                    <Paso icon="📧" label="Enviar informe"
                        sub={EJS_OK ? `Enviando a ${session?.email}` : "Modo demo — configurar EmailJS para envío real"}
                        estado={pasos.email} />
                </div>

                {/* Error */}
                {error && (
                    <div style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Aviso configuración EmailJS */}
                {listo && !EJS_OK && (
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "#92400e", marginBottom: 12, lineHeight: 1.7 }}>
                        <strong>📌 Email en modo demo.</strong> Para activar el envío real:<br />
                        1. Creá cuenta gratis en <strong>emailjs.com</strong> (200/mes)<br />
                        2. Conectá tu Gmail como Service<br />
                        3. Pegá los 3 IDs en las constantes de <code>SendModal.jsx</code>
                    </div>
                )}

                {/* Acciones */}
                {listo && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pdfData && (
                            <a href={pdfData.dataUrl} download={pdfData.filename}
                                className="btn btn-secondary"
                                style={{ textDecoration: "none", textAlign: "center" }}>
                                ⬇ Descargar PDF
                            </a>
                        )}
                        {pdfData && (
                            <a href={pdfData.dataUrl} target="_blank" rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{ textDecoration: "none", textAlign: "center" }}>
                                👁 Ver PDF
                            </a>
                        )}
                        <button className="btn btn-primary" onClick={onClose}>
                            Volver al inicio →
                        </button>
                    </div>
                )}

                {/* Spinner mientras procesa */}
                {!listo && (
                    <div style={{ textAlign: "center", marginTop: 8 }}>
                        <div className="send-spinner-large" />
                    </div>
                )}

            </div>
            <style>{`@keyframes sm-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
