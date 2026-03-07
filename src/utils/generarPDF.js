// src/utils/generarPDF.js
// Genera la Hoja de Recorrido en PDF con jsPDF (cargado desde CDN)

// Normaliza hora a HH:MM 24h (maneja "09:23 p. m.", "9:23 PM", "21:23", etc.)
const normHora = (t) => {
    if (!t) return null;
    const s = String(t).trim();
    // Ya está en 24h: "21:23" o "09:23"
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return s.padStart(5, "0");
    // Formato 12h con AM/PM: "9:23 p. m." o "09:23 PM"
    const m12 = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)/i);
    if (m12) {
        let h = parseInt(m12[1]), mn = parseInt(m12[2]);
        const isPM = /p/i.test(m12[4]);
        if (isPM && h !== 12) h += 12;
        if (!isPM && h === 12) h = 0;
        return String(h).padStart(2,"0") + ":" + String(mn).padStart(2,"0");
    }
    return s;
};
const toMin = (t) => { const n = normHora(t); if (!n) return 0; const [h, m] = n.split(":").map(Number); return h * 60 + (m || 0); };
const diffMin = (a, b) => { if (!a || !b) return 0; let d = toMin(b) - toMin(a); if (d < 0) d += 1440; return Math.max(d, 0); };
const fmtHs = (min) => { if (!min || min <= 0) return "00:00"; return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); };

const normAct = (a) => {
    const hi = a.horaInicio || (a.iniciadaEn   ? a.iniciadaEn.slice(11,16)   : null);
    const hf = a.horaFin    || (a.finalizadaEn ? a.finalizadaEn.slice(11,16) : null);
    return { ...a, horaInicio: normHora(hi), horaFin: normHora(hf) };
};

const calcTiempos = (session) => {
    const acts = [...(session.actividades || [])].map(normAct)
        .filter(a => a.horaInicio && a.horaFin)
        .sort((a, b) => toMin(a.horaInicio) - toMin(b.horaInicio));
    let supervision = 0, apoyo = 0, admin = 0, traslado = 0;
    let taller = 0, vulnerab = 0, reclamos = 0, gremial = 0, almuerzo = 0, otras = 0;
    acts.forEach(a => {
        const d    = diffMin(a.horaInicio, a.horaFin);
        const act2 = (a.actividad || "").toLowerCase();
        if (a.tipo === "ctrl") supervision += d;
        else if (a.tipo === "cap") apoyo += d;
        else if (a.tipo === "otra") {
            if      (act2.includes("admin"))               admin     += d;
            else if (act2.includes("traslado"))            traslado  += d;
            else if (act2.includes("reparac") || act2.includes("taller")) taller  += d;
            else if (act2.includes("vulnerab") || act2.includes("riesgo")) vulnerab += d;
            else if (act2.includes("reclamo"))             reclamos  += d;
            else if (act2.includes("gremial"))             gremial   += d;
            else if (act2.includes("almuerzo") || act2.includes("cena")) almuerzo += d;
            else                                           otras     += d;
        }
    });
    for (let i = 1; i < acts.length; i++) {
        const g = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
        if (g > 5 && g < 180) traslado += g;
    }
    return { supervision, apoyo, admin, traslado, taller, vulnerab, reclamos, gremial, almuerzo, otras };
};

