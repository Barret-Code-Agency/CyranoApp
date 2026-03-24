// src/screens/MisTurnosVigScreen.jsx
// Vista de turnos del vigilador logueado — filtra por su legajo en programacionServicios.

import { useState, useEffect } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db }         from "../../firebase";
import "./MisTurnosVigScreen.css";

const MESES    = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_MIN = ["D","L","M","M","J","V","S"];

// ── Chip de turno ────────────────────────────────────────────────────────────
function chipClass(val) {
    if (!val) return "mtv-chip--vacio";
    const v = val.toLowerCase();
    if (v === "fco" || v === "com")       return "mtv-chip--fco";
    if (v === "vac")                       return "mtv-chip--vac";
    if (v === "enf" || v === "art")        return "mtv-chip--aus";
    if (v === "lic" || v === "sus")        return "mtv-chip--lic";
    if (v.includes("–") || v.includes("-")) return "mtv-chip--trab";
    return "mtv-chip--otro";
}

function chipLabel(val) {
    if (!val) return "–";
    // Si es turno horario, mostrar solo hora inicio
    if ((val.includes("–") || val.includes("-")) && val.length > 5) {
        return val.split(/[–-]/)[0].trim();
    }
    return val;
}

// ── Próximos turnos (lista) ───────────────────────────────────────────────────
function ProximosTurnos({ programado, dias, hoyKey }) {
    const proximos = dias
        .filter(d => d.key >= hoyKey && programado[d.key] &&
                    (programado[d.key].includes("–") || programado[d.key].includes("-")))
        .slice(0, 7);

    if (proximos.length === 0) return null;
    return (
        <div className="mtv-proximos">
            <div className="mtv-proximos-title">Próximos turnos</div>
            {proximos.map(d => (
                <div key={d.key} className={`mtv-proximo-row ${d.key === hoyKey ? "mtv-proximo-row--hoy" : ""}`}>
                    <span className="mtv-proximo-dot" />
                    <span className="mtv-proximo-fecha">
                        {d.key === hoyKey ? "Hoy" : `${d.key.slice(8)}/${d.key.slice(5,7)}`}
                    </span>
                    <span className="mtv-proximo-turno">{programado[d.key]}</span>
                </div>
            ))}
        </div>
    );
}

