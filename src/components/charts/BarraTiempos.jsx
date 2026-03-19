// src/components/charts/BarraTiempos.jsx
import { TIPO_COLOR, TIPO_LABEL } from "../../config/activityTypes";
import { fmtMin } from "../../utils/helpers";
const pct = (v, t) => t > 0 ? Math.round(v / t * 100) : 0;

export default function BarraTiempos({ ctrl, cap, traslado, admin, taller, vulnerab, reclamos, gremial, almuerzo, otras, showLabels }) {
    const total = (ctrl||0)+(cap||0)+(traslado||0)+(admin||0)+(taller||0)+(vulnerab||0)+(reclamos||0)+(gremial||0)+(almuerzo||0)+(otras||0) || 1;
    const segs = [
        { key: "ctrl",     val: ctrl     || 0, color: TIPO_COLOR.ctrl     },
        { key: "cap",      val: cap      || 0, color: TIPO_COLOR.cap      },
        { key: "traslado", val: traslado || 0, color: TIPO_COLOR.traslado },
        { key: "admin",    val: admin    || 0, color: TIPO_COLOR.admin    },
        { key: "taller",   val: taller   || 0, color: TIPO_COLOR.taller   },
        { key: "vulnerab", val: vulnerab || 0, color: TIPO_COLOR.vulnerab },
        { key: "reclamos", val: reclamos || 0, color: TIPO_COLOR.reclamos },
        { key: "gremial",  val: gremial  || 0, color: TIPO_COLOR.gremial  },
        { key: "almuerzo", val: almuerzo || 0, color: TIPO_COLOR.almuerzo },
        { key: "otras",    val: otras    || 0, color: TIPO_COLOR.otras    },
    ].filter(s => s.val > 0);
    return (
        <div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1, background: "#e8eaf2" }}>
                {segs.map(s => (
                    <div key={s.key} style={{ width: `${pct(s.val, total)}%`, background: s.color, borderRadius: 2 }}
                        title={`${TIPO_LABEL[s.key]}: ${fmtMin(s.val)} (${pct(s.val, total)}%)`} />
                ))}
            </div>
            {showLabels && (
                <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                    {segs.map(s => (
                        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                            <span style={{ color: "#4a5568", fontWeight: 600 }}>{TIPO_LABEL[s.key]}</span>
                            <span style={{ color: s.color, fontWeight: 800 }}>{pct(s.val, total)}%</span>
                            <span style={{ color: "#8894ac" }}>{fmtMin(s.val)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
