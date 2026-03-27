// src/screens/gerencia/PlanObjetivoScreen.jsx
// Plan de supervisión por objetivo — edición de metas independiente de supervisores
import { useMemo, useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import { getVisitasDesglosadas } from "../supervisor/PlanSupervisorScreen";
import "./PlanObjetivoScreen.css";

const PATRON_LABEL = { todas: "Todas (1,2,3,4)", impares: "Impares (1 y 3)", pares: "Pares (2 y 4)", custom: "Personalizado" };
const WEEK_RANGES  = { 1: "1–7", 2: "8–14", 3: "15–21", 4: "22–28" };

function semanasDePatron(patron, custom) {
    if (patron === "todas")   return [1, 2, 3, 4];
    if (patron === "impares") return [1, 3];
    if (patron === "pares")   return [2, 4];
    if (patron === "custom")  return custom || [];
    return [];
}

// ── Editor de un objetivo ──────────────────────────────────────────────────────
function EditorObjetivo({ nombre, meta, supervisores, onSave, onClose }) {
    const [modo,          setModo]          = useState(meta.modo      || "semana");
    const [diurnas,       setDiurnas]       = useState(meta.diurnas   ?? 1);
    const [nocturnas,     setNocturnas]     = useState(meta.nocturnas ?? 0);
    const [fds,           setFds]           = useState(meta.fds       ?? 0);
    const [patron,        setPatron]        = useState(meta.patron    || "todas");
    const [semanasCustom, setSemanasCustom] = useState(meta.semanasCustom || []);
    const [saving,        setSaving]        = useState(false);

    const semasAct = semanasDePatron(patron, semanasCustom);
    const totalMes = modo === "mes"
        ? diurnas + nocturnas + fds
        : semasAct.length * (diurnas + nocturnas) + semasAct.length * fds;

    const toggleSemana = (w) => setSemanasCustom(cur => cur.includes(w) ? cur.filter(x=>x!==w) : [...cur,w].sort());

    // Agregado actual desde supervisores
    const totSupD = supervisores.reduce((s,x)=>s+x.diurnas,0);
    const totSupN = supervisores.reduce((s,x)=>s+x.nocturnas,0);
    const totSupF = supervisores.reduce((s,x)=>s+x.fds,0);

    const handleSave = async () => {
        setSaving(true);
        await onSave({ modo, diurnas, nocturnas, fds, patron, semanasCustom });
        setSaving(false);
    };

    const ctrl = (val, set, label, icon) => (
        <div className="po-ed-campo">
            <span className="po-ed-campo-label">{icon} {label}</span>
            <div className="po-visitas-ctrl">
                <button onClick={()=>set(v=>Math.max(0,v-1))}>−</button>
                <span className="po-visitas-num">{val}</span>
                <button onClick={()=>set(v=>v+1)}>+</button>
            </div>
        </div>
    );

    return (
        <div className="po-editor">
            {/* Resumen de supervisores asignados */}
            {supervisores.length > 0 && (
                <div className="po-ed-sups-card">
                    <div className="po-ed-sups-titulo">Supervisores asignados ({supervisores.length})</div>
                    <div className="po-ed-sups-chips">
                        {supervisores.map((s,i)=>(
                            <span key={i} className="po-ed-sup-chip">
                                👤 {s.supervisor}
                                {(s.diurnas>0||s.nocturnas>0||s.fds>0)&&(
                                    <span className="po-ed-sup-vis">
                                        {s.diurnas>0?` ☀️${s.diurnas}`:""}
                                        {s.nocturnas>0?` 🌙${s.nocturnas}`:""}
                                        {s.fds>0?` 🏖${s.fds}`:""}
                                        /sem
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                    <div className="po-ed-sups-total">
                        Total supervisores: {totSupD>0?`☀️ ${totSupD}/sem `:""}{totSupN>0?`🌙 ${totSupN}/sem `:""}{totSupF>0?`🏖 ${totSupF}/sem`:""}
                    </div>
                </div>
            )}

            {/* Modo: por semana o por mes */}
            <div className="po-section-card">
                <div className="po-section-title">Modalidad de carga</div>
                <div className="po-modo-opts">
                    {[
                        { key: "semana", label: "Por semana", sub: "Visitas/sem × patrón" },
                        { key: "mes",    label: "Por mes",    sub: "Total mensual directo" },
                    ].map(m => (
                        <button key={m.key} className={`po-modo-btn${modo===m.key?" active":""}`} onClick={()=>setModo(m.key)}>
                            <strong>{m.label}</strong>
                            <span>{m.sub}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Cantidades */}
            <div className="po-section-card">
                <div className="po-section-title">Cantidades {modo==="semana"?"por semana activa":"mensuales totales"}</div>
                {ctrl(diurnas,  setDiurnas,  "Diurnas",       "☀️")}
                {ctrl(nocturnas,setNocturnas,"Nocturnas",     "🌙")}
                {ctrl(fds,      setFds,      "Fin de semana", "🏖")}
            </div>

            {/* Patrón (solo en modo semana) */}
            {modo === "semana" && (
                <div className="po-section-card">
                    <div className="po-section-title">Patrón de semanas activas</div>
                    <div className="po-patron-opts">
                        {Object.entries(PATRON_LABEL).map(([k,vv])=>(
                            <button key={k} className={`po-patron-btn${patron===k?" active":""}`} onClick={()=>setPatron(k)}>
                                {vv}
                            </button>
                        ))}
                    </div>
                    {patron === "custom" && (
                        <div className="po-semanas-check">
                            {[1,2,3,4].map(w=>(
                                <button key={w} className={`po-sem-btn${semanasCustom.includes(w)?" active":""}`} onClick={()=>toggleSemana(w)}>
                                    <div className="po-sem-num">Sem {w}</div>
                                    <div className="po-sem-range">{WEEK_RANGES[w]}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Preview total */}
            <div className="po-semanas-preview">
                {modo === "semana" ? (
                    semasAct.length === 0
                        ? <span style={{color:"var(--color-danger)"}}>Ninguna semana seleccionada</span>
                        : <>
                            {diurnas>0  &&<span>☀️ {diurnas}×{semasAct.length}={diurnas*semasAct.length}</span>}
                            {nocturnas>0&&<span> · 🌙 {nocturnas}×{semasAct.length}={nocturnas*semasAct.length}</span>}
                            {fds>0      &&<span> · 🏖 {fds}×{semasAct.length}={fds*semasAct.length}</span>}
                            <strong> · Meta total: {totalMes} visitas/mes</strong>
                        </>
                ) : (
                    <><strong>Meta mensual: {totalMes} visitas</strong><span> ({diurnas} diurnas + {nocturnas} nocturnas + {fds} FdS)</span></>
                )}
            </div>

            <button className="po-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "💾 Guardar meta"}
            </button>
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function PlanObjetivoScreen({ onBack }) {
    const { planesSuper, data, empresaId } = useAppData();
    const [metas,     setMetas]     = useState({});
    const [selObj,    setSelObj]    = useState(null);  // nombre del objetivo seleccionado
    const [loadingM,  setLoadingM]  = useState(true);

    useEffect(() => {
        if (!empresaId) return;
        getDoc(doc(db, "empresas", empresaId, "datos", "plan_objetivo"))
            .then(snap => { if (snap.exists()) setMetas(snap.data()||{}); })
            .catch(()=>{})
            .finally(()=>setLoadingM(false));
    }, [empresaId]);

    // Mapa objetivo → supervisores
    const supsPorObj = useMemo(() => {
        const mapa = {};
        Object.entries(planesSuper||{}).forEach(([key,plan]) => {
            const supNombre = plan.nombre || key;
            (plan.objetivos||[]).forEach(obj => {
                const nom = obj.nombre||obj.objetivo||"Sin nombre";
                if (!mapa[nom]) mapa[nom]=[];
                const v = getVisitasDesglosadas(obj);
                mapa[nom].push({ supervisor:supNombre, diurnas:v.diurnas||0, nocturnas:v.nocturnas||0, fds:v.fds||0 });
            });
        });
        return mapa;
    }, [planesSuper]);

    // Lista de todos los objetivos
    const todosObjetivos = useMemo(() => {
        const todos = new Set([...(data.objetivos||[]), ...Object.keys(supsPorObj)]);
        return [...todos].sort((a,b)=>a.localeCompare(b));
    }, [data.objetivos, supsPorObj]);

    const guardar = async (nombre, valores) => {
        const nuevas = { ...metas, [nombre]: valores };
        await setDoc(doc(db,"empresas",empresaId,"datos","plan_objetivo"), nuevas, {merge:false});
        setMetas(nuevas);
        setSelObj(null);
    };

    const metaResumen = (m) => {
        if (!m) return null;
        const sems = m.modo==="mes" ? null : semanasDePatron(m.patron||"todas", m.semanasCustom||[]);
        const tot  = m.modo==="mes"
            ? (m.diurnas||0)+(m.nocturnas||0)+(m.fds||0)
            : (sems?.length||0)*((m.diurnas||0)+(m.nocturnas||0)+(m.fds||0));
        return tot;
    };

    const objSeleccionado = selObj ? {
        nombre:       selObj,
        meta:         metas[selObj] || {},
        supervisores: supsPorObj[selObj] || [],
    } : null;

    // Si hay objetivo seleccionado → mostrar editor (reemplaza lista, como PlanSupervisorScreen)
    if (objSeleccionado) {
        return (
            <div className="po-root">
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSelObj(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📍 {objSeleccionado.nombre}</div>
                </div>
                <EditorObjetivo
                    key={objSeleccionado.nombre}
                    nombre={objSeleccionado.nombre}
                    meta={objSeleccionado.meta}
                    supervisores={objSeleccionado.supervisores}
                    onSave={(vals) => guardar(objSeleccionado.nombre, vals)}
                    onClose={() => setSelObj(null)}
                />
            </div>
        );
    }

    return (
        <div className="po-root">
            <div className="vh-subpanel">
                <button className="vh-back" onClick={onBack}>← Volver al panel</button>
                <div className="vh-subpanel-title">📍 Plan por objetivo</div>
            </div>

            <div className="po-list-col">
                {loadingM ? (
                    <div className="po-empty">Cargando…</div>
                ) : todosObjetivos.length === 0 ? (
                    <div className="po-empty">No hay objetivos cargados.</div>
                ) : (
                    todosObjetivos.map(nombre => {
                        const meta  = metas[nombre];
                        const sups  = supsPorObj[nombre] || [];
                        const tot   = metaResumen(meta);
                        const totSupD = sups.reduce((s,x)=>s+x.diurnas,0);
                        const totSupN = sups.reduce((s,x)=>s+x.nocturnas,0);
                        const totSupF = sups.reduce((s,x)=>s+x.fds,0);
                        return (
                            <div key={nombre} className="po-obj-row" onClick={() => setSelObj(nombre)}>
                                <div className="po-obj-icon">📍</div>
                                <div className="po-obj-info">
                                    <div className="po-obj-nombre">{nombre}</div>
                                    <div className="po-obj-detail">
                                        {sups.length>0
                                            ? `${sups.length} supervisor${sups.length>1?"es":""}`
                                            : <span style={{color:"#f59e0b"}}>Sin supervisores</span>}
                                    </div>
                                </div>
                                <div className="po-obj-right">
                                    {meta ? (
                                        <div className="po-obj-meta">
                                            {meta.diurnas>0  &&<span className="po-chip po-chip--dia">☀️{meta.diurnas}</span>}
                                            {meta.nocturnas>0&&<span className="po-chip po-chip--noc">🌙{meta.nocturnas}</span>}
                                            {meta.fds>0      &&<span className="po-chip po-chip--fds">🏖{meta.fds}</span>}
                                            <span className="po-obj-pct">{tot} vis/{meta.modo==="mes"?"mes":"sem"}</span>
                                        </div>
                                    ) : (
                                        <span className="po-obj-sinmeta">Sin meta</span>
                                    )}
                                    {(totSupD+totSupN+totSupF)>0&&(
                                        <div className="po-obj-sups-tot">
                                            {totSupD>0?`☀️${totSupD} `:""}
                                            {totSupN>0?`🌙${totSupN} `:""}
                                            {totSupF>0?`🏖${totSupF}`:""}
                                            /sem sup.
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
