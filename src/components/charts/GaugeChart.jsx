// src/components/charts/GaugeChart.jsx
export default function GaugeChart({ value, max = 100, label, color }) {
    const p = Math.min(value / max, 1), angle = p * 180;
    const r = 48, cx = 60, cy = 62;
    const toXY = (deg) => { const rad = ((deg - 180) * Math.PI) / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; };
    const start = toXY(0), end = toXY(angle), large = angle > 180 ? 1 : 0;
    const arcBg = "M " + (cx - r) + " " + cy + " A " + r + " " + r + " 0 0 1 " + (cx + r) + " " + cy;
    const arcFg = angle > 0 ? "M " + start.x + " " + start.y + " A " + r + " " + r + " 0 " + large + " 1 " + end.x + " " + end.y : "";
    const clr = color || (p >= 0.8 ? "var(--color-success)" : p >= 0.5 ? "#f59e0b" : "var(--color-danger)");
    return (
        <div className="gauge-wrap">
            <svg width="120" height="72" viewBox="0 0 120 72">
                <path d={arcBg} fill="none" stroke="var(--color-surface3)" strokeWidth="14" strokeLinecap="round" />
                {arcFg && <path d={arcFg} fill="none" stroke={clr} strokeWidth="14" strokeLinecap="round" />}
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="15" fontWeight="800" fill={clr}>{Math.round(p * 100)}%</text>
            </svg>
            {label && <div className="gauge-label">{label}</div>}
        </div>
    );
}