const promedioCtrl = (ctrl) => {
    if (!ctrl.ratings) return null;
    const vals = Object.values(ctrl.ratings).filter(v => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
};

// Puntaje: promedio × 10 pts
const ratingLabel = (avg) => {
    if (avg === null || avg === undefined) return null;
    const pts = avg * 10;
    if (avg <= 1) return { txt: "Muy mal",  pts, color: [220, 38, 38]  };
    if (avg <= 3) return { txt: "Mal",       pts, color: [234, 88, 12]  };
    if (avg <= 5) return { txt: "Normal",    pts, color: [202, 138, 4]  };
    if (avg <= 7) return { txt: "Bien",      pts, color: [22, 163, 74]  };
    return                { txt: "Muy bien", pts, color: [15, 118, 110] };
};

// Carga imagen como base64 via canvas
const loadImage = (url) => new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        res({ data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => res(null);
    img.src = url + "?t=" + Date.now();
});

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

    // Vehículo: "Hilux | AF 373 JP"
    const vehiculoFmt = (session.vehiculo || "—").replace(" — ", " | ");

    // Normalizar horas de la sesión a 24h
    const sesHoraInicio = normHora(session.horaInicio) || session.horaInicio || "—";
    const sesHoraFin    = normHora(session.horaFin)    || session.horaFin    || "—";

    const acts = [...(session.actividades || [])].map(normAct)
        .filter(a => a.horaInicio && a.horaFin)
        .sort((a, b) => toMin(a.horaInicio) - toMin(b.horaInicio));

    doc.setLineWidth(0.2);
    const R  = (x, y, w, h, fill) => {
        if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, "F"); }
        else { doc.setDrawColor(190, 200, 220); doc.rect(x, y, w, h, "S"); }
    };
    const RR = (x, y, w, h, r, fill) => { doc.setFillColor(...fill); doc.roundedRect(x, y, w, h, r, r, "F"); };
    const L  = (x1, y1, x2, y2, c) => { if (c) doc.setDrawColor(...c); doc.line(x1, y1, x2, y2); };
    const T  = (t, x, y, sz, bold, al, color) => {
        doc.setFontSize(sz || 7);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...(color || [0, 0, 0]));
        doc.text(String(t ?? ""), x, y, { align: al || "left" });
    };

    let y = M;

    // ── FRANJA AZUL SUPERIOR ─────────────────────────────────────────────────
    R(M, y, CW, 1.2, [0, 48, 135]);
    y += 1.2;

    // ── BLOQUE CABECERA ──────────────────────────────────────────────────────
    const HEADER_H = 15;
    R(M, y, CW, HEADER_H, [252, 253, 255]);
    doc.setDrawColor(190, 200, 220);
    doc.rect(M, y, CW, HEADER_H, "S");

    // Logo izquierdo — 15px margen arriba y abajo en mm (1px ≈ 0.26mm → ~4mm margen)
    const LOGO_MARGIN = 1.5;
    const LOGO_H = HEADER_H - LOGO_MARGIN * 2;
    const LOGO_MAX_W = 58;
    let logoOk = false;
    try {
        const logoData = await loadImage("/images/LogoApp.png");
        if (logoData) {
            const ratio = logoData.w / logoData.h;
            const lh = LOGO_H;
            const lw = Math.min(lh * ratio, LOGO_MAX_W);
            doc.addImage(logoData.data, "PNG", M + 2, y + LOGO_MARGIN, lw, lh);
            logoOk = true;
        }
    } catch {}

    if (!logoOk) {
        RR(M + 1, y + 2, 38, HEADER_H - 4, 1, [0, 48, 135]);
        T("EQUIPO BRINKS", M + 20, y + HEADER_H / 2 + 2, 8, true, "center", [255, 255, 255]);
    }

    // Título centrado absoluto (horizontal y vertical)
    const titleCY = y + HEADER_H / 2;
    T("HOJA DE RECORRIDO DIARIO", W / 2, titleCY - 1, 13, true, "center", [0, 48, 135]);
    T("Formulario BSCGOP-FOR-002  ·  Versión 2.0", W / 2, titleCY + 4.5, 5, false, "center", [140, 140, 140]);

    // Datos derecha
    T("Modificada: " + new Date().toLocaleDateString("es-AR"), W - M - 1, y + 5.5, 5, false, "right", [120, 120, 120]);
    T("ID: " + (session.jornadaID || "—"), W - M - 1, y + 11, 5.5, true, "right", [0, 48, 135]);

    y += HEADER_H;
    R(M, y, CW, 0.8, [226, 1, 19]);
    y += 1.8;

    // ── DATOS JORNADA (2 filas) ───────────────────────────────────────────────
    const H6 = 5.8;
    const campo = (lbl, val, x, lw, vw) => {
        doc.setDrawColor(190, 200, 220);
        R(x, y, lw + vw, H6);
        R(x, y, lw, H6, [230, 238, 252]);
        T(lbl, x + 1, y + 4, 4.8, true, "left", [0, 48, 135]);
        T(String(val ?? "—"), x + lw + 1, y + 4, 6);
    };

    // Fila 1: identificación
    campo("Colaborador",  session.nombre || "—",           M,       22, 50);
    campo("Fecha",        session.fecha  || "—",            M + 72,  12, 22);
    campo("Vehículo",     vehiculoFmt,                      M + 106, 14, 44);
    campo("Km Inicio",    session.kmInicial || "—",         M + 164, 14, 18);
    campo("Km Final",     session.kmFinal   || "—",         M + 196, 13, 18);
    campo("Total Km",     kmRec > 0 ? kmRec + " km" : "—", M + 227, 13, 18);
    y += H6;

    // Fila 2: tiempos + email
    const totalMin = (session.cerradaEn && session.creadaEn)
        ? Math.round((new Date(session.cerradaEn) - new Date(session.creadaEn)) / 60000)
        : diffMin(sesHoraInicio, sesHoraFin);
    campo("Hora inicio",    sesHoraInicio,               M,       16, 16);
    campo("Hora fin",       sesHoraFin,                  M + 32,  14, 16);
    campo("Total Hs",       fmtHs(totalMin),             M + 62,  14, 14);
    campo("Hs Traslados",   fmtHs(tiempos.traslado),    M + 90,  16, 16);
    campo("Hs Supervisión", fmtHs(tiempos.supervision), M + 122, 18, 16);
    campo("Hs Apoyo/Cap.",  fmtHs(tiempos.apoyo),       M + 156, 17, 16);
    campo("Hs Admin.",      fmtHs(tiempos.admin),       M + 189, 14, 14);
    campo("Email",          session.email || "—",        M + 217, 12, 38);
    y += H6;

    // Fila 3: actividades especiales
    const H3 = 5.4;
    const campoF3 = (lbl, val, x, lw, vw) => {
        doc.setDrawColor(200, 210, 228);
        R(x, y, lw + vw, H3, [248, 250, 255]);
        R(x, y, lw, H3, [225, 232, 248]);
        T(lbl, x + 1, y + 3.5, 4.5, true, "left", [0, 48, 135]);
        T(String(val ?? ""), x + lw + 1, y + 3.5, 5.5, false, "left", val ? [30, 30, 30] : [180, 180, 180]);
    };
    const fmtHsOpt = (m) => m > 0 ? fmtHs(m) : "";
    campoF3("Horas Almuerzo",  fmtHsOpt(tiempos.almuerzo),  M,        28, 18);
    campoF3("Análisis riesgos",fmtHsOpt(tiempos.vulnerab),  M + 46,   28, 18);
    campoF3("Visita gremial",  fmtHsOpt(tiempos.gremial),   M + 92,   24, 18);
    campoF3("Capacitacion",    fmtHsOpt(tiempos.apoyo),     M + 134,  22, 18);
    campoF3("Atencion reclamos",fmtHsOpt(tiempos.reclamos), M + 174,  30, 54);
    y += H3 + 1.5;

    // ── ENCABEZADO TABLA ──────────────────────────────────────────────────────
    const COLS = [
        { l: "OBJETIVO / PUESTO",     w: 42 },
        { l: "H. ENT.",               w: 12 },
        { l: "H. SAL.",               w: 12 },
        { l: "VIGILADOR",             w: 34 },
        { l: "ACTIVIDAD",             w: 19 },
        { l: "PAG.",                  w:  9 },
        { l: "ANOMALÍA",              w: 13 },
        { l: "CALIFICACIÓN",          w: 30 },
        { l: "GPS",                   w: 30 },
        { l: "OBSERVACIONES / NOTAS", w:  0 },
    ];
    let cx2 = M;
    COLS.forEach(c => { c.x = cx2; cx2 += c.w; });
    COLS[9].w = M + CW - COLS[9].x;

    R(M, y, CW, 5.5, [0, 48, 135]);
    doc.setDrawColor(255, 255, 255);
    COLS.forEach(c => {
        L(c.x, y, c.x, y + 5.5);
        T(c.l, c.x + c.w / 2, y + 3.8, 4.2, true, "center", [255, 255, 255]);
    });
    y += 5.5;

    // ── FILAS ─────────────────────────────────────────────────────────────────
    const RH = 7.0, MAX = 20;

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
        const ry  = y + idx * RH;
        const cy2 = ry + 4.8;
        const C   = COLS;
        const cc  = (col, val, sz, bold, al, color) =>
            T(String(val ?? "—"), C[col].x + (al === "center" ? C[col].w / 2 : 1), cy2, sz || 5, bold, al || "left", color || [20, 20, 20]);

        const bg = act.tipo === "_traslado" ? [232, 246, 255]
            : idx % 2 === 0 ? [250, 251, 255] : [255, 255, 255];
        R(M, ry, CW, RH, bg);
        doc.setDrawColor(210, 218, 235);
        L(M, ry + RH, M + CW, ry + RH);
        C.forEach(c => L(c.x, ry, c.x, ry + RH));
        L(M + CW, ry, M + CW, ry + RH);

        if (act.tipo === "_inicio") {
            cc(0, "—", 5, false, "center", [160, 160, 160]);
            cc(1, sesHoraInicio, 5.5, false, "center");
            cc(2, "—", 5, false, "center", [160, 160, 160]);
            cc(3, "—", 5, false, "center", [160, 160, 160]);
            RR(C[4].x + 1, ry + 1.2, C[4].w - 2, RH - 2.5, 1, [228, 240, 255]);
            T("Inicio", C[4].x + C[4].w / 2, cy2, 5, true, "center", [0, 48, 135]);
            cc(9, "Inicio del servicio del día de la fecha", 5, false, "left", [90, 90, 90]);

        } else if (act.tipo === "_traslado") {
            cc(0, "—", 5, false, "center", [100, 150, 190]);
            cc(1, act.horaInicio, 5.5, false, "center", [16, 110, 190]);
            cc(2, act.horaFin,    5.5, false, "center", [16, 110, 190]);
            cc(3, "—", 5, false, "center", [100, 150, 190]);
            RR(C[4].x + 1, ry + 1.2, C[4].w - 2, RH - 2.5, 1, [210, 237, 255]);
            T("Traslado", C[4].x + C[4].w / 2, cy2, 5, true, "center", [16, 110, 190]);
            cc(9, fmtHs(diffMin(act.horaInicio, act.horaFin)) + " en tránsito", 5, false, "left", [16, 110, 190]);

        } else if (act.tipo === "ctrl") {
            const prom = promedioCtrl(act);
            const rl   = prom !== null ? ratingLabel(prom) : null;
            cc(0, (act.objetivo || "—").substring(0, 28), 5);
            cc(1, act.horaInicio || "—", 5.5, false, "center");
            cc(2, act.horaFin    || "—", 5.5, false, "center");
            cc(3, (act.vigilador || "—").split(" ").slice(0, 3).join(" "), 4.8);
            RR(C[4].x + 1, ry + 1.2, C[4].w - 2, RH - 2.5, 1, [228, 240, 255]);
            T("Superv.", C[4].x + C[4].w / 2, cy2, 4.8, true, "center", [0, 48, 135]);
            cc(5, act.paginaLibro || "—", 5, false, "center");
            const anomOk = act.anomalia !== "Sí";
            RR(C[6].x + 1, ry + 1.2, C[6].w - 2, RH - 2.5, 1, anomOk ? [240, 255, 245] : [255, 235, 235]);
            T(anomOk ? "No" : "SÍ", C[6].x + C[6].w / 2, cy2, 5, true, "center", anomOk ? [22, 163, 74] : [220, 38, 38]);
            if (rl) {
                RR(C[7].x + 1, ry + 1.2, C[7].w - 2, RH - 2.5, 1.5, rl.color);
                T(`${rl.txt}  ${rl.pts} pts`, C[7].x + C[7].w / 2, cy2, 4.5, true, "center", [255, 255, 255]);
            }
            // GPS
            const gps = (act.ubicacionGPS || "—").substring(0, 24);
            cc(8, gps, 4.2, false, "left", [70, 100, 150]);
            // Ratings abreviados en observaciones
            if (act.ratings) {
                const rs = Object.entries(act.ratings).map(([k, v]) => k.substring(0, 3) + ":" + v).join("  ");
                cc(9, rs, 4.2, false, "left", [80, 80, 80]);
            }

        } else if (act.tipo === "cap") {
            cc(0, "—", 5, false, "center", [160, 160, 160]);
            cc(1, act.horaInicio || "—", 5.5, false, "center");
            cc(2, act.horaFin    || "—", 5.5, false, "center");
            cc(3, "—", 5, false, "center", [160, 160, 160]);
            RR(C[4].x + 1, ry + 1.2, C[4].w - 2, RH - 2.5, 1, [220, 246, 255]);
            T("Capacit.", C[4].x + C[4].w / 2, cy2, 4.8, true, "center", [14, 165, 233]);
            cc(8, (act.ubicacionGPS || "—").substring(0, 24), 4.2, false, "left", [70, 100, 150]);
            cc(9, act.tema || "—", 4.8, false, "left", [14, 120, 190]);

        } else if (act.tipo === "otra") {
            const activNom = act.actividad || "";
            // Colores y etiquetas según tipo de actividad
            const tipoMeta = (() => {
                const a = activNom.toLowerCase();
                if (a.includes("traslado personal"))   return { lbl: "Traslado",  bg: [230,245,255], fg: [16,110,190]  };
                if (a.includes("traslado elemento"))   return { lbl: "Traslado",  bg: [230,245,255], fg: [16,110,190]  };
                if (a.includes("reparac"))             return { lbl: "Taller",    bg: [255,240,220], fg: [160,80,0]    };
                if (a.includes("admin"))               return { lbl: "Admin.",    bg: [240,255,240], fg: [22,120,60]   };
                if (a.includes("vulnerab"))            return { lbl: "Vulnerab.", bg: [250,235,255], fg: [120,0,180]   };
                if (a.includes("riesgo"))              return { lbl: "Riesgos",   bg: [255,235,235], fg: [180,0,0]     };
                if (a.includes("reclamo"))             return { lbl: "Reclamos",  bg: [255,245,220], fg: [160,100,0]   };
                if (a.includes("gremial"))             return { lbl: "Gremial",   bg: [235,250,255], fg: [0,130,160]   };
                if (a.includes("almuerzo") || a.includes("cena")) return { lbl: "Almuerzo", bg: [250,250,230], fg: [120,120,0] };
                return { lbl: "Otras", bg: [255,246,220], fg: [180,100,0] };
            })();
            cc(0, (act.lugar || act.lugarActividad || "—").substring(0, 28), 5);
            cc(1, act.horaInicio || "—", 5.5, false, "center");
            cc(2, act.horaFin    || "—", 5.5, false, "center");
            cc(3, "—", 5, false, "center", [160, 160, 160]);
            RR(C[4].x + 1, ry + 1.2, C[4].w - 2, RH - 2.5, 1, tipoMeta.bg);
            T(tipoMeta.lbl, C[4].x + C[4].w / 2, cy2, 4.8, true, "center", tipoMeta.fg);
            const gpsOtra = (act.lugarFin || act.lugarInicio || "—").substring(0, 24);
            cc(8, gpsOtra, 4.2, false, "left", [70, 100, 150]);
            cc(9, activNom + (act.observaciones ? " — " + act.observaciones : ""), 4.8, false, "left", tipoMeta.fg);
        }
    });

    y += MAX * RH + 1.5;

    // ── RESUMEN MINIMALISTA ───────────────────────────────────────────────────
    // Franja única sin recuadro interior: borde izquierdo azul + métricas alineadas
    const RS_H = 13;
    R(M, y, CW, RS_H, [246, 248, 252]);
    doc.setDrawColor(190, 200, 220);
    doc.rect(M, y, CW, RS_H, "S");
    R(M, y, 2, RS_H, [0, 48, 135]);   // borde izquierdo azul

    T("RESUMEN", M + 4, y + RS_H / 2 + 2, 5.5, true, "left", [0, 48, 135]);

    const ctrlList = acts.filter(a => a.tipo === "ctrl");
    const capList  = acts.filter(a => a.tipo === "cap");
    const otraList = acts.filter(a => a.tipo === "otra");

    // Construir métricas dinámicas — solo mostrar tiempos > 0
    const mets = [
        { l: "Controles",   v: String(ctrlList.length),                              c: [0, 48, 135]   },
        { l: "Capacit.",    v: String(capList.length),                               c: [14, 165, 233] },
        { l: "Otras",       v: String(otraList.length),                              c: [245, 158, 11] },
        { l: "Hs Superv.",  v: fmtHs(tiempos.supervision),                          c: [0, 48, 135]   },
        { l: "Hs Traslado", v: fmtHs(tiempos.traslado),                             c: [16, 163, 127] },
        ...(tiempos.apoyo    > 0 ? [{ l: "Hs Apoyo",    v: fmtHs(tiempos.apoyo),    c: [14, 165, 233] }] : []),
        ...(tiempos.admin    > 0 ? [{ l: "Hs Admin.",   v: fmtHs(tiempos.admin),    c: [245, 158, 11] }] : []),
        ...(tiempos.taller   > 0 ? [{ l: "Hs Taller",   v: fmtHs(tiempos.taller),  c: [160, 80, 0]   }] : []),
        ...(tiempos.vulnerab > 0 ? [{ l: "Hs Vuln/Riesg",v: fmtHs(tiempos.vulnerab), c: [120, 0, 180]  }] : []),
        ...(tiempos.reclamos > 0 ? [{ l: "Hs Reclamos", v: fmtHs(tiempos.reclamos),c: [160, 100, 0]  }] : []),
        ...(tiempos.gremial  > 0 ? [{ l: "Hs Gremial",  v: fmtHs(tiempos.gremial), c: [0, 130, 160]  }] : []),
        ...(tiempos.almuerzo > 0 ? [{ l: "Hs Almuerzo", v: fmtHs(tiempos.almuerzo),c: [120, 120, 0]  }] : []),
        ...(tiempos.otras    > 0 ? [{ l: "Hs Otras",    v: fmtHs(tiempos.otras),   c: [180, 100, 0]  }] : []),
        { l: "Km recorr.",  v: kmRec > 0 ? kmRec + " km" : "—",                     c: [80, 80, 80]   },
        { l: "Nocturnos",   v: String(ctrlList.filter(c => c.turno === "nocturno").length), c: [99, 90, 200] },
        { l: "Fin de sem.", v: String(ctrlList.filter(c => c.esFinDeSemana).length), c: [220, 70, 150] },
    ];

    const startX = M + 20;
    const mw = (CW - 20) / mets.length;
    mets.forEach((m, i) => {
        const mx = startX + i * mw;
        if (i > 0) { doc.setDrawColor(210, 218, 235); L(mx, y + 1.5, mx, y + RS_H - 1.5); }
        T(m.v, mx + mw / 2, y + 6,          8.5, true,  "center", m.c);
        T(m.l, mx + mw / 2, y + RS_H - 1.5, 4.2, false, "center", [120, 120, 120]);
    });

    // ── PIE ───────────────────────────────────────────────────────────────────
    R(M, H - M - 0.8, CW, 0.8, [226, 1, 19]);
    doc.setFontSize(4.5); doc.setTextColor(160, 160, 160); doc.setFont("helvetica", "normal");
    doc.text(
        `CyranoApp · Generado: ${new Date().toLocaleString("es-AR")} · Jornada ${session.jornadaID || ""}`,
        W / 2, H - M + 1.5, { align: "center" }
    );

    const filename = `HojaRecorrido_${(session.nombre || "").split(" ")[0]}_${session.fecha || "hoy"}_${session.jornadaID || ""}.pdf`;
    return { blob: doc.output("blob"), dataUrl: doc.output("datauristring"), filename };
}
