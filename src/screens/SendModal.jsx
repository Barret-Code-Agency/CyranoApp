// src/screens/SendModal.jsx
import { useState, useEffect } from "react";
import ShieldLogo from "../components/ShieldLogo";
import { generarHojaSupervision } from "../utils/generarPDF";
import "../styles/SendModal.css";

// ── EmailJS config ─────────────────────────────────────────────────────────────
const EJS_SERVICE  = "Service_bsotr9p";
const EJS_TEMPLATE = "Template_tj3tz1t";
const EJS_KEY      = "1wp7DDAJ8xoqGkihA";

const EJS_OK = EJS_SERVICE !== "YOUR_SERVICE_ID";

// ── Helpers ────────────────────────────────────────────────────────────────────
const buildResumen = (session) => {
    const acts  = session.actividades || [];
    const ctrl  = acts.filter(a => a.tipo === "ctrl");
    const cap   = acts.filter(a => a.tipo === "cap");
    const otras = acts.filter(a => a.tipo === "otra");
    const km    = session.kmFinal ? Math.max(Number(session.kmFinal) - Number(session.kmInicial || 0), 0) : 0;

    let t = `=== HOJA DE RECORRIDO DIARIO — ${session.fecha || ""} ===\n\n`;
    t += `Colaborador : ${session.nombre}\n`;
    t += `Jornada     : ${session.jornadaID}  |  Horario: ${session.horaInicio} → ${session.horaFin}\n`;
    t += `Vehículo    : ${session.vehiculo || "—"}  |  Km recorridos: ${km > 0 ? km + " km" : "—"}\n\n`;
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

// Convierte Blob a base64 puro (sin el prefijo data:...)
const blobToBase64 = (blob) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
});

// ── Envío via REST API v1.0 de EmailJS (soporta adjuntos en base64) ───────────
async function enviarEmailConPDF(session, pdfBlob, pdfFilename) {
    const acts = session.actividades || [];
    const ctrl = acts.filter(a => a.tipo === "ctrl");
    const km   = session.kmFinal ? Math.max(Number(session.kmFinal) - Number(session.kmInicial || 0), 0) : 0;

    const base64pdf = await blobToBase64(pdfBlob);

    const payload = {
        service_id:  EJS_SERVICE,
        template_id: EJS_TEMPLATE,
        user_id:     EJS_KEY,
        template_params: {
            to_email:   session.email,
            supervisor: session.nombre,
            fecha:      session.fecha       || "",
            jornada_id: session.jornadaID   || "",
            controles:  String(ctrl.length),
            vehiculo:   session.vehiculo    || "—",
            horario:    `${session.horaInicio} → ${session.horaFin}`,
            km:         km > 0 ? km + " km" : "—",
            resumen:    buildResumen(session),
        },
        // PDF adjunto en base64 — soportado desde EmailJS API v1.0
        attachments: [
            {
                name:   pdfFilename,
                data:   base64pdf,
                type:   "application/pdf",
                inline: false,
            }
        ],
    };

    let resp;
    try {
        resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
    } catch (netErr) {
        throw new Error("Sin conexion o CORS bloqueado: " + netErr.message);
    }

    const respText = await resp.text().catch(() => "");
    if (!resp.ok) {
        throw new Error("EmailJS error " + resp.status + ": " + (respText || resp.statusText));
    }
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
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: pend ? "#8894ac" : "#0d1b3e" }}>{label}</div>
                {sub && <div style={{ fontSize: 11, color: "#8894ac", marginTop: 1 }}>{sub}</div>}
            </div>
            {esOk    && <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>Listo</div>}
            {esError && <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Error</div>}
        </div>
    );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
export default function SendModal({ session, onClose }) {
    const [pasos,   setPasos]   = useState({ pdf: "en_curso", email: "pendiente" });
    const [pdfData, setPdfData] = useState(null);
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
            // PASO 1 — Generar PDF
            let pdfResult;
            try {
                pdfResult = await generarHojaSupervision(session);
                setPdfData({ dataUrl: pdfResult.dataUrl, filename: pdfResult.filename });
                set("pdf", "ok");
            } catch (e) {
                console.error("PDF error:", e);
                set("pdf", "error");
                setError("No se pudo generar el PDF: " + e.message);
                setListo(true);
                return;
            }

            // PASO 2 — Enviar email con PDF adjunto
            set("email", "en_curso");
            if (EJS_OK) {
                try {
                    await enviarEmailConPDF(session, pdfResult.blob, pdfResult.filename);
                    set("email", "ok");
                } catch (e) {
                    console.error("Email error:", e);
                    set("email", "error");
                    setError("Envío fallido: " + e.message);
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

                <div style={{ textAlign: "center", marginBottom: 18 }}>
                    <div style={{ marginBottom: 8 }}><ShieldLogo size={48} /></div>
                    <h2 style={{ fontSize: 19, fontWeight: 800, color: "#0d1b3e", margin: 0 }}>
                        {listo ? "Jornada cerrada ✓" : "Procesando jornada..."}
                    </h2>
                    <p style={{ fontSize: 12, color: "#8894ac", marginTop: 4 }}>
                        {session?.jornadaID} · {session?.nombre}
                    </p>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                    <span className="tag green">{ctrl} controles</span>
                    <span className="tag blue">{cap} cap.</span>
                    <span className="tag orange">{otras} otras</span>
                    {km > 0 && <span className="tag">{km} km</span>}
                </div>

                <div style={{ background: "#f8f9fc", borderRadius: 12, padding: "8px 16px", border: "1px solid #e8eaf2", marginBottom: 14 }}>
                    <Paso icon="📄" label="Generar PDF"
                        sub="Hoja de Recorrido Diario"
                        estado={pasos.pdf} />
                    <div style={{ width: 2, height: 6, background: "#e8eaf2", marginLeft: 15 }} />
                    <Paso icon="📧" label="Enviar con PDF adjunto"
                        sub={EJS_OK
                            ? `Enviando a ${session?.email}`
                            : "Modo demo — configurar EmailJS para envío real"}
                        estado={pasos.email} />
                </div>

                {error && (
                    <div style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 12, lineHeight: 1.5 }}>
                        ⚠️ {error}
                    </div>
                )}

                {listo && !EJS_OK && (
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "#92400e", marginBottom: 12, lineHeight: 1.7 }}>
                        <strong>📌 Email en modo demo.</strong> Para activar el envío real:<br />
                        1. Creá cuenta gratis en <strong>emailjs.com</strong> (200/mes)<br />
                        2. Conectá tu Gmail como Service<br />
                        3. Pegá los 3 IDs en las constantes de <code>SendModal.jsx</code>
                    </div>
                )}

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
