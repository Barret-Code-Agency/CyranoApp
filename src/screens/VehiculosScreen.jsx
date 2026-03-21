// src/screens/VehiculosScreen.jsx
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import "./VehiculosScreen.css";

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPOS = ["Service", "Reparación", "Revisión", "Cambio de aceite", "Neumáticos", "Otro"];
const MONEDAS = ["ARS", "USD"];
const TIPO_ICON = {
    "Service": "🔧", "Reparación": "🛠️", "Revisión": "🔍",
    "Cambio de aceite": "🛢️", "Neumáticos": "🔄", "Otro": "📋"
};
const TIPO_COLOR = {
    "Service": "blue", "Reparación": "red", "Revisión": "green",
    "Cambio de aceite": "orange", "Neumáticos": "purple", "Otro": "gray"
};

const fmtFecha = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
};

const fmtCosto = (costo, moneda) => {
    if (!costo) return "—";
    return new Intl.NumberFormat("es-AR", {
        style: "currency", currency: moneda || "ARS", maximumFractionDigits: 0
    }).format(costo);
};

const diasLabel = (dias) => {
    if (dias < 0)  return { txt: `Vencido hace ${Math.abs(dias)} días`, cls: "vencido" };
    if (dias === 0) return { txt: "Vence hoy", cls: "vencido" };
    if (dias <= 7)  return { txt: `Vence en ${dias} días`, cls: "urgente" };
    return { txt: `Vence en ${dias} días`, cls: "proximo" };
};

const hoy = () => new Date().toISOString().slice(0, 10);

// ── Formulario nuevo/editar evento ───────────────────────────────────────────
const EMPTY_FORM = {
    fecha: hoy(), tipo: "Service", vehiculo: "",
    descripcion: "", costo: "", moneda: "ARS",
    proveedor: "", kmActual: "",
    proximoServiceFecha: "", proximoServiceKm: "",
};

