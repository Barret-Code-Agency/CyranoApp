// src/screens/shared/PedidoInsumosScreen.jsx
// Pedido de insumos — disponible para Vigilador, Supervisor y Administrativo.

import { useState, useMemo } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import "./PedidoInsumosScreen.css";

const SECCIONES_INSUMOS = [
    { id: "libreria",    icon: "✏️", titulo: "Librería", items: [
        "Lapiceras negras (caja x 50)",
        "Corrector líquido (caja x 12)",
        "Resaltadores flúor (caja x 12)",
        "Adhesivo en barra (caja x 30)",
        "Cinta de embalar transparente (pack x 36)",
        "Ganchos para abrochadora N°24/6 (caja x 1000)",
        "Ganchos para abrochadora N°26/6 (caja x 1000)",
        "Papel carbónico negro (sobre x 50)",
        "Papel taco adhesivo color 9x9cm (taco x 10)",
        "Hojas A4 para plastificado (pack x 50)",
        "Hojas A3 para plastificado (pack x 50)",
        "Folios A4 reforzados 70 micrones (pack x 10)",
        "Regla 30cm (unidad)",
        "Abrochadora grande (unidad)",
        "Resma papel carta 75g x 500h (caja x 10)",
        "Tóner de impresora",
        "Cartucho de impresora",
        "Tabla portablock con tapa oficio (unidad)",
    ]},
    { id: "comestibles", icon: "🍎", titulo: "Insumos comestibles", items: [
        "Café instantáneo","Café de filtro","Azúcar","Edulcorante","Yerba",
        "Agua (bidón)","Leche en polvo","Mate cocido / Saquitos","Té / Saquitos",
    ]},
    { id: "vehiculo",    icon: "⛽", titulo: "Para vehículo", items: [
        "Tarjeta YPF en ruta","Aceite de motor","Agua destilada","Líquido de frenos",
        "Limpiaparabrisas","Kit de herramientas","Mantenimiento preventivo","Mantenimiento correctivo",
    ]},
];

const ITEMS_CON_MODELO = new Set(["Tóner de impresora", "Cartucho de impresora"]);

