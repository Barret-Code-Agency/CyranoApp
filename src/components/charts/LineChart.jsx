// src/components/charts/LineChart.jsx
export default function LineChart({ data, color = "var(--color-primary)", height = 90 }) {
    if (data.length < 2) return <div className="chart-empty">Sin datos suficientes</div>;
    const max = Math.max(...data.map(d => d.value), 1), w = 300, padX = 12, availW = w - padX * 2;
    const pts = data.map((d, i) => {
        const x = padX + (i / (data.length - 1)) * availW;
        const y = height - 10 - ((d.value / max) * (height - 20));
        return x + "," + y;
    });
    const path = "M " + pts.join(" L ");
    const area = path + " L " + (w - padX) + "," + height + " L " + padX + "," + height + " Z";
    return (
        <div className="chart-wrap">
            <svg width="100%" viewBox={"0 0 " + w + " " + height} preserveAspectRatio="none">
                <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                </linearGradient></defs>
                <path d={area} fill="url(#lg)" />
                <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {data.map((d, i) => { const [x, y] = pts[i].split(",").map(Number); return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />; })}
            </svg>
            <div className="line-labels">{data.map((d, i) => <div key={i} className="line-lbl">{d.label}</div>)}</div>
        </div>
    );
}
