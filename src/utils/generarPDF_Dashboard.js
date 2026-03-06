// src/utils/generarPDF_Dashboard.js
// Genera PDF del Dashboard Admin usando jsPDF — datos en texto, sin captura DOM

async function cargarJsPDF() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    await new Promise((res, rej) => {
        if (document.querySelector("#jspdf-script")) {
            const wait = setInterval(() => { if (window.jspdf?.jsPDF) { clearInterval(wait); res(); } }, 50);
            return;
        }
        const s = document.createElement("script");
        s.id = "jspdf-script";
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });
    return window.jspdf.jsPDF;
}

const loadImage = (url) => new Promise((res) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        res({ data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => res(null);
    img.src = url + "?t=" + Date.now();
});

const toMin  = (t) => { if (!t) return 0; const [h, m] = (t || "").split(":").map(Number); return h * 60 + (m || 0); };
const diffMin = (a, b) => { let d = toMin(b) - toMin(a); return d < 0 ? d + 1440 : Math.max(d, 0); };
const fmtHs  = (min) => { if (!min || min <= 0) return "0h"; const h = Math.floor(min / 60), m = min % 60; return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
const parseKm = (j) => { const k = Number(j.kmFinal || 0) - Number(j.kmInicial || 0); return k > 0 ? k : 0; };

const semanasDePatron = (patron, custom) => {
    if (patron === "todas")   return [1,2,3,4];
    if (patron === "impares") return [1,3];
    if (patron === "pares")   return [2,4];
    if (patron === "custom")  return custom || [];
    return [1,2,3,4];
};

export async function generarPDFDashboard({ jornadas, plan, getSupervisoresConEmail, getPlanSupervisor, periodo }) {
    const JsPDF = await cargarJsPDF();
    const doc   = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const W = 297, H = 210, M = 8, CW = W - M * 2;

    // Filtrar período
    const ahora   = Date.now();
    const diasMap  = { semana: 7, mes: 30, todo: 99999 };
    const diasMax  = diasMap[periodo] || 30;
    const jFilt    = jornadas.filter(j => {
        const diff = (ahora - new Date(j.creadaEn || j.cerradaEn || 0)) / (1000 * 60 * 60 * 24);
        return diff <= diasMax;
    });

    const supervisores = getSupervisoresConEmail();
    const mesNombre = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

    const R  = (x, y, w, h, fill) => {
        if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, "F"); }
        else { doc.setDrawColor(190, 200, 220); doc.rect(x, y, w, h, "S"); }
    };
    const T  = (t, x, y, sz, bold, al, color) => {
        doc.setFontSize(sz || 7); doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...(color || [0, 0, 0]));
        doc.text(String(t ?? ""), x, y, { align: al || "left" });
    };
    const RR = (x, y, w, h, r, fill) => { doc.setFillColor(...fill); doc.roundedRect(x, y, w, h, r, r, "F"); };

    // ════════ PÁGINA 1: RESUMEN GENERAL ════════════════════════
    let y = M;

    // Header
    R(M, y, CW, 1.2, [0, 48, 135]); y += 1.2;
    const HEADER_H = 13;
    R(M, y, CW, HEADER_H, [252, 253, 255]);
    doc.setDrawColor(190, 200, 220); doc.rect(M, y, CW, HEADER_H, "S");

    try {
        const logoData = await loadImage("/images/LogoApp.png");
        if (logoData) {
            const lh = HEADER_H - 3, lw = Math.min(lh * (logoData.w / logoData.h), 55);
            doc.addImage(logoData.data, "PNG", M + 2, y + 1.5, lw, lh);
        }
    } catch {}

    T("DASHBOARD DE SUPERVISIÓN", W / 2, y + 5.5, 14, true, "center", [0, 48, 135]);
    T(mesNombre.toUpperCase() + "  ·  Período: " + (periodo === "semana" ? "7 días" : periodo === "mes" ? "30 días" : "Todo"), W / 2, y + 10, 5.5, false, "center", [120, 120, 120]);
    T("Generado: " + new Date().toLocaleString("es-AR"), W - M - 1, y + 5.5, 4.5, false, "right", [140, 140, 140]);
    y += HEADER_H;
    R(M, y, CW, 0.8, [226, 1, 19]); y += 2;

    // KPIs globales
    const allCtrl = jFilt.flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));
    const totalKm = jFilt.reduce((s, j) => s + parseKm(j), 0);
    let totalHsCtrl = 0;
    allCtrl.forEach(a => { if (a.horaInicio && a.horaFin) totalHsCtrl += diffMin(a.horaInicio, a.horaFin); });

    const kpis = [
        { l: "Jornadas",     v: String(jFilt.length),       c: [0, 48, 135]   },
        { l: "Controles",    v: String(allCtrl.length),     c: [22, 163, 74]  },
        { l: "Nocturnos",    v: String(allCtrl.filter(c => c.turno === "nocturno").length), c: [99, 90, 200] },
        { l: "Fin de sem.",  v: String(allCtrl.filter(c => c.esFinDeSemana).length), c: [220, 70, 150] },
        { l: "Hs Superv.",   v: fmtHs(totalHsCtrl),        c: [0, 48, 135]   },
        { l: "Km totales",   v: totalKm > 0 ? totalKm + " km" : "—", c: [16, 163, 127] },
        { l: "Supervisores", v: String(supervisores.length), c: [245, 158, 11] },
    ];

    const KPI_H = 14, kpiW = CW / kpis.length;
    R(M, y, CW, KPI_H, [248, 249, 252]);
    doc.setDrawColor(190, 200, 220); doc.rect(M, y, CW, KPI_H, "S");
    kpis.forEach((k, i) => {
        const kx = M + i * kpiW;
        if (i > 0) { doc.setDrawColor(210, 218, 235); doc.line(kx, y + 1.5, kx, y + KPI_H - 1.5); }
        T(k.v, kx + kpiW / 2, y + 7,    10, true,  "center", k.c);
        T(k.l, kx + kpiW / 2, y + 12,   4.5, false, "center", [120, 120, 120]);
    });
    y += KPI_H + 3;

    // Tabla por supervisor
    T("RENDIMIENTO POR SUPERVISOR", M, y, 7.5, true, "left", [0, 48, 135]);
    y += 5;

    const TH = ["Supervisor", "Email", "Turno", "Req./Mes", "Controles", "Cumpl.", "Diurnos", "Nocturnos", "Fin Sem.", "Km", "Jornadas"];
    const TW = [38, 48, 16, 15, 15, 14, 14, 16, 13, 13, 15];
    let cx = M;
    const COL_X = TH.map((_, i) => { const x = cx; cx += TW[i]; return x; });

    // Header tabla
    R(M, y, CW, 5.5, [0, 48, 135]);
    TH.forEach((h, i) => T(h, COL_X[i] + TW[i] / 2, y + 3.8, 4, true, "center", [255, 255, 255]));
    y += 5.5;

    supervisores.forEach((sup, idx) => {
        const planSup = sup.email ? getPlanSupervisor(sup.email) : null;
        const reqMes  = planSup
            ? (planSup.objetivos || []).reduce((s, o) =>
                s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1), 0)
            : 0;
        const jSup  = jFilt.filter(j => j.email === sup.email || j.nombre === sup.nombre);
        const ctrl  = jSup.flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));
        const real  = ctrl.length;
        const pct   = reqMes > 0 ? Math.round(real / reqMes * 100) : null;
        const noc   = ctrl.filter(c => c.turno === "nocturno").length;
        const fds   = ctrl.filter(c => c.esFinDeSemana).length;
        const dia   = real - noc;
        const km    = jSup.reduce((s, j) => s + parseKm(j), 0);
        const turno = { diurno: "Diurno", nocturno: "Nocturno", mixto: "Mixto" }[planSup?.turnoBase || "mixto"];

        const bg = idx % 2 === 0 ? [250, 251, 255] : [255, 255, 255];
        R(M, y, CW, 5.5, bg);
        doc.setDrawColor(210, 218, 235); doc.rect(M, y, CW, 5.5, "S");

        const pctColor = pct === null ? [150, 150, 150] : pct >= 80 ? [22, 163, 74] : pct >= 50 ? [180, 110, 0] : [220, 38, 38];
        const vals = [
            [sup.nombre.split(" ").slice(0, 2).join(" "), false, [20, 20, 40]],
            [sup.email || "—", false, [90, 90, 90]],
            [turno, false, [60, 80, 140]],
            [String(reqMes), false],
            [String(real), true, real > 0 ? [22, 163, 74] : [150, 150, 150]],
            [pct !== null ? pct + "%" : "—", true, pctColor],
            [String(dia), false],
            [String(noc), false, [99, 90, 200]],
            [String(fds), false, [220, 70, 150]],
            [km > 0 ? km + " km" : "—", false],
            [String(jSup.length), false],
        ];
        vals.forEach(([v, bold, color], i) => {
            T(v, COL_X[i] + TW[i] / 2, y + 3.8, 4.5, bold, "center", color || [30, 30, 30]);
        });
        y += 5.5;
    });

    y += 3;

    // ════════ PÁGINA 2: CUMPLIMIENTO POR PUESTO ════════════════
    if (plan?.length) {
        doc.addPage();
        y = M;
        R(M, y, CW, 1.2, [0, 48, 135]); y += 1.2;

        R(M, y, CW, 10, [252, 253, 255]);
        doc.setDrawColor(190, 200, 220); doc.rect(M, y, CW, 10, "S");
        T("CUMPLIMIENTO POR PUESTO — " + mesNombre.toUpperCase(), W / 2, y + 6.5, 11, true, "center", [0, 48, 135]);
        y += 10;
        R(M, y, CW, 0.8, [226, 1, 19]); y += 2;

        const allCtrlPlan = jFilt.flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));
        const TH2 = ["Puesto / Objetivo", "Req./Sem", "Req. Mes", "Realizadas", "Cumpl. %", "Diurnos", "Nocturnos", "Fin Sem.", "Estado"];
        const TW2 = [70, 18, 18, 18, 18, 16, 18, 14, 22];
        let cx2 = M;
        const COL_X2 = TH2.map((_, i) => { const x = cx2; cx2 += TW2[i]; return x; });

        R(M, y, CW, 5.5, [0, 48, 135]);
        TH2.forEach((h, i) => T(h, COL_X2[i] + TW2[i] / 2, y + 3.8, 4, true, "center", [255, 255, 255]));
        y += 5.5;

        plan.forEach((p, idx) => {
            const real = allCtrlPlan.filter(c => c.objetivo === p.objetivo).length;
            const req  = (p.visitasPorSemana || 1) * 4;
            const pct  = req > 0 ? Math.round(real / req * 100) : 0;
            const noc  = allCtrlPlan.filter(c => c.objetivo === p.objetivo && c.turno === "nocturno").length;
            const fds  = allCtrlPlan.filter(c => c.objetivo === p.objetivo && c.esFinDeSemana).length;
            const dia  = real - noc;
            const est  = pct >= 100 ? "✓ Cumplido" : pct >= 50 ? "~ Parcial" : "✗ Pendiente";
            const estColor = pct >= 100 ? [22, 163, 74] : pct >= 50 ? [180, 110, 0] : [220, 38, 38];

            if (y + 5.5 > H - M - 8) { doc.addPage(); y = M + 4; }

            const bg = idx % 2 === 0 ? [250, 251, 255] : [255, 255, 255];
            R(M, y, CW, 5.5, bg);
            doc.setDrawColor(210, 218, 235); doc.rect(M, y, CW, 5.5, "S");

            // Barra de progreso inline
            const barX = COL_X2[0], barW = TW2[0] - 2;
            const fillW = Math.min(pct / 100 * barW * 0.3, barW * 0.3);
            RR(barX + barW * 0.68, y + 3.5, fillW, 1.5, 0.5, pct >= 100 ? [22, 163, 74] : pct >= 50 ? [245, 158, 11] : [220, 38, 38]);

            const vals2 = [
                [p.objetivo, false, [20, 20, 40]],
                [String(p.visitasPorSemana || 1), false],
                [String(req), false],
                [String(real), true, real > 0 ? [22, 163, 74] : [150, 150, 150]],
                [pct + "%", true, estColor],
                [String(dia), false],
                [String(noc), false, [99, 90, 200]],
                [String(fds), false, [220, 70, 150]],
                [est, true, estColor],
            ];
            vals2.forEach(([v, bold, color], i) => {
                const al = i === 0 ? "left" : "center";
                const tx = i === 0 ? COL_X2[i] + 1 : COL_X2[i] + TW2[i] / 2;
                T(v, tx, y + 3.8, 4.5, bold, al, color || [30, 30, 30]);
            });
            y += 5.5;
        });
    }

    // Pie en cada página
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        R(M, H - M - 0.8, CW, 0.8, [226, 1, 19]);
        doc.setFontSize(4.5); doc.setTextColor(160, 160, 160); doc.setFont("helvetica", "normal");
        doc.text(`CyranoApp · Dashboard de Supervisión · ${new Date().toLocaleString("es-AR")} · Pág ${p}/${totalPages}`,
            W / 2, H - M + 1.5, { align: "center" });
    }

    const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
    const filename = `Dashboard_Supervision_${mesNombre.replace(" ", "_")}_${fecha}.pdf`;
    return { blob: doc.output("blob"), dataUrl: doc.output("datauristring"), filename };
}
