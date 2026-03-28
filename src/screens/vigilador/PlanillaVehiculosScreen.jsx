// src/screens/vigilador/PlanillaVehiculosScreen.jsx
// Registro de vehículos livianos — entrada/salida con control de kilometraje e inventario.
//
// Colección Firestore: controlVehiculos
// Campos por registro: empresaId, objetivoId, objetivoNombre, clienteNombre,
//   fecha, patente, conductor, horaEntrada, horaSalida, kmEntrada, kmSalida,
//   inventarioOk, observaciones, estado ("en_puesto"|"retirado"),
//   codigoTrazabilidad, vigiladorRegistra, vigiladorId, creadoEn

import { useState, useEffect, useCallback } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import {
    collection, query, where, getDocs,
    addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import FirmaPanel from "../../components/FirmaPanel";
import "./PlanillaVehiculosScreen.css";

const COL = "controlVehiculos";

function nowTime() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}
function todayDate() { return new Date().toISOString().slice(0, 10); }
function fmtFecha(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}
function genCodigo() {
    return "VEH-" + Date.now().toString(36).toUpperCase().slice(-6);
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────
function FilaVehiculo({ reg, onSalida }) {
    const enPuesto = reg.estado === "en_puesto";
    const kmRec    = reg.kmSalida != null && reg.kmEntrada != null
        ? reg.kmSalida - reg.kmEntrada
        : null;

    return (
        <tr className={`pveh-tr${enPuesto ? " pveh-tr--en-puesto" : ""}`}>
            <td className="pveh-td-patente">{reg.patente}</td>
            <td>{reg.conductor}</td>
            <td>{reg.horaEntrada}</td>
            <td>{reg.horaSalida || <span className="pveh-pendiente">En puesto</span>}</td>
            <td className="pveh-td-km">
                {reg.kmEntrada != null ? reg.kmEntrada : "—"}
                {reg.kmSalida != null && ` → ${reg.kmSalida}`}
                {kmRec !== null && <span className="pveh-km-rec"> (+{kmRec})</span>}
            </td>
            <td>{reg.observaciones || "—"}</td>
            <td className="pveh-td-inv">
                {reg.inventarioOk
                    ? <span className="pveh-badge pveh-badge--ok">✔ OK</span>
                    : <span className="pveh-badge pveh-badge--obs">Ver obs.</span>}
            </td>
            <td className="pveh-td-codigo">{reg.codigoTrazabilidad}</td>
            <td>
                {enPuesto && (
                    <button className="pveh-btn-sal" onClick={() => onSalida(reg)}>
                        ↩ Salida
                    </button>
                )}
            </td>
        </tr>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function PlanillaVehiculosScreen({
    objetivoId, objetivoNombre, clienteNombre, onBack,
}) {
    const { user }      = useAuth();
    const { empresaId } = useAppData();

    const [registros,    setRegistros]    = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [guardando,    setGuardando]    = useState(false);
    const [error,        setError]        = useState("");
    const [mostrarForm,  setMostrarForm]  = useState(false);
    const [mostrarFirma, setMostrarFirma] = useState(false);
    const [firmado,      setFirmado]      = useState(false);

    // Formulario de salida
    const [regSalida, setRegSalida] = useState(null);
    const [kmSalidaVal, setKmSalidaVal] = useState("");

    const [form, setForm] = useState({
        patente:      "",
        conductor:    "",
        kmEntrada:    "",
        inventarioOk: true,
        observaciones:"",
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const cargar = useCallback(async () => {
        if (!empresaId || !objetivoId) return;
        setLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db, COL),
                where("empresaId",  "==", empresaId),
                where("objetivoId", "==", objetivoId),
                where("fecha",      "==", todayDate()),
            ));
            setRegistros(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.horaEntrada || "").localeCompare(b.horaEntrada || ""))
            );
        } catch (e) {
            setError("Error al cargar: " + e.message);
        } finally {
            setLoading(false);
        }
    }, [empresaId, objetivoId]);

    useEffect(() => { cargar(); }, [cargar]);

    // ── Registrar entrada ─────────────────────────────────────────────────────
    const handleAgregar = async () => {
        if (!form.patente.trim() || !form.conductor.trim()) return;
        setGuardando(true); setError("");
        try {
            const nuevo = {
                empresaId,
                objetivoId,
                objetivoNombre:     objetivoNombre || "",
                clienteNombre:      clienteNombre  || "",
                fecha:              todayDate(),
                patente:            form.patente.trim().toUpperCase(),
                conductor:          form.conductor.trim(),
                horaEntrada:        nowTime(),
                horaSalida:         null,
                kmEntrada:          form.kmEntrada !== "" ? Number(form.kmEntrada) : null,
                kmSalida:           null,
                inventarioOk:       form.inventarioOk,
                observaciones:      form.observaciones.trim(),
                estado:             "en_puesto",
                codigoTrazabilidad: genCodigo(),
                vigiladorRegistra:  user?.name || "",
                vigiladorId:        user?.uid  || "",
                creadoEn:           serverTimestamp(),
            };
            const ref = await addDoc(collection(db, COL), nuevo);
            setRegistros(prev => [...prev, { id: ref.id, ...nuevo }]);
            setForm({ patente: "", conductor: "", kmEntrada: "", inventarioOk: true, observaciones: "" });
            setMostrarForm(false);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    // ── Registrar salida ──────────────────────────────────────────────────────
    const handleSalida = async () => {
        if (!regSalida) return;
        const hora = nowTime();
        const km   = kmSalidaVal !== "" ? Number(kmSalidaVal) : null;
        try {
            await updateDoc(doc(db, COL, regSalida.id), {
                horaSalida: hora,
                kmSalida:   km,
                estado:     "retirado",
            });
            setRegistros(prev => prev.map(r =>
                r.id === regSalida.id ? { ...r, horaSalida: hora, kmSalida: km, estado: "retirado" } : r
            ));
            setRegSalida(null);
            setKmSalidaVal("");
        } catch (e) {
            setError("Error al registrar salida: " + e.message);
        }
    };

    const enPuesto = registros.filter(r => r.estado === "en_puesto");

    return (
        <div className="pveh-root">

            {/* Encabezado estilo planilla */}
            <div className="pveh-header">
                <div className="pveh-header-logo">
                    <div className="pveh-logo-text">BRINKS</div>
                    <div className="pveh-logo-sub">SEGURIDAD CORPORATIVA</div>
                </div>
                <div className="pveh-header-titulo">Vehículos livianos</div>
                <div className="pveh-header-meta">
                    <span>{objetivoNombre}</span>
                    {clienteNombre && <span> · {clienteNombre}</span>}
                    <span> · {fmtFecha(todayDate())}</span>
                </div>
            </div>

            {error && <div className="pveh-error">⚠️ {error}</div>}

            {/* Tabla */}
            <div className="pveh-tabla-wrap">
                <table className="pveh-tabla">
                    <thead>
                        <tr>
                            <th>Patente</th>
                            <th>Conductor</th>
                            <th>Entrada</th>
                            <th>Salida</th>
                            <th>Kilometraje</th>
                            <th>Observaciones</th>
                            <th>Inventario</th>
                            <th>Código</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="pveh-td-center">Cargando…</td></tr>
                        ) : registros.length === 0 ? (
                            <tr><td colSpan={9} className="pveh-td-center pveh-td-vacio">Sin movimientos registrados hoy</td></tr>
                        ) : (
                            registros.map(reg => (
                                <FilaVehiculo
                                    key={reg.id}
                                    reg={reg}
                                    onSalida={r => { setRegSalida(r); setKmSalidaVal(""); }}
                                />
                            ))
                        )}
                    </tbody>
                    {registros.length > 0 && (
                        <tfoot>
                            <tr className="pveh-tfoot">
                                <td colSpan={9} className="pveh-tfoot-label">
                                    Total: {registros.length} movimiento{registros.length !== 1 ? "s" : ""} · En puesto: {enPuesto.length}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Alerta vehículos en puesto */}
            {enPuesto.length > 0 && (
                <div className="pveh-alerta-pendiente">
                    🚗 <strong>{enPuesto.length} vehículo{enPuesto.length > 1 ? "s" : ""} aún en el puesto</strong> — Registrá la salida cuando se retiren.
                </div>
            )}

            {/* Modal de salida */}
            {regSalida && (
                <div className="pveh-modal-overlay">
                    <div className="pveh-modal">
                        <div className="pveh-modal-titulo">Registrar salida — {regSalida.patente}</div>
                        <div className="pveh-modal-meta">{regSalida.conductor}</div>
                        <div className="pveh-form-row">
                            <label>Kilometraje de salida</label>
                            <input
                                type="number"
                                placeholder={regSalida.kmEntrada != null ? `Desde ${regSalida.kmEntrada} km` : "Km al salir"}
                                value={kmSalidaVal}
                                onChange={e => setKmSalidaVal(e.target.value)}
                                min={regSalida.kmEntrada ?? 0}
                            />
                        </div>
                        <div className="pveh-form-btns">
                            <button className="pveh-btn pveh-btn--primary" onClick={handleSalida}>
                                ✅ Confirmar salida
                            </button>
                            <button className="pveh-btn pveh-btn--ghost" onClick={() => setRegSalida(null)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Formulario nueva entrada */}
            {mostrarForm ? (
                <div className="pveh-form">
                    <div className="pveh-form-titulo">Registrar entrada de vehículo</div>

                    <div className="pveh-form-row">
                        <label>Patente *</label>
                        <input
                            type="text"
                            placeholder="Ej: ABC 123"
                            value={form.patente}
                            onChange={e => set("patente", e.target.value)}
                            className="pveh-input-upper"
                        />
                    </div>

                    <div className="pveh-form-row">
                        <label>Conductor *</label>
                        <input
                            type="text"
                            placeholder="Nombre y apellido"
                            value={form.conductor}
                            onChange={e => set("conductor", e.target.value)}
                        />
                    </div>

                    <div className="pveh-form-row">
                        <label>Kilometraje de entrada</label>
                        <input
                            type="number"
                            placeholder="Km actuales del vehículo"
                            value={form.kmEntrada}
                            onChange={e => set("kmEntrada", e.target.value)}
                            min={0}
                        />
                    </div>

                    <div className="pveh-form-row pveh-form-row--check">
                        <label>
                            <input
                                type="checkbox"
                                checked={form.inventarioOk}
                                onChange={e => set("inventarioOk", e.target.checked)}
                            />
                            &nbsp; Inventario del vehículo conforme
                        </label>
                    </div>

                    <div className="pveh-form-row">
                        <label>Observaciones</label>
                        <input
                            type="text"
                            placeholder="Daños, faltantes u otras observaciones"
                            value={form.observaciones}
                            onChange={e => set("observaciones", e.target.value)}
                        />
                    </div>

                    <div className="pveh-form-row pveh-form-row--info">
                        <label>Registrado por</label>
                        <span className="pveh-form-static">{user?.name || "—"}</span>
                    </div>

                    <div className="pveh-form-btns">
                        <button
                            className="pveh-btn pveh-btn--primary"
                            disabled={!form.patente.trim() || !form.conductor.trim() || guardando}
                            onClick={handleAgregar}
                        >
                            {guardando ? "Guardando…" : "✅ Registrar entrada"}
                        </button>
                        <button className="pveh-btn pveh-btn--ghost" onClick={() => setMostrarForm(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <button className="pveh-btn pveh-btn--agregar" onClick={() => setMostrarForm(true)}>
                    + Registrar entrada de vehículo
                </button>
            )}

            {/* Firma electrónica */}
            {!mostrarFirma && !firmado && (
                <button className="pveh-btn pveh-btn--firmar" onClick={() => setMostrarFirma(true)}>
                    ✍️ Firmar planilla de vehículos
                </button>
            )}
            {(mostrarFirma || firmado) && (
                <FirmaPanel
                    tipo="planilla_vehiculos"
                    datos={{
                        objetivoId, objetivoNombre, clienteNombre,
                        fecha:          todayDate(),
                        totalMovimientos: registros.length,
                        enPuesto:       enPuesto.length,
                        registros:      registros.map(r => ({
                            codigoTrazabilidad: r.codigoTrazabilidad,
                            patente:            r.patente,
                            conductor:          r.conductor,
                            horaEntrada:        r.horaEntrada,
                            horaSalida:         r.horaSalida || null,
                            kmEntrada:          r.kmEntrada  ?? null,
                            kmSalida:           r.kmSalida   ?? null,
                            inventarioOk:       r.inventarioOk,
                            estado:             r.estado,
                        })),
                    }}
                    label="Firmar planilla de vehículos livianos"
                    obligatoria={false}
                    onFirmado={() => setFirmado(true)}
                    onOmitir={() => setMostrarFirma(false)}
                />
            )}

            <button className="pveh-btn pveh-btn--volver" onClick={onBack}>← Volver</button>
        </div>
    );
}