function generarNumero() {
    const hoy  = new Date();
    const yyyy = hoy.getFullYear();
    const mm   = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd   = String(hoy.getDate()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    return `PI-${yyyy}${mm}${dd}-${rand}`;
}

export default function PedidoInsumosScreen({ onBack }) {
    const { user }   = useAuth();
    const { data, empresaId, empresaNombre } = useAppData();
    const vehiculos  = data?.vehiculos ?? [];

    const numeroPedido = useMemo(generarNumero, []);
    const hoy          = new Date();
    const fechaStr     = hoy.toLocaleDateString("es-AR");

    const initEntradas = () => [{ modelo: "", cantidad: 1 }];

    const [cantidades,    setCantidades]    = useState({});
    const [multiEntradas, setMultiEntradas] = useState({});
    const [vehiculoRef,   setVehiculoRef]   = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [enviando,      setEnviando]      = useState(false);
    const [enviado,       setEnviado]       = useState(false);
    const [error,         setError]         = useState(null);

    const getQty      = (secId, item) => cantidades[`${secId}__${item}`] ?? 0;
    const setQty      = (secId, item, val) =>
        setCantidades(prev => ({ ...prev, [`${secId}__${item}`]: Math.max(0, Number(val)) }));

    const getEntradas = (secId, item) => multiEntradas[`${secId}__${item}`] ?? initEntradas();
    const updEntradas = (secId, item, fn) =>
        setMultiEntradas(prev => {
            const key = `${secId}__${item}`;
            return { ...prev, [key]: fn(prev[key] ?? initEntradas()) };
        });
    const addEntrada = (secId, item) =>
        updEntradas(secId, item, list => [...list, { modelo: "", cantidad: 1 }]);
    const setEntrada = (secId, item, idx, field, val) =>
        updEntradas(secId, item, list =>
            list.map((e, i) => i === idx ? { ...e, [field]: field === "cantidad" ? Math.max(0, Number(val)) : val } : e)
        );
    const delEntrada = (secId, item, idx) =>
        updEntradas(secId, item, list => list.filter((_, i) => i !== idx));

    const totalItems = Object.values(cantidades).filter(v => v > 0).length
        + Object.values(multiEntradas).flat().filter(e => e.cantidad > 0).length;

    const enviar = async () => {
        setEnviando(true);
        setError(null);
        const items = [];
        SECCIONES_INSUMOS.forEach(sec => {
            sec.items.forEach(item => {
                if (ITEMS_CON_MODELO.has(item)) {
                    getEntradas(sec.id, item).forEach(e => {
                        if (e.cantidad > 0)
                            items.push({ seccion: sec.titulo, item, cantidad: e.cantidad, modelo: e.modelo });
                    });
                } else {
                    const qty = getQty(sec.id, item);
                    if (qty > 0) items.push({ seccion: sec.titulo, item, cantidad: qty });
                }
            });
        });
        try {
            await addDoc(collection(db, "pedidosInsumos"), {
                numero:        numeroPedido,
                fecha:         fechaStr,
                solicitante:   user?.name   ?? "",
                solicitanteId: user?.uid    ?? "",
                empresa:       empresaNombre ?? "",
                empresaId:     empresaId    ?? "",
                items,
                vehiculo:      vehiculoRef || null,
                observaciones,
                estado:        "pendiente",
                creadoEn:      serverTimestamp(),
            });
            setEnviado(true);
        } catch (e) {
            setError("Error al enviar: " + e.message);
        } finally {
            setEnviando(false);
        }
    };

    if (enviado) {
        return (
            <div className="pi-root">
                <div className="pi-subpanel-top">
                    <button className="pi-back" onClick={onBack}>← Volver al panel</button>
                    <div className="pi-titulo">📦 Pedido de Insumos</div>
                </div>
                <div className="pi-success">
                    <div className="pi-success-icon">✅</div>
                    <div className="pi-success-title">¡Pedido enviado!</div>
                    <div className="pi-success-num">{numeroPedido}</div>
                    <div className="pi-success-sub">Tu pedido fue registrado y será gestionado a la brevedad.</div>
                    <button className="pi-back-btn" onClick={onBack}>← Volver al panel</button>
                </div>
            </div>
        );
    }

    return (
        <div className="pi-root">
            <div className="pi-subpanel-top">
                <button className="pi-back" onClick={onBack}>← Volver al panel</button>
                <div className="pi-titulo">📦 Pedido de Insumos</div>
            </div>

            <div className="pi-body">

                {/* Tarjeta de identificación del pedido */}
                <div className="pi-id-card">
                    <div className="pi-id-row">
                        <span className="pi-id-label">Nro. de pedido</span>
                        <span className="pi-id-val pi-id-val--num">{numeroPedido}</span>
                    </div>
                    <div className="pi-id-row">
                        <span className="pi-id-label">Fecha</span>
                        <span className="pi-id-val">{fechaStr}</span>
                    </div>
                    <div className="pi-id-row">
                        <span className="pi-id-label">Solicitante</span>
                        <span className="pi-id-val">{user?.name || "—"}</span>
                    </div>
                </div>

                {/* Secciones de insumos */}
                {SECCIONES_INSUMOS.map(sec => (
                    <div key={sec.id} className="pi-seccion">
                        <div className="pi-seccion-titulo">{sec.icon} {sec.titulo}</div>

                        {sec.id === "vehiculo" && (
                            <div className="pi-vehiculo-field">
                                <label className="pi-obs-label">¿Para qué vehículo?</label>
                                {vehiculos.length > 0 ? (
                                    <select className="pi-vehiculo-input" value={vehiculoRef} onChange={e => setVehiculoRef(e.target.value)}>
                                        <option value="">— Seleccioná un vehículo —</option>
                                        {vehiculos.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        className="pi-vehiculo-input"
                                        type="text"
                                        value={vehiculoRef}
                                        onChange={e => setVehiculoRef(e.target.value)}
                                        placeholder="Ej: Ford Transit · PPP 123 · Unidad 4"
                                    />
                                )}
                            </div>
                        )}

                        {sec.items.map(item => {
                            if (ITEMS_CON_MODELO.has(item)) {
                                const entradas    = getEntradas(sec.id, item);
                                const tieneAlgo   = entradas.some(e => e.cantidad > 0);
                                return (
                                    <div key={item} className={`pi-item pi-item--expand${tieneAlgo ? " pi-item--activo" : ""}`}>
                                        <div className="pi-item-row">
                                            <span className="pi-item-nombre">🖨️ {item}</span>
                                        </div>
                                        {entradas.map((entrada, idx) => (
                                            <div key={idx} className="pi-entrada-row">
                                                <input
                                                    className="pi-modelo-input"
                                                    type="text"
                                                    value={entrada.modelo}
                                                    onChange={e => setEntrada(sec.id, item, idx, "modelo", e.target.value)}
                                                    placeholder="Modelo (ej: HP 105A, Epson T664...)"
                                                />
                                                <div className="pi-entrada-ctrl">
                                                    <button className="pi-qty-btn" onClick={() => setEntrada(sec.id, item, idx, "cantidad", entrada.cantidad - 1)} disabled={entrada.cantidad <= 0}>−</button>
                                                    <span className="pi-qty-val">{entrada.cantidad}</span>
                                                    <button className="pi-qty-btn" onClick={() => setEntrada(sec.id, item, idx, "cantidad", entrada.cantidad + 1)}>+</button>
                                                    {entradas.length > 1 && (
                                                        <button className="pi-del-btn" onClick={() => delEntrada(sec.id, item, idx)}>✕</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <button className="pi-add-btn" onClick={() => addEntrada(sec.id, item)}>+ Agregar otro modelo</button>
                                    </div>
                                );
                            }
                            const qty = getQty(sec.id, item);
                            return (
                                <div key={item} className={`pi-item${qty > 0 ? " pi-item--activo" : ""}`}>
                                    <div className="pi-item-row">
                                        <span className="pi-item-nombre">{item}</span>
                                        <div className="pi-item-ctrl">
                                            <button className="pi-qty-btn" onClick={() => setQty(sec.id, item, qty - 1)} disabled={qty === 0}>−</button>
                                            <span className="pi-qty-val">{qty}</span>
                                            <button className="pi-qty-btn" onClick={() => setQty(sec.id, item, qty + 1)}>+</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                <div className="pi-obs">
                    <label className="pi-obs-label">Observaciones adicionales</label>
                    <textarea
                        className="pi-obs-input"
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        rows={3}
                        placeholder="Indicá cualquier detalle o urgencia del pedido..."
                    />
                </div>

                {error && <div className="pi-error">{error}</div>}

                <button
                    className={`pi-enviar-btn${totalItems === 0 ? " pi-enviar-btn--dis" : ""}`}
                    onClick={enviar}
                    disabled={totalItems === 0 || enviando}
                >
                    {enviando ? "Enviando..." : `📤 Enviar pedido${totalItems > 0 ? ` · ${totalItems} ítem${totalItems !== 1 ? "s" : ""}` : ""}`}
                </button>

            </div>
        </div>
    );
}
