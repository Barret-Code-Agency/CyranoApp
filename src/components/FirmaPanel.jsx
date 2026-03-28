// src/components/FirmaPanel.jsx
// Panel de firma electrónica reutilizable.
//
// Flujo visual:
//   [Botón "Firmar"]  →  [Confirmación]  →  [Sellado OK + hash]
//
// Props:
//   tipo          — tipo de documento (string, ej: "cierre_jornada")
//   datos         — objeto con el snapshot a firmar
//   legajo        — legajo del firmante (opcional)
//   referenciaId  — ID del doc original en Firestore (opcional)
//   onFirmado     — callback({ hash, firmaId }) llamado al completar la firma
//   label         — texto del botón (default: "Firmar documento")
//   obligatoria   — si true, no muestra botón de omitir (default: false)
//   onOmitir      — callback para saltear la firma (solo si !obligatoria)

import { useState } from "react";
import { useFirma } from "../hooks/useFirma";
import "./FirmaPanel.css";

export default function FirmaPanel({
    tipo,
    datos,
    legajo        = null,
    referenciaId  = null,
    onFirmado,
    label         = "Firmar documento",
    obligatoria   = false,
    onOmitir,
}) {
    const { firmar, firmando, firmaResult, firmaError } = useFirma();
    const [paso, setPaso] = useState("boton"); // "boton" | "confirmar"

    // ── Ya firmado ────────────────────────────────────────────────────────────
    if (firmaResult) {
        const h = firmaResult.hash;
        const hashCorto = `${h.slice(0,8)}…${h.slice(-8)}`;
        return (
            <div className="fp-firmado">
                <div className="fp-firmado-icono">🔒</div>
                <div className="fp-firmado-titulo">Firmado electrónicamente</div>
                <div className="fp-firmado-hash" title={h}>{hashCorto}</div>
                <div className="fp-firmado-id">ID: {firmaResult.firmaId}</div>
                <div className="fp-firmado-nota">
                    Registrado con tu identidad y sellado con hora de servidor.
                    No puede ser modificado.
                </div>
            </div>
        );
    }

    // ── Confirmación ──────────────────────────────────────────────────────────
    if (paso === "confirmar") {
        return (
            <div className="fp-confirmar">
                <div className="fp-confirmar-icono">✍️</div>
                <div className="fp-confirmar-titulo">¿Confirmar firma?</div>
                <p className="fp-confirmar-aviso">
                    Al firmar, los datos quedan registrados de forma <strong>permanente
                    e inalterable</strong>. Tu identidad queda vinculada a este documento.
                </p>
                {firmaError && <div className="fp-error">⚠️ {firmaError}</div>}
                <div className="fp-confirmar-btns">
                    <button
                        className="fp-btn fp-btn--confirmar"
                        disabled={firmando}
                        onClick={async () => {
                            try {
                                const result = await firmar({ tipo, datos, legajo, referenciaId });
                                if (result && onFirmado) onFirmado(result);
                            } catch { /* error mostrado por firmaError */ }
                        }}
                    >
                        {firmando ? "Firmando…" : "✅ Confirmar firma"}
                    </button>
                    <button
                        className="fp-btn fp-btn--cancelar"
                        disabled={firmando}
                        onClick={() => setPaso("boton")}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        );
    }

    // ── Botón inicial ─────────────────────────────────────────────────────────
    return (
        <div className="fp-root">
            <button
                className="fp-btn fp-btn--firmar"
                onClick={() => setPaso("confirmar")}
            >
                ✍️ {label}
            </button>
            {!obligatoria && onOmitir && (
                <button className="fp-btn fp-btn--omitir" onClick={onOmitir}>
                    Continuar sin firmar
                </button>
            )}
        </div>
    );
}
