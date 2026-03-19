// src/components/charts/PlanVsRealChart.jsx
import { useMemo } from "react";

export default function PlanVsRealChart({ jornadas, plan }) {
    const computed = useMemo(() => {
        const hoy = new Date();
        const año = hoy.getFullYear();
        const mes = hoy.getMonth();
        const diasEnMes = new Date(año, mes + 1, 0).getDate();

        // Visitas requeridas totales por semana → distribuidas uniformemente por día hábil
        const reqSemana = plan.reduce((s, p) => s + (p.visitasPorSemana || 1), 0);
        const reqDia = reqSemana / 7; // promedio diario

        // Controles del mes actual agrupados por día
        const ctrlPorDia = {};
        jornadas.forEach(j => {
            const d = new Date(j.creadaEn || j.cerradaEn || 0);
            if (d.getFullYear() === año && d.getMonth() === mes) {
                (j.actividades || []).filter(a => a.tipo === "ctrl").forEach(() => {
                    const dia = d.getDate();
                    ctrlPorDia[dia] = (ctrlPorDia[dia] || 0) + 1;
                });
            }
        });

        // Acumulados día a día hasta hoy
        const dias = [];
        let acumReal = 0, acumPlan = 0;
        for (let d = 1; d <= diasEnMes; d++) {
            acumPlan += reqDia;
            if (d <= hoy.getDate()) acumReal += (ctrlPorDia[d] || 0);
            dias.push({
                dia: d,
                plan: Math.round(acumPlan * 10) / 10,
                real: d <= hoy.getDate() ? acumReal : null,
                esFuturo: d > hoy.getDate(),
            });
        }

        const maxVal = Math.max(...dias.map(d => Math.max(d.plan, d.real || 0)), 1);
        const W = 320, H = 110, padX = 8, padY = 12, availW = W - padX * 2, availH = H - padY * 2;

        const toX = (i) => padX + (i / (diasEnMes - 1)) * availW;
        const toY = (v) => padY + availH - (v / maxVal) * availH;

        // Build SVG paths
        const planPts = dias.map((d, i) => `${toX(i)},${toY(d.plan)}`);
        const realPts = dias.filter(d => d.real !== null).map((d, i) => `${toX(i)},${toY(d.real)}`);

        const hoyIdx = hoy.getDate() - 1;
        const hoyX = toX(hoyIdx);
        const realHoy = acumReal;
        const planHoy = Math.round(reqDia * hoy.getDate() * 10) / 10;
        const pctHoy = planHoy > 0 ? Math.min(Math.round(realHoy / planHoy * 100), 999) : 0;
        const color = pctHoy >= 80 ? "#10b981" : pctHoy >= 50 ? "#f59e0b" : "#e20113";

        // X-axis labels: only show every 5 days
        const xLabels = dias.filter(d => d.dia === 1 || d.dia % 5 === 0 || d.dia === diasEnMes);

        return { dias, planPts, realPts, hoyX, realHoy, planHoy, pctHoy, color, xLabels, W, H, padX, padY, availW, availH, toX, toY };
    }, [jornadas, plan]);

    const { planPts, realPts, hoyX, realHoy, planHoy, pctHoy, color, xLabels, W, H, padX, padY, availH } = computed;

    const planPath = "M " + planPts.join(" L ");
    const realPath = realPts.length > 1 ? "M " + realPts.join(" L ") : null;
    const toY = computed.toY;
    const toX = computed.toX;
    const maxVal = Math.max(...computed.dias.map(d => Math.max(d.plan, d.real || 0)), 1);
    const realArea = realPath
        ? realPath + ` L ${toX(realPts.length - 1)},${padY + availH} L ${toX(0)},${padY + availH} Z`
        : null;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: "#003087", display: "inline-block", borderRadius: 2 }} />
                        Plan acumulado
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 20, height: 3, background: color, display: "inline-block", borderRadius: 2 }} />
                        Realizado
                    </span>
                </div>
                <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "var(--font-display,'Bebas Neue',sans-serif)" }}>{pctHoy}%</span>
                    <div style={{ fontSize: 10, color: "#8894ac" }}>{realHoy} / {planHoy} al día de hoy</div>
                </div>
            </div>
            <div className="chart-wrap">
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                        </linearGradient>
                    </defs>
                    {/* Grilla horizontal */}
                    {[0.25, 0.5, 0.75, 1].map(p => (
                        <line key={p} x1={padX} y1={toY(maxVal * p)} x2={W - padX} y2={toY(maxVal * p)}
                            stroke="#e8eaf2" strokeWidth="0.8" />
                    ))}
                    {/* Línea vertical "hoy" */}
                    <line x1={hoyX} y1={padY} x2={hoyX} y2={padY + availH}
                        stroke="#8894ac" strokeWidth="1" strokeDasharray="3 2" />
                    <text x={hoyX + 3} y={padY + 8} fontSize="7" fill="#8894ac">hoy</text>
                    {/* Área realizado */}
                    {realArea && <path d={realArea} fill="url(#realGrad)" />}
                    {/* Línea plan */}
                    <path d={planPath} fill="none" stroke="#003087" strokeWidth="1.5"
                        strokeDasharray="5 3" strokeLinecap="round" />
                    {/* Línea realizado */}
                    {realPath && <path d={realPath} fill="none" stroke={color} strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" />}
                    {/* Punto hoy en realizado */}
                    {realPts.length > 0 && (
                        <circle cx={hoyX} cy={toY(realHoy)} r="4" fill={color} />
                    )}
                </svg>
                <div className="line-labels" style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    {xLabels.map(d => (
                        <div key={d.dia} className="line-lbl" style={{ fontSize: 9 }}>{d.dia}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
