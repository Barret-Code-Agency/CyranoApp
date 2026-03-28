// src/screens/vigilador/PlanillaVisitasScreen.jsx
// Registro de visitas al puesto — ingreso/egreso con firma electrónica
//
// Colección Firestore: controlVisitas
// Campos por registro: empresaId, objetivoId, objetivoNombre, clienteNombre,
//   fecha, horaIngreso, nombre, dni, aQuienVisita, horaEgreso, observaciones,
//   estado ("en_planta"|"retirado"), codigoTrazabilidad, vigiladorRegistra,
//   vigiladorId, creadoEn

import { useState, useEffect, useCallback } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import {
    collection, query, where, getDocs,
    addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import FirmaPanel from "../../components/FirmaPanel";
import "./PlanillaVisitasScreen.css";

const COL = "controlVisitas";

function nowTime() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function todayDate() { return new Date().toISOString().slice(0, 10); }
function fmtFecha(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}
function genCodigo() {
    return "VIS-" + Date.now().toString(36).toUpperCase().slice(-6);
}

function FilaVisita({ reg, onEgreso }) {
    const enPlanta = reg.estado === "en_planta";
    return (
        <tr className={`pvs-tr${enPlanta ? " pvs-tr--en-planta" : ""}`}>
            <td>{fmtFecha(reg.fecha)}</td>
            <td>{reg.horaIngreso}</td>
            <td className="pvs-td-nombre">{reg.nombre}</td>
            <td>{reg.dni || "—"}</td>
            <td>{reg.aQuienVisita}</td>
            <td>{reg.horaEgreso || <span className="pvs-pendiente">En planta</span>}</td>
            <td>{reg.observaciones || "—"}</td>
            <td className="pvs-td-codigo">{reg.codigoTrazabilidad}</td>
            <td>
                {enPlanta && (
                    <button className="pvs-btn-dev" onClick={() => onEgreso(reg)}>
                        ↩ Egreso
                    </button>
                )}
            </td>
        </tr>
    );
}

export default function PlanillaVisitasScreen({
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

    const [form, setForm] = useState({ nombre: "", dni: "", aQuienVisita: "", observaciones: "" });
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
                    .sort((a, b) => (a.horaIngreso || "").localeCompare(b.horaIngreso || ""))
            );
        } catch (e) {
            setError("Error al cargar: " + e.message);
        } finally {
            setLoading(false);
        }
    }, [empresaId, objetivoId]);

    useEffect(() => { cargar(); }, [cargar]);

    const handleAgregar = async () => {
        if (!form.nombre.trim() || !form.aQuienVisita.trim()) return;
        setGuardando(true); setError("");
        try {
            const nuevo = {
                empresaId,
                objetivoId,
                objetivoNombre:     objetivoNombre || "",
                clienteNombre:      clienteNombre  || "",
                fecha:              todayDate(),
                horaIngreso:        nowTime(),
                nombre:             form.nombre.trim(),
                dni:                form.dni.trim(),
                aQuienVisita:       form.aQuienVisita.trim(),
                observaciones:      form.observaciones.trim(),
                horaEgreso:         null,
                estado:             "en_planta",
                codigoTrazabilidad: genCodigo(),
                vigiladorRegistra:  user?.name || "",
                vigiladorId:        user?.uid  || "",
                creadoEn:           serverTimestamp(),
            };
            const ref = await addDoc(collection(db, COL), nuevo);
            setRegistros(prev => [...prev, { id: ref.id, ...nuevo }]);
            setForm({ nombre: "", dni: "", aQuienVisita: "", observaciones: "" });
            setMostrarForm(false);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const handleEgreso = async (reg) => {
        const hora = nowTime();
        try {
            await updateDoc(doc(db, COL, reg.id), { horaEgreso: hora, estado: "retirado" });
            setRegistros(prev => prev.map(r =>
                r.id === reg.id ? { ...r, horaEgreso: hora, estado: "retirado" } : r
            ));
        } catch (e) {
            setError("Error al registrar egreso: " + e.message);
        }
    };

    const enPlanta = registros.filter(r => r.estado === "en_planta");

    return (
        <div className="pvs-root">
            <div className="pvs-header">
                <div className="pvs-header-logo">
                    <div className="pvs-logo-text">BRINKS</div>
                    <div className="pvs-logo-sub">SEGURIDAD CORPORATIVA</div>
                </div>
                <div className="pvs-header-titulo">Visitas</div>
                <div className="pvs-header-meta">
                    <span>{objetivoNombre}</span>
                    {clienteNombre && <span> · {clienteNombre}</span>}
                    <span> · {fmtFecha(todayDate())}</span>
                </div>
            </div>

            {error && <div className="pvs-error">⚠️ {error}</div>}

            <div className="pvs-tabla-wrap">
                <table className="pvs-tabla">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Hora ingreso</th>
                            <th>Nombre y apellido</th>
                            <th>DNI</th>
                            <th>A quién visita</th>
                            <th>Hora egreso</th>
                            <th>Observaciones</th>
                            <th>Código</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="pvs-td-center">Cargando…</td></tr>
                        ) : registros.length === 0 ? (
                            <tr><td colSpan={9} className="pvs-td-center pvs-td-vacio">Sin visitas registradas hoy</td></tr>
                        ) : (
                            registros.map(reg => (
                                <FilaVisita key={reg.id} reg={reg} onEgreso={handleEgreso} />
                            ))
                        )}
                    </tbody>
                    {registros.length > 0 && (
                        <tfoot>
                            <tr className="pvs-tfoot">
                                <td colSpan={9} className="pvs-tfoot-label">
                                    Total: {registros.length} visita{registros.length !== 1 ? "s" : ""} · En planta: {enPlanta.length}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {enPlanta.length > 0 && (
                <div className="pvs-alerta-pendiente">
                    ⚠️ <strong>{enPlanta.length} visita{enPlanta.length > 1 ? "s" : ""} aún en planta</strong> — Registrá el egreso cuando se retiren.
                </div>
            )}

            {mostrarForm ? (
                <div className="pvs-form">
                    <div className="pvs-form-titulo">Registrar visita</div>
                    <div className="pvs-form-row">
                        <label>Nombre y apellido *</label>
                        <input type="text" placeholder="Nombre completo" value={form.nombre}
                            onChange={e => set("nombre", e.target.value)} />
                    </div>
                    <div className="pvs-form-row">
                        <label>DNI</label>
                        <input type="text" placeholder="Número de documento" value={form.dni}
                            onChange={e => set("dni", e.target.value)} />
                    </div>
                    <div className="pvs-form-row">
                        <label>A quién visita *</label>
                        <input type="text" placeholder="Nombre de la persona a visitar" value={form.aQuienVisita}
                            onChange={e => set("aQuienVisita", e.target.value)} />
                    </div>
                    <div className="pvs-form-row">
                        <label>Observaciones</label>
                        <input type="text" placeholder="Opcional" value={form.observaciones}
                            onChange={e => set("observaciones", e.target.value)} />
                    </div>
                    <div className="pvs-form-row pvs-form-row--info">
                        <label>Registrado por</label>
                        <span className="pvs-form-static">{user?.name || "—"}</span>
                    </div>
                    <div className="pvs-form-btns">
                        <button
                            className="pvs-btn pvs-btn--primary"
                            disabled={!form.nombre.trim() || !form.aQuienVisita.trim() || guardando}
                            onClick={handleAgregar}
                        >
                            {guardando ? "Guardando…" : "✅ Registrar ingreso"}
                        </button>
                        <button className="pvs-btn pvs-btn--ghost" onClick={() => setMostrarForm(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <button className="pvs-btn pvs-btn--agregar" onClick={() => setMostrarForm(true)}>
                    + Registrar visita
                </button>
            )}

            {!mostrarFirma && !firmado && (
                <button className="pvs-btn pvs-btn--firmar" onClick={() => setMostrarFirma(true)}>
                    ✍️ Firmar planilla de visitas
                </button>
            )}
            {(mostrarFirma || firmado) && (
                <FirmaPanel
                    tipo="planilla_visitas"
                    datos={{
                        objetivoId, objetivoNombre, clienteNombre,
                        fecha:        todayDate(),
                        totalVisitas: registros.length,
                        enPlanta:     enPlanta.length,
                        registros:    registros.map(r => ({
                            codigoTrazabilidad: r.codigoTrazabilidad,
                            nombre:             r.nombre,
                            dni:                r.dni,
                            horaIngreso:        r.horaIngreso,
                            horaEgreso:         r.horaEgreso || null,
                            estado:             r.estado,
                        })),
                    }}
                    label="Firmar planilla de visitas"
                    obligatoria={false}
                    onFirmado={() => setFirmado(true)}
                    onOmitir={() => setMostrarFirma(false)}
                />
            )}

            <button className="pvs-btn pvs-btn--volver" onClick={onBack}>← Volver</button>
        </div>
    );
}
