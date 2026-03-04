// src/utils/generarPDF.js
// Genera la Hoja de Supervisión en PDF con jsPDF (cargado desde CDN)
// Uso: const { blob, dataUrl, filename } = await generarHojaSupervision(session)

const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const diffMin = (a, b) => { if (!a || !b) return 0; let d = toMin(b) - toMin(a); if (d < 0) d += 1440; return Math.max(d, 0); };
const fmtHs = (min) => { if (!min || min <= 0) return "00:00"; return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); };

const calcTiempos = (session) => {
    const acts = [...(session.actividades || [])]
        .filter(a => a.horaInicio && a.horaFin)
        .sort((a, b) => toMin(a.horaInicio) - toMin(b.horaInicio));
    let supervision = 0, apoyo = 0, admin = 0, traslado = 0;
    acts.forEach(a => {
        const d = diffMin(a.horaInicio, a.horaFin);
        if (a.tipo === "ctrl") supervision += d;
        else if (a.tipo === "cap") apoyo += d;
        else if (a.tipo === "otra") {
            if ((a.actividad || "").toLowerCase().includes("admin")) admin += d;
            else apoyo += d;
        }
    });
    for (let i = 1; i < acts.length; i++) {
        const g = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
        if (g > 5 && g < 180) traslado += g;
    }
    return { supervision, apoyo, admin, traslado };
};

const ratingLabel = (avg) => {
    if (avg === null || avg === undefined) return null;
    if (avg <= 1) return { txt: "Muy mal", color: [220, 38, 38] };
    if (avg <= 3) return { txt: "Mal", color: [234, 88, 12] };
    if (avg <= 5) return { txt: "Normal", color: [202, 138, 4] };
    if (avg <= 7) return { txt: "Bien", color: [22, 163, 74] };
    return { txt: "Muy bien", color: [15, 118, 110] };
};