function EventoForm({ vehiculos, inicial, onSave, onCancel }) {
    const [form, setForm] = useState(inicial || EMPTY_FORM);
    const [error, setError] = useState("");

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = () => {
        if (!form.vehiculo) return setError("Seleccioná un vehículo.");
        if (!form.descripcion.trim()) return setError("Ingresá una descripción.");
        setError("");
        onSave({
            ...form,
            costo: form.costo ? parseFloat(form.costo) : null,
            kmActual: form.kmActual ? parseInt(form.kmActual) : null,
            proximoService: form.proximoServiceFecha || form.proximoServiceKm ? {
                fecha: form.proximoServiceFecha || null,
                km:    form.proximoServiceKm ? parseInt(form.proximoServiceKm) : null,
            } : null,
        });
    };

    return (
        <div className="veh-form-wrap">
            <div className="veh-form-title">{inicial?.id ? "Editar evento" : "Nuevo evento de mantenimiento"}</div>

            <div className="veh-form-grid">
                <div className="field">
                    <label className="label">Vehículo *</label>
                    <select value={form.vehiculo} onChange={e => set("vehiculo", e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        {vehiculos.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>

                <div className="field">
                    <label className="label">Tipo *</label>
                    <select value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                        {TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>

                <div className="field">
                    <label className="label">Fecha</label>
                    <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
                </div>

                <div className="field">
                    <label className="label">KM al momento del service</label>
                    <input type="number" placeholder="Ej: 45000" value={form.kmActual} onChange={e => set("kmActual", e.target.value)} />
                </div>
            </div>

            <div className="field">
                <label className="label">Descripción del trabajo *</label>
                <textarea
                    placeholder="Describí el trabajo realizado..."
                    value={form.descripcion}
                    onChange={e => set("descripcion", e.target.value)}
                    style={{ minHeight: 80 }}
                />
            </div>

            <div className="field">
                <label className="label">Proveedor / Taller</label>
                <input
                    type="text"
                    placeholder="Nombre del taller o proveedor"
                    value={form.proveedor}
                    onChange={e => set("proveedor", e.target.value)}
                />
            </div>

            <div className="veh-form-row-costo">
                <div className="field" style={{ flex: 1 }}>
                    <label className="label">Costo total</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={form.costo}
                        onChange={e => set("costo", e.target.value)}
                    />
                </div>
                <div className="field" style={{ width: 90 }}>
                    <label className="label">Moneda</label>
                    <select value={form.moneda} onChange={e => set("moneda", e.target.value)}>
                        {MONEDAS.map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            <div className="veh-form-section-title">Próximo service / vencimiento</div>
            <div className="veh-form-grid">
                <div className="field">
                    <label className="label">Fecha</label>
                    <input
                        type="date"
                        value={form.proximoServiceFecha}
                        onChange={e => set("proximoServiceFecha", e.target.value)}
                    />
                </div>
                <div className="field">
                    <label className="label">KM estimado</label>
                    <input
                        type="number"
                        placeholder="Ej: 50000"
                        value={form.proximoServiceKm}
                        onChange={e => set("proximoServiceKm", e.target.value)}
                    />
                </div>
            </div>

            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSubmit}>
                    {inicial?.id ? "Guardar cambios" : "Registrar"}
                </button>
                <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            </div>
        </div>
    );
}

// ── Tarjeta de evento ─────────────────────────────────────────────────────────
function EventoCard({ ev, canEdit, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);

    const colorCls = TIPO_COLOR[ev.tipo] || "gray";
    const alerta = ev.proximoService?.fecha
        ? (() => {
            const hoyD = new Date(); hoyD.setHours(0,0,0,0);
            const dias = Math.round((new Date(ev.proximoService.fecha) - hoyD) / 86400000);
            return dias <= 30 ? diasLabel(dias) : null;
        })()
        : null;

    return (
        <div className={`veh-card tipo-${colorCls}`}>
            <div className="veh-card-header" onClick={() => setExpanded(e => !e)}>
                <div className="veh-card-icon">{TIPO_ICON[ev.tipo] || "📋"}</div>
                <div className="veh-card-main">
                    <div className="veh-card-tipo">{ev.tipo}</div>
                    <div className="veh-card-vehiculo">{ev.vehiculo}</div>
                    <div className="veh-card-fecha">{fmtFecha(ev.fecha)}{ev.kmActual ? ` · ${ev.kmActual.toLocaleString()} km` : ""}</div>
                </div>
                <div className="veh-card-right">
                    {ev.costo && (
                        <div className="veh-card-costo">{fmtCosto(ev.costo, ev.moneda)}</div>
                    )}
                    {alerta && (
                        <div className={`veh-alert-badge ${alerta.cls}`}>{alerta.txt}</div>
                    )}
                    <span className="veh-card-chevron">{expanded ? "▲" : "▼"}</span>
                </div>
            </div>

            {expanded && (
                <div className="veh-card-detail">
                    <div className="veh-detail-row">
                        <span className="veh-detail-k">Descripción</span>
                        <span className="veh-detail-v">{ev.descripcion}</span>
                    </div>
                    {ev.proveedor && (
                        <div className="veh-detail-row">
                            <span className="veh-detail-k">Taller / Proveedor</span>
                            <span className="veh-detail-v">{ev.proveedor}</span>
                        </div>
                    )}
                    {ev.costo && (
                        <div className="veh-detail-row">
                            <span className="veh-detail-k">Costo</span>
                            <span className="veh-detail-v">{fmtCosto(ev.costo, ev.moneda)}</span>
                        </div>
                    )}
                    {ev.kmActual && (
                        <div className="veh-detail-row">
                            <span className="veh-detail-k">KM al service</span>
                            <span className="veh-detail-v">{ev.kmActual.toLocaleString()} km</span>
                        </div>
                    )}
                    {ev.proximoService && (
                        <div className="veh-detail-row">
                            <span className="veh-detail-k">Próximo service</span>
                            <span className="veh-detail-v">
                                {ev.proximoService.fecha ? fmtFecha(ev.proximoService.fecha) : ""}
                                {ev.proximoService.fecha && ev.proximoService.km ? " · " : ""}
                                {ev.proximoService.km ? `${ev.proximoService.km.toLocaleString()} km` : ""}
                            </span>
                        </div>
                    )}

                    {canEdit && (
                        <div className="veh-card-actions">
                            <button className="veh-btn-edit" onClick={() => onEdit(ev)}>✏️ Editar</button>
                            {!confirmDel ? (
                                <button className="veh-btn-del" onClick={() => setConfirmDel(true)}>🗑 Eliminar</button>
                            ) : (
                                <>
                                    <button className="veh-btn-del-confirm" onClick={() => onDelete(ev.id)}>Confirmar</button>
                                    <button className="veh-btn-cancel" onClick={() => setConfirmDel(false)}>Cancelar</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Resumen de costos ─────────────────────────────────────────────────────────
function ResumenCostos({ eventos }) {
    const [periodo, setPeriodo] = useState("mes");

    const filtrado = useMemo(() => {
        const hoyD = new Date();
        return eventos.filter(e => {
            if (!e.fecha || !e.costo) return false;
            const d = new Date(e.fecha);
            if (periodo === "mes")  return d.getMonth() === hoyD.getMonth() && d.getFullYear() === hoyD.getFullYear();
            if (periodo === "año")  return d.getFullYear() === hoyD.getFullYear();
            return true;
        });
    }, [eventos, periodo]);

    const totalARS = filtrado.filter(e => e.moneda === "ARS" || !e.moneda).reduce((s, e) => s + (e.costo || 0), 0);
    const totalUSD = filtrado.filter(e => e.moneda === "USD").reduce((s, e) => s + (e.costo || 0), 0);

    // Por vehículo
    const porVehiculo = useMemo(() => {
        const map = {};
        filtrado.forEach(e => {
            if (!map[e.vehiculo]) map[e.vehiculo] = { ars: 0, usd: 0, count: 0 };
            if (e.moneda === "USD") map[e.vehiculo].usd += e.costo || 0;
            else map[e.vehiculo].ars += e.costo || 0;
            map[e.vehiculo].count++;
        });
        return Object.entries(map).sort((a, b) => b[1].ars - a[1].ars);
    }, [filtrado]);

    // Por tipo
    const porTipo = useMemo(() => {
        const map = {};
        filtrado.forEach(e => {
            if (!map[e.tipo]) map[e.tipo] = 0;
            if (!e.moneda || e.moneda === "ARS") map[e.tipo] += e.costo || 0;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [filtrado]);

    return (
        <div className="veh-resumen">
            <div className="veh-resumen-tabs">
                {["mes", "año", "todo"].map(p => (
                    <button key={p} className={`veh-resumen-tab ${periodo === p ? "active" : ""}`} onClick={() => setPeriodo(p)}>
                        {p === "mes" ? "Este mes" : p === "año" ? "Este año" : "Todo"}
                    </button>
                ))}
            </div>

            <div className="veh-totales">
                {totalARS > 0 && (
                    <div className="veh-total-item">
                        <div className="veh-total-val">{fmtCosto(totalARS, "ARS")}</div>
                        <div className="veh-total-label">{filtrado.filter(e => !e.moneda || e.moneda === "ARS").length} eventos en ARS</div>
                    </div>
                )}
                {totalUSD > 0 && (
                    <div className="veh-total-item usd">
                        <div className="veh-total-val">{fmtCosto(totalUSD, "USD")}</div>
                        <div className="veh-total-label">{filtrado.filter(e => e.moneda === "USD").length} eventos en USD</div>
                    </div>
                )}
                {totalARS === 0 && totalUSD === 0 && (
                    <div className="veh-empty">Sin costos registrados en este período.</div>
                )}
            </div>

            {porVehiculo.length > 0 && (
                <>
                    <div className="veh-resumen-subtitle">Por vehículo</div>
                    {porVehiculo.map(([veh, data]) => (
                        <div key={veh} className="veh-resumen-row">
                            <div className="veh-resumen-row-name" title={veh}>
                                🚗 {veh.split("—").slice(-1)[0].trim()}
                            </div>
                            <div className="veh-resumen-row-vals">
                                {data.ars > 0 && <span>{fmtCosto(data.ars, "ARS")}</span>}
                                {data.usd > 0 && <span className="usd">{fmtCosto(data.usd, "USD")}</span>}
                                <span className="veh-resumen-row-count">{data.count} evento{data.count !== 1 ? "s" : ""}</span>
                            </div>
                        </div>
                    ))}
                </>
            )}

            {porTipo.length > 0 && (
                <>
                    <div className="veh-resumen-subtitle" style={{ marginTop: 12 }}>Por tipo (ARS)</div>
                    {porTipo.map(([tipo, total]) => (
                        <div key={tipo} className="veh-resumen-row">
                            <div className="veh-resumen-row-name">{TIPO_ICON[tipo]} {tipo}</div>
                            <div className="veh-resumen-row-vals">
                                <span>{fmtCosto(total, "ARS")}</span>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

// ── Alertas ───────────────────────────────────────────────────────────────────
function AlertasPanel({ alertas }) {
    if (alertas.length === 0) return (
        <div className="veh-empty veh-empty-block">✅ Sin services próximos o vencidos en los próximos 30 días.</div>
    );
    return (
        <div className="veh-alertas">
            {alertas.map(a => {
                const lbl = diasLabel(a.diasRestantes);
                return (
                    <div key={a.id} className={`veh-alerta-row ${lbl.cls}`}>
                        <div className="veh-alerta-icon">{a.diasRestantes < 0 ? "🔴" : a.diasRestantes <= 7 ? "🟠" : "🟡"}</div>
                        <div className="veh-alerta-body">
                            <div className="veh-alerta-vehiculo">{a.vehiculo}</div>
                            <div className="veh-alerta-tipo">{a.tipo} — {a.descripcion?.slice(0, 50)}</div>
                            <div className={`veh-alerta-fecha ${lbl.cls}`}>{lbl.txt} · {fmtFecha(a.proximoService.fecha)}</div>
                            {a.proximoService.km && (
                                <div className="veh-alerta-km">Próximo a {a.proximoService.km.toLocaleString()} km</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function VehiculosScreen({ canEdit = true }) {
    const { data, mantenimiento, addMantenimiento, updateMantenimiento, deleteMantenimiento, getAlertasMantenimiento } = useAppData();

    const [tab,         setTab]         = useState("historial");
    const [showForm,    setShowForm]    = useState(false);
    const [editando,    setEditando]    = useState(null);
    const [filtroVeh,   setFiltroVeh]   = useState("todos");
    const [filtroTipo,  setFiltroTipo]  = useState("todos");
    const [busqueda,    setBusqueda]    = useState("");

    const alertas = getAlertasMantenimiento();

    const eventosFiltrados = useMemo(() => {
        return mantenimiento
            .filter(e => filtroVeh  === "todos" || e.vehiculo === filtroVeh)
            .filter(e => filtroTipo === "todos" || e.tipo     === filtroTipo)
            .filter(e => !busqueda  || e.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
                                    || e.proveedor?.toLowerCase().includes(busqueda.toLowerCase())
                                    || e.vehiculo?.toLowerCase().includes(busqueda.toLowerCase()))
            .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    }, [mantenimiento, filtroVeh, filtroTipo, busqueda]);

    const handleSave = (datos) => {
        if (editando?.id) {
            updateMantenimiento(editando.id, datos);
        } else {
            addMantenimiento(datos);
        }
        setShowForm(false);
        setEditando(null);
        setTab("historial");
    };

    const handleEdit = (ev) => {
        setEditando({
            ...ev,
            proximoServiceFecha: ev.proximoService?.fecha || "",
            proximoServiceKm:    ev.proximoService?.km?.toString() || "",
            costo:               ev.costo?.toString() || "",
            kmActual:            ev.kmActual?.toString() || "",
        });
        setShowForm(true);
    };

    const TABS = [
        { key: "historial", label: "Historial", icon: "📋" },
        { key: "costos",    label: "Costos",    icon: "💰" },
        { key: "alertas",   label: "Alertas",   icon: alertas.length > 0 ? `🔴 ${alertas.length}` : "🟢" },
    ];

    return (
        <div className="veh-screen">
            <div className="screen-title">Vehículos</div>
            <div className="screen-sub">Mantenimiento, services y costos de la flota</div>

            {/* Tabs */}
            <div className="veh-tabs">
                {TABS.map(t => (
                    <button key={t.key} className={`veh-tab ${tab === t.key ? "active" : ""}`} onClick={() => { setTab(t.key); setShowForm(false); }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Formulario */}
            {showForm && (
                <EventoForm
                    vehiculos={data.vehiculos || []}
                    inicial={editando}
                    onSave={handleSave}
                    onCancel={() => { setShowForm(false); setEditando(null); }}
                />
            )}

            {/* ── HISTORIAL ── */}
            {tab === "historial" && !showForm && (
                <>
                    {/* Filtros */}
                    <div className="veh-filtros">
                        <input
                            className="veh-busqueda"
                            placeholder="🔍 Buscar por descripción, taller o vehículo..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                        />
                        <div className="veh-filtros-row">
                            <select value={filtroVeh} onChange={e => setFiltroVeh(e.target.value)}>
                                <option value="todos">Todos los vehículos</option>
                                {(data.vehiculos || []).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                                <option value="todos">Todos los tipos</option>
                                {TIPOS.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {eventosFiltrados.length === 0 ? (
                        <div className="veh-empty veh-empty-block">
                            {mantenimiento.length === 0
                                ? "No hay registros de mantenimiento aún. Agregá el primero."
                                : "Sin resultados para los filtros seleccionados."}
                        </div>
                    ) : (
                        eventosFiltrados.map(ev => (
                            <EventoCard
                                key={ev.id}
                                ev={ev}
                                canEdit={canEdit}
                                onEdit={handleEdit}
                                onDelete={deleteMantenimiento}
                            />
                        ))
                    )}

                    {canEdit && !showForm && (
                        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => { setShowForm(true); setEditando(null); }}>
                            + Registrar mantenimiento
                        </button>
                    )}
                </>
            )}

            {/* ── COSTOS ── */}
            {tab === "costos" && !showForm && (
                <ResumenCostos eventos={mantenimiento} />
            )}

            {/* ── ALERTAS ── */}
            {tab === "alertas" && !showForm && (
                <AlertasPanel alertas={alertas} />
            )}
        </div>
    );
}