// ── Grilla del mes ────────────────────────────────────────────────────────────
function GrillaCalendario({ dias, programado, hoyKey }) {
    return (
        <div className="mtv-grilla">
            {/* Cabecera días */}
            {DIAS_MIN.map((d, i) => (
                <div key={i} className="mtv-grilla-dow">{d}</div>
            ))}
            {/* Offset para alinear primer día */}
            {Array.from({ length: dias[0]?.dow ?? 0 }).map((_, i) => (
                <div key={`off-${i}`} />
            ))}
            {dias.map(({ num, key, dow }) => {
                const val = programado[key] ?? null;
                const esHoy = key === hoyKey;
                return (
                    <div key={key} className={`mtv-dia ${esHoy ? "mtv-dia--hoy" : ""}`}>
                        <span className="mtv-dia-num">{num}</span>
                        <span className={`mtv-chip ${chipClass(val)}`}>
                            {chipLabel(val)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function MisTurnosVigScreen({ onBack }) {
    const { user }          = useAuth();
    const { empresaNombre, empresaId } = useAppData();

    const hoy    = new Date();
    const hoyKey = hoy.toISOString().slice(0, 10);

    const [año,  setAño]  = useState(hoy.getFullYear());
    const [mes,  setMes]  = useState(hoy.getMonth() + 1);

    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [asignaciones, setAsignaciones] = useState([]);  // [{objetivoNombre, clienteNombre, programado}]
    const [sinLegajo,    setSinLegajo]    = useState(false);

    useEffect(() => {
        if (!empresaId || !user) return;
        setLoading(true);
        setError(null);
        setSinLegajo(false);

        const cargar = async () => {
            try {
                // 1. Encontrar el legajo del vigilador por nombre en la empresa
                const legajosSnap = await getDocs(query(
                    collection(db, "legajos"),
                    where("empresaId", "==", empresaId)
                ));
                const miLegajoDoc = legajosSnap.docs
                    .map(d => d.data())
                    .find(l => l.nombre === user.name);

                if (!miLegajoDoc) {
                    setSinLegajo(true);
                    setAsignaciones([]);
                    setLoading(false);
                    return;
                }

                const miLegajo = miLegajoDoc.legajo;

                // 2. Buscar programaciones del mes que contengan al vigilador
                const progSnap = await getDocs(query(
                    collection(db, "programacionServicios"),
                    where("empresaId", "==", empresaId),
                    where("año", "==", año),
                    where("mes", "==", mes)
                ));

                const resultado = [];
                progSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const miPersonal = (data.personal ?? []).find(p => p.legajo === miLegajo);
                    if (miPersonal) {
                        resultado.push({
                            objetivoNombre: data.objetivoNombre || data.proyectoNombre || "Objetivo sin nombre",
                            clienteNombre:  data.clienteNombre  || "",
                            programado:     miPersonal.programado ?? {},
                        });
                    }
                });

                setAsignaciones(resultado);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        cargar();
    }, [empresaId, user, año, mes]);

    const cambiarMes = (dir) => {
        if (dir === -1) {
            if (mes === 1) { setMes(12); setAño(a => a - 1); }
            else setMes(m => m - 1);
        } else {
            if (mes === 12) { setMes(1); setAño(a => a + 1); }
            else setMes(m => m + 1);
        }
    };

    // Días del mes con día de semana
    const diasDelMes = new Date(año, mes, 0).getDate();
    const dias = Array.from({ length: diasDelMes }, (_, i) => {
        const d   = new Date(año, mes - 1, i + 1);
        const key = d.toISOString().slice(0, 10);
        return { num: i + 1, key, dow: d.getDay() };
    });

    return (
        <div className="mtv-root">
            <div className="mtv-subpanel-top">
                <button className="mtv-back" onClick={onBack}>← Volver al panel</button>
                <div className="mtv-titulo">🕐 Mis Turnos</div>
            </div>

            {/* Navegación de mes */}
            <div className="mtv-nav">
                <button className="mtv-nav-btn" onClick={() => cambiarMes(-1)}>‹</button>
                <span className="mtv-nav-label">{MESES[mes - 1]} {año}</span>
                <button className="mtv-nav-btn" onClick={() => cambiarMes(1)}>›</button>
            </div>

            <div className="mtv-body">
                {loading && (
                    <div className="mtv-estado">
                        <div className="mtv-estado-icon">⏳</div>
                        <div className="mtv-estado-text">Cargando horarios...</div>
                    </div>
                )}

                {error && <div className="mtv-error">{error}</div>}

                {!loading && !error && (sinLegajo || asignaciones.length === 0) && (
                    <div className="mtv-sin-horario">
                        <div className="mtv-sin-icon">📋</div>
                        <div className="mtv-sin-title">Sin horarios asignados</div>
                        <div className="mtv-sin-sub">
                            No tenés turnos programados para este período.
                        </div>
                        <div className="mtv-sin-aviso">
                            📞 Comunicáte con tu supervisor
                        </div>
                    </div>
                )}

                {!loading && asignaciones.map((asig, idx) => (
                    <div key={idx} className="mtv-objetivo-card">
                        <div className="mtv-objetivo-header">
                            <span className="mtv-objetivo-icon">📍</span>
                            <div className="mtv-objetivo-info">
                                <div className="mtv-objetivo-nombre">{asig.objetivoNombre}</div>
                                {asig.clienteNombre && (
                                    <div className="mtv-objetivo-cliente">{asig.clienteNombre}</div>
                                )}
                            </div>
                        </div>

                        <GrillaCalendario
                            dias={dias}
                            programado={asig.programado}
                            hoyKey={hoyKey}
                        />

                        <ProximosTurnos
                            programado={asig.programado}
                            dias={dias}
                            hoyKey={hoyKey}
                        />
                    </div>
                ))}

                {/* Leyenda */}
                {!loading && asignaciones.length > 0 && (
                    <div className="mtv-leyenda">
                        <span className="mtv-ley-item"><span className="mtv-chip mtv-chip--trab">●</span> Turno</span>
                        <span className="mtv-ley-item"><span className="mtv-chip mtv-chip--fco">●</span> Franco</span>
                        <span className="mtv-ley-item"><span className="mtv-chip mtv-chip--vac">●</span> Vacaciones</span>
                        <span className="mtv-ley-item"><span className="mtv-chip mtv-chip--aus">●</span> Ausencia</span>
                    </div>
                )}
            </div>

        </div>
    );
}