const promedioCtrl = (ctrl) => {
    if (!ctrl.ratings) return null;
    const vals = Object.values(ctrl.ratings).filter(v => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
};

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

export async function generarHojaSupervision(session) {
    const JsPDF = await cargarJsPDF();
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const W = 297, H = 210, M = 6, CW = W - M * 2;
    const tiempos = calcTiempos(session);
    const kmRec = (session.kmFinal && session.kmInicial)
        ? Math.max(Number(session.kmFinal) - Number(session.kmInicial), 0) : 0;

    const acts = [...(session.actividades || [])]
        .filter(a => a.horaInicio && a.horaFin)
        .sort((a, b) => toMin(a.horaInicio) - toMin(b.horaInicio));

    // helpers
    doc.setLineWidth(0.2);
    const R = (x, y, w, h, fill) => { if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, "F"); } else { doc.setDrawColor(190, 200, 220); doc.rect(x, y, w, h, "S"); } };
    const RR = (x, y, w, h, r, fill) => { doc.setFillColor(...fill); doc.roundedRect(x, y, w, h, r, r, "F"); };
    const L = (x1, y1, x2, y2, c) => { if (c) doc.setDrawColor(...c); doc.line(x1, y1, x2, y2); };
    const T = (t, x, y, sz, bold, al, color) => {
        doc.setFontSize(sz || 7); doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...(color || [0, 0, 0]));
        doc.text(String(t ?? ""), x, y, { align: al || "left" });
    };

    let y = M;

    // ── CABECERA ────────────────────────────────────────────────────────────
    R(M, y, CW, 1.5, [0, 48, 135]);
    y += 1.5;

    RR(M, y, 30, 13, 1, [0, 48, 135]);
    T("BRINKS", M + 15, y + 8.5, 10, true, "center", [255, 255, 255]);

    T("HOJA DE SUPERVISIÓN DIARIA", M + 155, y + 6, 15, true, "center", [0, 48, 135]);
    T("Formulario BSCGOP-FOR-002  ·  Versión 2.0", W - M, y + 4, 6, false, "right", [100, 100, 100]);
    T("Modificada: " + new Date().toLocaleDateString("es-AR"), W - M, y + 9, 6, false, "right", [100, 100, 100]);

    y += 14;
    R(M, y, CW, 1, [226, 1, 19]);
    y += 2.5;

    // ── DATOS JORNADA ───────────────────────────────────────────────────────
    const H6 = 6;
    const campo = (lbl, val, x, lw, vw) => {
        doc.setDrawColor(190, 200, 220);
        R(x, y, lw + vw, H6);
        R(x, y, lw, H6, [230, 238, 252]);
        T(lbl, x + 1, y + 4, 5.5, true, "left", [0, 48, 135]);
        T(String(val ?? "—"), x + lw + 1, y + 4, 6.5);
    };

    campo("Supervisor", session.nombre || "—", M, 20, 52);
    campo("Fecha", session.fecha || "—", M + 72, 14, 22);
    campo("Vehículo", (session.vehiculo || "—").split("—")[0], M + 108, 16, 34);
    campo("Km Inicio", session.kmInicial || "—", M + 158, 16, 20);
    campo("Km Final", session.kmFinal || "—", M + 194, 16, 20);
    campo("Total Km", kmRec > 0 ? kmRec + " km" : "—", M + 230, 16, 19);
    y += H6;

    campo("Hora inicio", session.horaInicio || "—", M, 20, 20);
    campo("Hora fin", session.horaFin || "—", M + 40, 16, 20);
    campo("Total Horas", fmtHs(diffMin(session.horaInicio, session.horaFin)), M + 76, 20, 16);
    campo("Hs Traslados", fmtHs(tiempos.traslado), M + 112, 22, 18);
    campo("Hs Supervisión", fmtHs(tiempos.supervision), M + 152, 24, 18);
    campo("Hs Apoyo/Cap.", fmtHs(tiempos.apoyo), M + 194, 22, 18);
    campo("Hs Admin.", fmtHs(tiempos.admin), M + 234, 18, 15);
    y += H6 + 2;

    // ── ENCABEZADO TABLA ────────────────────────────────────────────────────
    const COLS = [
        { l: "OBJETIVO / PUESTO", w: 52 },
        { l: "H. ENTRADA", w: 16 },
        { l: "H. SALIDA", w: 16 },
        { l: "VIGILADOR", w: 44 },
        { l: "ACTIVIDAD", w: 24 },
        { l: "PAG.", w: 10 },
        { l: "ANOMALÍA", w: 16 },
        { l: "CALIFICACIÓN", w: 24 },
        { l: "OBSERVACIONES / NOTAS", w: 0 },
    ];
    let cx = M;
    COLS.forEach(c => { c.x = cx; cx += c.w; });
    COLS[8].w = M + CW - COLS[8].x;

    R(M, y, CW, 6, [0, 48, 135]);
    doc.setDrawColor(255, 255, 255);
    COLS.forEach(c => {
        L(c.x, y, c.x, y + 6);
        T(c.l, c.x + c.w / 2, y + 4, 5, true, "center", [255, 255, 255]);
    });
    y += 6;

    // ── FILAS ───────────────────────────────────────────────────────────────
    const RH = 8, MAX = 13;

    const linea = [{ tipo: "_inicio" }];
    for (let i = 0; i < acts.length; i++) {
        if (i > 0) {
            const gap = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
            if (gap > 5 && gap < 180)
                linea.push({ tipo: "_traslado", horaInicio: acts[i - 1].horaFin, horaFin: acts[i].horaInicio });
        }
        linea.push(acts[i]);
    }

    linea.slice(0, MAX).forEach((act, idx) => {
        const ry = y + idx * RH;
        const cy2 = ry + 5.2;
        const C = COLS;
        const cc = (col, val, sz, bold, al, color) =>
            T(String(val ?? "—"), C[col].x + (al === "center" ? C[col].w / 2 : 1), cy2, sz || 6, bold, al || "left", color || [0, 0, 0]);

        const bg = act.tipo === "_traslado" ? [232, 246, 255]
            : idx % 2 === 0 ? [250, 251, 255] : [255, 255, 255];
        R(M, ry, CW, RH, bg);
        doc.setDrawColor(210, 218, 235);
        L(M, ry + RH, M + CW, ry + RH);
        C.forEach(c => L(c.x, ry, c.x, ry + RH));
        L(M + CW, ry, M + CW, ry + RH);

        if (act.tipo === "_inicio") {
            cc(0, "—", 6, false, "center", [150, 150, 150]);
            cc(1, session.horaInicio || "—", 6.5, false, "center");
            cc(2, "—", 6, false, "center", [150, 150, 150]);
            cc(3, "—", 6, false, "center", [150, 150, 150]);
            RR(C[4].x + 1, ry + 1.5, C[4].w - 2, RH - 3, 1, [228, 240, 255]);
            T("Inicio", C[4].x + C[4].w / 2, cy2, 6, true, "center", [0, 48, 135]);
            cc(8, "Inicio del servicio del día de la fecha", 6, false, "left", [80, 80, 80]);

        } else if (act.tipo === "_traslado") {
            cc(0, "—", 6, false, "center", [100, 150, 190]);
            cc(1, act.horaInicio, 6.5, false, "center", [16, 110, 190]);
            cc(2, act.horaFin, 6.5, false, "center", [16, 110, 190]);
            cc(3, "—", 6, false, "center", [100, 150, 190]);
            RR(C[4].x + 1, ry + 1.5, C[4].w - 2, RH - 3, 1, [210, 237, 255]);
            T("Traslado", C[4].x + C[4].w / 2, cy2, 6, true, "center", [16, 110, 190]);
            cc(8, fmtHs(diffMin(act.horaInicio, act.horaFin)) + " en tránsito", 6, false, "left", [16, 110, 190]);

        } else if (act.tipo === "ctrl") {
            const prom = promedioCtrl(act);
            const rl = prom !== null ? ratingLabel(prom) : null;
            cc(0, (act.objetivo || "—").substring(0, 30), 6);
            cc(1, act.horaInicio || "—", 6.5, false, "center");
            cc(2, act.horaFin || "—", 6.5, false, "center");
            cc(3, (act.vigilador || "—").split(" ").slice(0, 3).join(" "), 5.5);
            RR(C[4].x + 1, ry + 1.5, C[4].w - 2, RH - 3, 1, [228, 240, 255]);
            T("Supervisión", C[4].x + C[4].w / 2, cy2, 5.5, true, "center", [0, 48, 135]);
            cc(5, act.paginaLibro || "—", 6, false, "center");
            const anomOk = act.anomalia !== "Sí";
            RR(C[6].x + 1, ry + 1.5, C[6].w - 2, RH - 3, 1, anomOk ? [240, 255, 245] : [255, 235, 235]);
            T(anomOk ? "No" : "SÍ", C[6].x + C[6].w / 2, cy2, 6, true, "center", anomOk ? [22, 163, 74] : [220, 38, 38]);
            if (rl) { RR(C[7].x + 1, ry + 1.5, C[7].w - 2, RH - 3, 1.5, rl.color); T(rl.txt, C[7].x + C[7].w / 2, cy2, 6, true, "center", [255, 255, 255]); }
            if (act.ratings) {
                const rs = Object.entries(act.ratings).map(([k, v]) => k.substring(0, 3) + ":" + v).join("  ");
                cc(8, rs, 5, false, "left", [80, 80, 80]);
            }

        } else if (act.tipo === "cap") {
            cc(0, "—", 6, false, "center", [150, 150, 150]);
            cc(1, act.horaInicio || "—", 6.5, false, "center");
            cc(2, act.horaFin || "—", 6.5, false, "center");
            cc(3, "—", 6, false, "center", [150, 150, 150]);
            RR(C[4].x + 1, ry + 1.5, C[4].w - 2, RH - 3, 1, [220, 246, 255]);
            T("Capacit.", C[4].x + C[4].w / 2, cy2, 5.5, true, "center", [14, 165, 233]);
            cc(8, act.tema || "—", 5.5, false, "left", [14, 120, 190]);

        } else if (act.tipo === "otra") {
            cc(0, "—", 6, false, "center", [150, 150, 150]);
            cc(1, act.horaInicio || "—", 6.5, false, "center");
            cc(2, act.horaFin || "—", 6.5, false, "center");
            cc(3, "—", 6, false, "center", [150, 150, 150]);
            RR(C[4].x + 1, ry + 1.5, C[4].w - 2, RH - 3, 1, [255, 246, 220]);
            T("Admin.", C[4].x + C[4].w / 2, cy2, 5.5, true, "center", [180, 100, 0]);
            cc(8, (act.actividad || "") + (act.observaciones ? " — " + act.observaciones : ""), 5.5, false, "left", [130, 90, 0]);
        }
    });

    y += MAX * RH + 3;

    // ── RESUMEN INFERIOR ────────────────────────────────────────────────────
    R(M, y, CW, 20, [245, 247, 253]);
    doc.setDrawColor(0, 48, 135); doc.setLineWidth(0.4);
    doc.rect(M, y, CW, 20, "S"); doc.setLineWidth(0.2);

    R(M, y, 36, 6, [0, 48, 135]);
    T("RESUMEN DE JORNADA", M + 18, y + 4, 5.5, true, "center", [255, 255, 255]);
    R(M + 36, y + 2.4, CW - 36, 1.2, [226, 1, 19]);
    y += 8;

    const ctrlList = acts.filter(a => a.tipo === "ctrl");
    const capList = acts.filter(a => a.tipo === "cap");
    const otraList = acts.filter(a => a.tipo === "otra");

    const mets = [
        { l: "Controles", v: ctrlList.length, c: [0, 48, 135] },
        { l: "Capacitaciones", v: capList.length, c: [14, 165, 233] },
        { l: "Otras act.", v: otraList.length, c: [245, 158, 11] },
        { l: "Hs Supervisión", v: fmtHs(tiempos.supervision), c: [0, 48, 135] },
        { l: "Hs Traslados", v: fmtHs(tiempos.traslado), c: [16, 163, 127] },
        { l: "Hs Admin.", v: fmtHs(tiempos.admin), c: [245, 158, 11] },
        { l: "Km recorridos", v: kmRec > 0 ? kmRec + " km" : "—", c: [100, 100, 100] },
        { l: "Nocturnos", v: ctrlList.filter(c => c.turno === "nocturno").length, c: [99, 90, 200] },
        { l: "Fin de semana", v: ctrlList.filter(c => c.esFinDeSemana).length, c: [220, 70, 150] },
    ];

    const mw = CW / mets.length;
    mets.forEach((m, i) => {
        const mx = M + i * mw;
        if (i > 0) { doc.setDrawColor(200, 210, 230); L(mx, y - 5, mx, y + 9); }
        T(String(m.v), mx + mw / 2, y + 1, 10, true, "center", m.c);
        T(m.l, mx + mw / 2, y + 7, 5.5, false, "center", [90, 90, 90]);
    });

    // ── PIE ─────────────────────────────────────────────────────────────────
    R(M, H - M - 1, CW, 1, [226, 1, 19]);
    doc.setFontSize(5); doc.setTextColor(160, 160, 160); doc.setFont("helvetica", "normal");
    doc.text(`CyranoApp · Generado: ${new Date().toLocaleString("es-AR")} · Jornada ${session.jornadaID || ""}`, W / 2, H - M + 1.5, { align: "center" });

    const filename = `HojaSupervision_${(session.nombre || "").split(" ")[0]}_${session.fecha || "hoy"}_${session.jornadaID || ""}.pdf`;
    return { blob: doc.output("blob"), dataUrl: doc.output("datauristring"), filename };
}
