// src/components/charts/DonutChart.jsx
export default function DonutChart({ segments }) {
    const total = segments.reduce((s, g) => s + g.value, 0) || 1;
    let offset = 0;
    const r = 42, cx = 60, cy = 60, circ = 2 * Math.PI * r;
    return (
        <div className="donut-wrap">
            <svg width="130" height="130" viewBox="0 0 120 120">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-surface3)" strokeWidth="16" />
                {segments.map((seg, i) => {
                    const pct = seg.value / total, dash = pct * circ;
                    const rot = (offset / total) * 360 - 90;
                    offset += seg.value;
                    return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="16"
                        strokeDasharray={dash + " " + (circ - dash)} strokeDashoffset={0}
                        transform={"rotate(" + rot + " " + cx + " " + cy + ")"} />;
                })}
                <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--color-text)">{total}</text>
            </svg>
            <div className="donut-legend">
                {segments.map((seg, i) => (
                    <div key={i} className="donut-item">
                        <span className="donut-dot" style={{ background: seg.color }} />
                        <span>{seg.label}</span>
                        <strong>{seg.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}
