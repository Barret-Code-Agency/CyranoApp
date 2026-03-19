// src/components/charts/BarChart.jsx
export default function BarChart({ data, color = "var(--color-primary)", height = 120 }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="bar-chart" style={{ height }}>
            {data.map((d, i) => (
                <div key={d.label ?? i} className="bar-col">
                    <div className="bar-val">{d.value > 0 ? d.value : ""}</div>
                    <div className="bar" style={{ height: (d.value / max * 100) + "%", background: color }} />
                    <div className="bar-lbl">{d.label}</div>
                </div>
            ))}
        </div>
    );
}
