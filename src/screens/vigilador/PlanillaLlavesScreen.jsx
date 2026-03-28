// src/screens/vigilador/PlanillaLlavesScreen.jsx
// Control de llaves — registro de entrega y recepción por turno.
//
// Lógica de inventario:
//   - Cada entrega sin devolución registrada = −1 en inventario
//   - Al cerrar el turno, llaves pendientes generan actividad para el guardia entrante
//
// Colección Firestore: controlLlaves

import { useState, useEffect, useCallback } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import {
    collection, query, where, getDocs,
    addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import FirmaPanel from "../../components/FirmaPanel";
import "./PlanillaLlavesScreen.css";

const COL = "controlLlaves";

function nowTime() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function todayDate() {
    return new Date().toISOString().slice(0, 10);
}
function fmtFecha(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}
function genCodigo() {
    return "LLA-" + Date.now().toString(36).toUpperCase().slice(-6);
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────
function FilaLlave({ reg, onDevolucion }) {
    const pendiente = reg.estado === "entregada";
    return (
        <tr className={`pll-tr${pendiente ? " pll-tr--pendiente" : ""}`}>
            <td>{fmtFecha(reg.fecha)}</td>
            <td>{reg.hora}</td>
            <td className="pll-td-llave">{reg.llaveNombre}</td>
            <td>{reg.retiraPersona}</td>
            <td>{reg.vigiladorEntrega}</td>
            <td>{reg.fechaDevolucion ? fmtFecha(reg.fechaDevolucion) : <span className="pll-pendiente">Pendiente</span>}</td>
            <td>{reg.horaDevolucion || "—"}</td>
            <td className={`pll-inv${pendiente ? " pll-inv--neg" : ""}`}>
                {pendiente ? "−1" : "OK"}
            </td>
            <td className="pll-td-codigo">{reg.codigoTrazabilidad || "—"}</td>
            <td>
                {pendiente && (
                    <button className="pll-btn-dev" onClick={() => onDevolucion(reg)}>
                        ↩ Devolver
                    </button>
                )}
            </td>
        </tr>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function PlanillaLlavesScreen({
    objetivoId,
    objetivoNombre,
    clienteNombre,
    onBack,
}) {
    const { user }      = useAuth();
    const { empresaId } = useAppData();

    const [registros,   setRegistros]   = useState([]);
    const [llavesList,  setLlavesList]  = useState([]); // llaves configuradas para este objetivo
    const [loading,     setLoading]     = useState(true);
    const [guardando,   setGuardando]   = useState(false);
    const [error,       setError]       = useState("");
    const [mostrarForm, setMostrarForm] = useState(false);
    const [mostrarFirma,setMostrarFirma]= useState(false);
    const [firmado,     setFirmado]     = useState(false);

    // Form de nueva entrega
    const [form, setForm] = useState({
        llaveNombre:    "",
        retiraPersona:  "",
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // ── Cargar registros del día y llaves configuradas ────────────────────────
    const cargar = useCallback(async () => {
        if (!empresaId || !objetivoId) return;
        setLoading(true);
        try {
            const [regSnap, confSnap] = await Promise.all([
                getDocs(query(
                    collection(db, COL),
                    where("empresaId",  "==", empresaId),
                    where("objetivoId", "==", objetivoId),
                    where("fecha",      "==", todayDate()),
                )),
                getDocs(query(
                    collection(db, "configuracionLlaves"),
                    where("empresaId",  "==", empresaId),
                    where("objetivoId", "==", objetivoId),
                )),
            ]);
            const regs = regSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
            setRegistros(regs);

            const llaves = confSnap.docs.flatMap(d => d.data().llaves || []);
            setLlavesList(llaves);
        } catch (e) {
            setError("Error al cargar: " + e.message);
        } finally {
            setLoading(false);
        }
    }, [empresaId, objetivoId]);

    useEffect(() => { cargar(); }, [cargar]);

    // ── Nueva entrega ─────────────────────────────────────────────────────────
    const handleAgregar = async () => {
        if (!form.llaveNombre.trim() || !form.retiraPersona.trim()) return;
        setGuardando(true);
        setError("");
        try {
            const nuevo = {
                empresaId,
                objetivoId,
                objetivoNombre:    objetivoNombre || "",
                clienteNombre:     clienteNombre  || "",
                fecha:             todayDate(),
                hora:              nowTime(),
                llaveNombre:       form.llaveNombre.trim(),
                retiraPersona:     form.retiraPersona.trim(),
                vigiladorEntrega:  user?.name || "",
                vigiladorEntregaId:user?.uid  || "",
                fechaDevolucion:   null,
                horaDevolucion:    null,
                estado:            "entregada",
                codigoTrazabilidad: genCodigo(),
                inventario:        -1,
                creadoEn:          serverTimestamp(),
            };
            const ref = await addDoc(collection(db, COL), nuevo);
            setRegistros(prev => [...prev, { id: ref.id, ...nuevo }]);
            setForm({ llaveNombre: "", retiraPersona: "" });
            setMostrarForm(false);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    // ── Registrar devolución ──────────────────────────────────────────────────
    const handleDevolucion = async (reg) => {
        const fecha = todayDate();
        const hora  = nowTime();
        try {
            await updateDoc(doc(db, COL, reg.id), {
                fechaDevolucion: fecha,
                horaDevolucion:  hora,
                estado:          "devuelta",
                inventario:      0,
            });
            setRegistros(prev => prev.map(r =>
                r.id === reg.id
                    ? { ...r, fechaDevolucion: fecha, horaDevolucion: hora, estado: "devuelta", inventario: 0 }
                    : r
            ));
        } catch (e) {
            setError("Error al registrar devolución: " + e.message);
        }
    };

    const pendientes  = registros.filter(r => r.estado === "entregada");
    const totalInv    = pendientes.length * -1;

    return (
        <div className="pll-root">
            {/* Encabezado estilo planilla */}
            <div className="pll-header">
                <div className="pll-header-logo">
                    <div className="pll-logo-text">BRINKS</div>
                    <div className="pll-logo-sub">SEGURIDAD CORPORATIVA</div>
                </div>
                <div className="pll-header-titulo">Control de llaves</div>
                <div className="pll-header-meta">
                    <span>{objetivoNombre}</span>
                    {clienteNombre && <span> · {clienteNombre}</span>}
                    <span> · {fmtFecha(todayDate())}</span>
                </div>
            </div>

            {error && <div className="pll-error">⚠️ {error}</div>}

            {/* Tabla */}
            <div className="pll-tabla-wrap">
                <table className="pll-tabla">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Nombre o N° de Llave</th>
                            <th>Nombre y apellido de quien retira</th>
                            <th>Vigilador que entrega</th>
                            <th>Fecha devolución</th>
                            <th>Hora devolución</th>
                            <th>Inventario</th>
                            <th>Código</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="pll-td-center">Cargando…</td></tr>
                        ) : registros.length === 0 ? (
                            <tr><td colSpan={10} className="pll-td-center pll-td-vacio">Sin registros hoy</td></tr>
                        ) : (
                            registros.map(reg => (
                                <FilaLlave
                                    key={reg.id}
                                    reg={reg}
                                    onDevolucion={handleDevolucion}
                                />
                            ))
                        )}
                    </tbody>
                    {registros.length > 0 && (
                        <tfoot>
                            <tr className="pll-tfoot">
                                <td colSpan={7} className="pll-tfoot-label">
                                    Balance de inventario del turno
                                </td>
                                <td className={`pll-inv pll-inv-total${totalInv < 0 ? " pll-inv--neg" : ""}`}>
                                    {totalInv === 0 ? "OK" : totalInv}
                                </td>
                                <td />
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Alerta llaves pendientes */}
            {pendientes.length > 0 && (
                <div className="pll-alerta-pendiente">
                    ⚠️ <strong>{pendientes.length} llave{pendientes.length > 1 ? "s" : ""} sin devolver</strong>
                    &nbsp;— Al cierre del turno quedará{pendientes.length > 1 ? "n" : ""} como actividad pendiente para el guardia entrante.
                </div>
            )}

            {/* Formulario nueva entrega */}
            {mostrarForm ? (
                <div className="pll-form">
                    <div className="pll-form-titulo">Nueva entrega de llave</div>
                    <div className="pll-form-row">
                        <label>Llave</label>
                        {llavesList.length > 0 ? (
                            <select
                                value={form.llaveNombre}
                                onChange={e => set("llaveNombre", e.target.value)}
                            >
                                <option value="">— Seleccionar llave —</option>
                                {llavesList.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                placeholder="Nombre o número de llave"
                                value={form.llaveNombre}
                                onChange={e => set("llaveNombre", e.target.value)}
                            />
                        )}
                    </div>
                    <div className="pll-form-row">
                        <label>Nombre y apellido de quien retira</label>
                        <input
                            type="text"
                            placeholder="Nombre completo"
                            value={form.retiraPersona}
                            onChange={e => set("retiraPersona", e.target.value)}
                        />
                    </div>
                    <div className="pll-form-row pll-form-row--info">
                        <label>Vigilador que entrega</label>
                        <span className="pll-form-static">{user?.name || "—"}</span>
                    </div>
                    <div className="pll-form-btns">
                        <button
                            className="pll-btn pll-btn--primary"
                            disabled={!form.llaveNombre.trim() || !form.retiraPersona.trim() || guardando}
                            onClick={handleAgregar}
                        >
                            {guardando ? "Guardando…" : "✅ Registrar entrega"}
                        </button>
                        <button
                            className="pll-btn pll-btn--ghost"
                            onClick={() => setMostrarForm(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    className="pll-btn pll-btn--agregar"
                    onClick={() => setMostrarForm(true)}
                >
                    + Registrar entrega de llave
                </button>
            )}

            {/* Firma */}
            {!mostrarFirma && !firmado && (
                <button
                    className="pll-btn pll-btn--firmar"
                    onClick={() => setMostrarFirma(true)}
                >
                    ✍️ Firmar planilla de llaves
                </button>
            )}
            {(mostrarFirma || firmado) && (
                <FirmaPanel
                    tipo="planilla_llaves"
                    datos={{
                        objetivoId,
                        objetivoNombre,
                        clienteNombre,
                        fecha:        todayDate(),
                        totalEntregas:registros.length,
                        pendientes:   pendientes.length,
                        inventario:   totalInv,
                        registros:    registros.map(r => ({
                            llaveNombre:      r.llaveNombre,
                            retiraPersona:    r.retiraPersona,
                            hora:             r.hora,
                            estado:           r.estado,
                            horaDevolucion:   r.horaDevolucion || null,
                        })),
                    }}
                    label="Firmar planilla de control de llaves"
                    obligatoria={false}
                    onFirmado={() => setFirmado(true)}
                    onOmitir={() => setMostrarFirma(false)}
                />
            )}

            <button className="pll-btn pll-btn--volver" onClick={onBack}>
                ← Volver
            </button>
        </div>
    );
}
