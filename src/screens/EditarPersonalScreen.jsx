// src/screens/EditarPersonalScreen.jsx
// Edición de datos de personal — acceso desde AdministrativoHome
import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAppData } from "../context/AppDataContext";
import "../styles/EditarPersonalScreen.css";

const CAMPOS = [
    { key: "nombre",       label: "Nombre completo",                  type: "text"   },
    { key: "cargo",        label: "Cargo",                            type: "text"   },
    { key: "tarea",        label: "Función / Tarea",                  type: "text"   },
    { key: "sexo",         label: "Sexo",                             type: "select", opts: ["M", "F"] },
    { key: "telefono",     label: "Teléfono",                         type: "text"   },
    { key: "domicilio",    label: "Domicilio",                        type: "text"   },
    { key: "nacimiento",   label: "Fecha de nacimiento (DD/MM/AAAA)", type: "text"   },
    { key: "fechaIngreso", label: "Fecha de ingreso (DD/MM/AAAA)",    type: "text"   },
    { key: "servicio",     label: "Servicio / Objetivo",              type: "text"   },
    { key: "proyecto",     label: "Proyecto / Contrato",              type: "text"   },
    { key: "sucursal",     label: "Sucursal",                         type: "text"   },
    { key: "zona",         label: "Zona",                             type: "text"   },
    { key: "hijos",        label: "Cantidad de hijos",                type: "text"   },
    { key: "centroCosto",  label: "Centro de costo",                  type: "text"   },
    { key: "cuil",         label: "CUIL",                             type: "text"   },
    { key: "regimen",      label: "Régimen",                          type: "select", opts: ["", "4 x 2 x 12", "5 x 2 x 12", "6 x 1 x 8", "12 x 36", "14 x 14 x 12", "14 x 14 x 8", "200"] },
    { key: "grupoTurno14", label: "Grupo Turno 14×14",                type: "select", opts: ["", "3", "4"] },
];

export default function EditarPersonalScreen({ onBack }) {
    const { empresaNombre } = useAppData();
    const [todos,        setTodos]        = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [busqueda,     setBusqueda]     = useState("");
    const [seleccionado, setSeleccionado] = useState(null);
    const [form,         setForm]         = useState({});
    const [guardando,    setGuardando]    = useState(false);
    const [msg,          setMsg]          = useState(null);

    useEffect(() => {
        const cargar = async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, "legajos"), where("empresa", "==", empresaNombre))
                );
                const docs = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
                // Dedup por legajo
                const vistos = new Set();
                const unicos = docs.filter(p => {
                    const key = p.legajo || p._docId;
                    if (vistos.has(key)) return false;
                    vistos.add(key); return true;
                });
                setTodos(unicos.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [empresaNombre]);

    const resultados = busqueda.length >= 2
        ? todos.filter(p =>
            (p.nombre  || "").toLowerCase().includes(busqueda.toLowerCase()) ||
            (p.legajo  || "").toLowerCase().includes(busqueda.toLowerCase()) ||
            (p.dni     || "").includes(busqueda)
          ).slice(0, 10)
        : [];

    const abrir = (p) => {
        setSeleccionado(p);
        setForm(Object.fromEntries(CAMPOS.map(c => [c.key, p[c.key] ?? ""])));
        setMsg(null);
        setBusqueda("");
    };

    const guardar = async () => {
        setGuardando(true); setMsg(null);
        try {
            await updateDoc(doc(db, "legajos", seleccionado._docId), form);
            setTodos(prev => prev.map(p =>
                p._docId === seleccionado._docId ? { ...p, ...form } : p
            ));
            setSeleccionado(prev => ({ ...prev, ...form }));
            setMsg({ ok: true, texto: "✅ Datos actualizados correctamente." });
        } catch (e) {
            setMsg({ ok: false, texto: "❌ Error: " + e.message });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="ep-root">
            {/* Header */}
            <div className="ep-header">
                <button className="ep-back-btn" onClick={onBack}>← Volver</button>
                <div className="ep-header-title">📋 Legajos del personal</div>
                <div className="ep-header-sub">{empresaNombre} · {todos.length} personas</div>
            </div>

            {/* Vista búsqueda */}
            {!seleccionado && (
                <div className="ep-search-card">
                    <div className="ep-search-label">Buscá por nombre, número de legajo o DNI</div>
                    <input
                        className="ep-search-input"
                        placeholder="🔍 Ej: García, 20045, 30123456…"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        autoFocus
                        autoComplete="off"
                    />

                    {loading && <div className="ep-hint">Cargando personal…</div>}
                    {!loading && busqueda.length >= 2 && resultados.length === 0 && (
                        <div className="ep-hint">Sin resultados para "{busqueda}"</div>
                    )}
                    {!loading && busqueda.length < 2 && (
                        <div className="ep-hint">Escribí al menos 2 caracteres para buscar.</div>
                    )}

                    {resultados.length > 0 && (
                        <div className="ep-resultados">
                            {resultados.map(p => (
                                <button key={p._docId} className="ep-result-item" onClick={() => abrir(p)}>
                                    <div className="ep-avatar">{(p.nombre || "?").charAt(0)}</div>
                                    <div className="ep-result-info">
                                        <div className="ep-result-nombre">{p.nombre}</div>
                                        <div className="ep-result-meta">
                                            Legajo {p.legajo}
                                            {p.cargo ? ` · ${p.cargo}` : ""}
                                            {p.servicio ? ` · ${p.servicio}` : ""}
                                        </div>
                                    </div>
                                    <span className="ep-result-arrow">›</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Formulario de edición */}
            {seleccionado && (
                <div className="ep-form-card">
                    <div className="ep-form-persona">
                        <div className="ep-avatar ep-avatar--lg">{(seleccionado.nombre || "?").charAt(0)}</div>
                        <div>
                            <div className="ep-form-nombre">{seleccionado.nombre}</div>
                            <div className="ep-form-meta">Legajo {seleccionado.legajo} · DNI {seleccionado.dni}</div>
                        </div>
                        <button className="ep-volver-btn" onClick={() => { setSeleccionado(null); setMsg(null); }}>
                            ← Otra persona
                        </button>
                    </div>

                    {msg && (
                        <div className={`ep-msg ${msg.ok ? "ep-msg--ok" : "ep-msg--err"}`}>{msg.texto}</div>
                    )}

                    <div className="ep-form-grid">
                        {CAMPOS.map(c => (
                            <div key={c.key} className="ep-field">
                                <label className="ep-label">{c.label}</label>
                                {c.type === "select" ? (
                                    <select
                                        className="ep-input"
                                        value={form[c.key] || ""}
                                        onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                                    >
                                        {c.opts.map(o => <option key={o} value={o}>{o === "" ? "— Sin asignar —" : o === "M" ? "Masculino" : o === "F" ? "Femenino" : o}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        className="ep-input"
                                        type="text"
                                        value={form[c.key] || ""}
                                        onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="ep-form-actions">
                        <button className="ep-btn-save" onClick={guardar} disabled={guardando}>
                            {guardando ? "Guardando…" : "💾 Guardar cambios"}
                        </button>
                        <button className="ep-btn-cancel" onClick={() => { setSeleccionado(null); setMsg(null); }}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
