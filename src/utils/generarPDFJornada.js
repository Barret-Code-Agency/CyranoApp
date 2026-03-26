// src/utils/generarPDFJornada.js
// Hoja de Supervisión Diaria — Formulario BSCGOP-FOR-002 v2.0
// Tabla cronológica unificada con todos los tipos de actividad

import { jsPDF } from "jspdf";

// ── Paleta ─────────────────────────────────────────────────────────────────────
const AZUL    = [0,   45,  114];
const ROJO    = [226, 1,   19 ];
const GRIS_BG = [245, 247, 252];
const GRIS_BD = [210, 214, 225];
const TEXTO   = [13,  27,  62 ];
const MUTED   = [120, 132, 158];
const BLANCO  = [255, 255, 255];
const W       = 210;
const PAD     = 10;
const CW      = W - PAD * 2;     // 190mm ancho de contenido

// ── Colores por tipo de actividad ──────────────────────────────────────────────
const TIPO_CONFIG = {
    inicio:    { label: "Inicio",     bg: [16,  185, 129], fg: BLANCO },
    fin:       { label: "Fin",        bg: [100, 116, 139], fg: BLANCO },
    ctrl:      { label: "Supervision",bg: [28,  100, 242], fg: BLANCO },
    cap:       { label: "Capacit.",   bg: [139, 92,  246], fg: BLANCO },
    traslado:  { label: "Traslado",   bg: [14,  165, 233], fg: BLANCO },
    admin:     { label: "Admin.",     bg: [80,  90,  105], fg: BLANCO },
    vulnerab:  { label: "Vulnerab.",  bg: [234, 88,  12 ], fg: BLANCO },
    reclamos:  { label: "Reclamo",    bg: [220, 38,  38 ], fg: BLANCO },
    almuerzo:  { label: "Almuerzo",   bg: [34,  197, 94 ], fg: BLANCO },
    taller:    { label: "Taller",     bg: [100, 116, 139], fg: BLANCO },
    gremial:   { label: "Gremial",    bg: [168, 85,  247], fg: BLANCO },
    otras:     { label: "Otras",      bg: [156, 163, 175], fg: BLANCO },
};

// ── Columnas de la tabla unificada ─────────────────────────────────────────────
// Suma total = 1.0 → CW mm
const COLS = [
    { key: "objetivo",      header: "OBJETIVO / PUESTO",     w: 0.22 },
    { key: "entrada",       header: "H. ENTRADA",             w: 0.08 },
    { key: "salida",        header: "H. SALIDA",              w: 0.08 },
    { key: "vigilador",     header: "VIGILADOR",              w: 0.15 },
    { key: "actividad",     header: "ACTIVIDAD",              w: 0.09 },
    { key: "pag",           header: "PAG.",                   w: 0.05 },
    { key: "anomalia",      header: "ANOMALIA",               w: 0.06 },
    { key: "calificacion",  header: "CALIFICACION",           w: 0.09 },
    { key: "obs",           header: "OBSERVACIONES / NOTAS",  w: 0.18 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const c = s => String(s || "")
    .replace(/[àáâã]/g,"a").replace(/[èéêë]/g,"e")
    .replace(/[ìíîï]/g,"i").replace(/[òóôõ]/g,"o")
    .replace(/[ùúûü]/g,"u").replace(/ñ/g,"n")
    .replace(/[ÀÁÂÃ]/g,"A").replace(/[ÈÉÊË]/g,"E")
    .replace(/[ÌÍÎÏ]/g,"I").replace(/[ÒÓÔÕ]/g,"O")
    .replace(/[ÙÚÛÜ]/g,"U").replace(/Ñ/g,"N")
    .replace(/[^\x00-\x7F]/g,"");

function parseTimeMin(s) {
    if (!s) return -1;
    const lower = String(s).toLowerCase().replace(/\s/g,"");
    const isPM  = lower.includes("p.m.") || lower.includes("pm");
    const isAM  = lower.includes("a.m.") || lower.includes("am");
    const parts = lower.replace(/[ap]\.?m\.?/g,"").split(":");
    let h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
}

function diffMin(ini, fin) {
    if (!ini || !fin) return 0;
    const t1 = parseTimeMin(ini), t2 = parseTimeMin(fin);
    return (t1 >= 0 && t2 > t1) ? t2 - t1 : 0;
}

function fmtHHMM(mins) {
    if (!mins || mins <= 0) return "00:00";
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

const CRITERIOS_ABBR = {
    "Presencia":                        "Pre",
    "Cumplimiento de horarios":         "Cum",
    "Completado de libro y registros":  "Com",
    "Estado del equipamiento":          "Est",
    "Orden y aseo del puesto":          "Ord",
    "Conocimiento de consignas":        "Con",
};

function califLabel(ratings) {
    if (!ratings) return null;
    const vals = Object.values(ratings).filter(v => v > 0);
    if (!vals.length) return null;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (avg >= 9)  return "Excelente";
    if (avg >= 7)  return "Muy bien";
    if (avg >= 5)  return "Aceptable";
    if (avg >= 3)  return "Regular";
    return "Insuficiente";
}

function califScores(ratings) {
    if (!ratings) return "";
    return Object.entries(ratings)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${CRITERIOS_ABBR[k] || k.substring(0,3)}:${v}`)
        .join("  ");
}

// ── Header de página ───────────────────────────────────────────────────────────
function drawPageHeader(doc, empresaNombre, logoBase64, fecha) {
    // Banda azul
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, W, 26, "F");
    // Banda roja
    doc.setFillColor(...ROJO);
    doc.rect(0, 26, W, 2, "F");

    // Logo
    let logoW = 0;
    if (logoBase64) {
        try {
            const fmt   = logoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
            const props = doc.getImageProperties(logoBase64);
            const maxH  = 18, maxW = 30;
            const ratio = props.width / props.height;
            let iw = maxH * ratio, ih = maxH;
            if (iw > maxW) { iw = maxW; ih = iw / ratio; }
            doc.addImage(logoBase64, fmt, PAD, 4 + (maxH - ih) / 2, iw, ih);
            logoW = iw + 4;
        } catch { /* sin logo */ }
    }

    // Nombre empresa (arriba izquierda)
    const tx = PAD + logoW;
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(c(empresaNombre || "CyranoApp"), tx, 8);

    // Título centrado
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("HOJA DE SUPERVISION DIARIA", W / 2, 15, { align: "center" });

    // Formulario (arriba derecha)
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("Formulario BSCGOP-FOR-002 - Version 2.0", W - PAD, 8, { align: "right" });
    doc.text(`Modificada: ${fecha || new Date().toLocaleDateString("es-AR")}`, W - PAD, 13, { align: "right" });

    doc.setTextColor(...TEXTO);
}

// ── Celda de info ──────────────────────────────────────────────────────────────
function infoCell(doc, x, y, w, h, label, value, bold = false) {
    doc.setFillColor(...GRIS_BG);
    doc.rect(x, y, w, h, "F");
    doc.setDrawColor(...GRIS_BD);
    doc.rect(x, y, w, h, "S");
    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(c(label).toUpperCase(), x + 2, y + 4.5);
    // Value
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXTO);
    const val = c(String(value || "--")).substring(0, 30);
    doc.text(val, x + 2, y + 10);
}

// ── Encabezado de tabla ────────────────────────────────────────────────────────
function drawTableHeader(doc, y) {
    const rowH = 7;
    doc.setFillColor(20, 50, 110);
    doc.rect(PAD, y, CW, rowH, "F");
    doc.setTextColor(...BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    let x = PAD;
    COLS.forEach(col => {
        const cw = col.w * CW;
        doc.text(c(col.header), x + 2, y + 4.5, { maxWidth: cw - 3 });
        x += cw;
    });
    doc.setTextColor(...TEXTO);
    return y + rowH;
}

// ── Fila de actividad ─────────────────────────────────────────────────────────
function drawActivityRow(doc, y, row, alt) {
    const rowH = row.rowH || 7;

    // Fondo alternado
    if (alt) {
        doc.setFillColor(248, 249, 253);
        doc.rect(PAD, y, CW, rowH, "F");
    }
    // Línea inferior
    doc.setDrawColor(...GRIS_BD);
    doc.line(PAD, y + rowH, PAD + CW, y + rowH);

    let x = PAD;
    COLS.forEach(col => {
        const cw = col.w * CW;

        if (col.key === "actividad" && row.tipo) {
            // Badge de color para el tipo
            const cfg = TIPO_CONFIG[row.tipo] || TIPO_CONFIG.otras;
            const bx = x + 1, by = y + 1.5, bw = cw - 2, bh = rowH - 3;
            doc.setFillColor(...cfg.bg);
            doc.roundedRect(bx, by, bw, bh, 1, 1, "F");
            doc.setTextColor(...cfg.fg);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5.5);
            doc.text(c(cfg.label), bx + bw / 2, by + bh / 2 + 1.5, { align: "center", maxWidth: bw - 2 });
            doc.setTextColor(...TEXTO);
        } else {
            const val = c(row[col.key] || "");
            const bold = col.key === "anomalia" && val === "SI";
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.setFontSize(6.5);
            if (bold) doc.setTextColor(200, 30, 30);
            else doc.setTextColor(...TEXTO);
            doc.text(val, x + 2, y + rowH / 2 + 1.5, { maxWidth: cw - 3 });
        }

        x += cw;
    });

    doc.setTextColor(...TEXTO);
    return y + rowH;
}

// ── Sección título ──────────────────────────────────────────────────────────────
function sectionTitle(doc, y, label, color = AZUL) {
    doc.setFillColor(...color);
    doc.rect(PAD, y, CW, 6.5, "F");
    doc.setTextColor(...BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(c(label).toUpperCase(), PAD + 3, y + 4.5);
    doc.setTextColor(...TEXTO);
    return y + 6.5;
}

// ── Resumen de jornada ─────────────────────────────────────────────────────────
function drawResumen(doc, y, items) {
    y = sectionTitle(doc, y, "Resumen de Jornada", AZUL);
    const cols  = Math.min(items.length, 9);
    const cellW = CW / cols;
    items.forEach((item, i) => {
        const x = PAD + i * cellW;
        doc.setFillColor(235, 241, 255);
        doc.rect(x, y, cellW, 13, "F");
        doc.setDrawColor(190, 205, 235);
        doc.rect(x, y, cellW, 13, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...AZUL);
        doc.text(String(item.val || "0"), x + cellW / 2, y + 7, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(...MUTED);
        doc.text(c(item.label), x + cellW / 2, y + 11.5, { align: "center" });
    });
    return y + 13;
}

// ── Footer de página ───────────────────────────────────────────────────────────
function drawFooters(doc, jornadaID, fecha) {
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFillColor(...AZUL);
        doc.rect(0, 290, W, 7, "F");
        doc.setTextColor(...BLANCO);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        const ts = new Date().toLocaleString("es-AR");
        doc.text(
            `CyranoApp - Generado: ${ts} - Jornada ${jornadaID || ""}  |  Pag. ${p}/${total}`,
            W / 2, 294.5, { align: "center" }
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERADOR PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export function generarPDFJornada(j, empresaNombre = "Brinks", logoBase64 = null) {
    const doc  = new jsPDF({ unit: "mm", format: "a4" });
    const acts = j.actividades || [];
    const km   = Math.max(0, Number(j.kmFinal || 0) - Number(j.kmInicial || 0));

    // ── Calcular tiempos por categoría ────────────────────────────────────────
    const minCtrl     = acts.filter(a => a.tipo === "ctrl")     .reduce((s, a) => s + diffMin(a.horaInicio || a.inicio, a.horaFin || a.fin), 0);
    const minTraslado = acts.filter(a => a.tipo === "traslado") .reduce((s, a) => s + diffMin(a.horaInicio || a.inicio, a.horaFin || a.fin) + Number(a.duracionMin || 0), 0);
    const minAdmin    = acts.filter(a => a.tipo === "admin")    .reduce((s, a) => s + diffMin(a.horaInicio || a.inicio, a.horaFin || a.fin) + Number(a.duracionMin || 0), 0);
    const minCap      = acts.filter(a => a.tipo === "cap")      .reduce((s, a) => s + Number(a.duracion || 0) + diffMin(a.horaInicio || a.inicio, a.horaFin || a.fin), 0);
    const minTotal    = diffMin(j.horaInicio, j.horaFin);

    // ── Contadores ────────────────────────────────────────────────────────────
    const noCtrls    = acts.filter(a => a.tipo === "ctrl").length;
    const noCaps     = acts.filter(a => a.tipo === "cap").length;
    const noOtras    = acts.filter(a => a.tipo !== "ctrl" && a.tipo !== "cap").length;
    const noNocturno = acts.filter(a => a.tipo === "ctrl" && (a.turno === "nocturno" || a.esNocturno)).length;
    const noFdS      = acts.filter(a => a.tipo === "ctrl" && (a.esFinDeSemana || a.esFds)).length;
    const noAnom     = acts.filter(a => a.tipo === "ctrl" && (a.anomalia === "Si" || a.anomalia === "Sí" || a.anomalia === true)).length;

    // ── Construir filas de la tabla ───────────────────────────────────────────
    // Fila sintética de inicio
    const rows = [];
    if (j.horaInicio) {
        rows.push({
            tipo:         "inicio",
            objetivo:     "—",
            entrada:      j.horaInicio,
            salida:       "",
            vigilador:    "—",
            pag:          "",
            anomalia:     "",
            calificacion: "",
            obs:          "Inicio del servicio del dia de la fecha",
            rowH:         7,
        });
    }

    // Actividades ordenadas cronológicamente
    const actsOrdenadas = [...acts].sort((a, b) => {
        const ta = parseTimeMin(a.horaInicio || a.inicio || "");
        const tb = parseTimeMin(b.horaInicio || b.inicio || "");
        return (ta === -1 ? 9999 : ta) - (tb === -1 ? 9999 : tb);
    });

    actsOrdenadas.forEach(a => {
        if (a.tipo === "ctrl") {
            const label = califLabel(a.ratings);
            const scores = califScores(a.ratings);
            const infoAnomalia = a.informeAnomalia || a.novedad || "";
            const obsText = [scores, infoAnomalia].filter(Boolean).join("  |  ");
            rows.push({
                tipo:         "ctrl",
                objetivo:     c(a.objetivo || a.puesto || ""),
                entrada:      c(a.horaInicio || a.inicio || ""),
                salida:       c(a.horaFin   || a.fin    || ""),
                vigilador:    c(a.vigilador  || ""),
                pag:          c(a.paginaLibro || ""),
                anomalia:     (a.anomalia === "Si" || a.anomalia === "Sí" || a.anomalia === true) ? "SI" : "",
                calificacion: label ? c(label) : "",
                obs:          c(obsText || a.observacion || ""),
                rowH:         (scores || label) ? 9 : 7,
            });
        } else if (a.tipo === "cap") {
            const obs = [
                a.tema || a.descripcion || "",
                a.cantPersonas ? `${a.cantPersonas} pers.` : "",
                a.detalle || "",
            ].filter(Boolean).join("  |  ");
            rows.push({
                tipo:         "cap",
                objetivo:     "—",
                entrada:      c(a.horaInicio || a.inicio || ""),
                salida:       c(a.horaFin   || a.fin    || (a.duracion ? `(${a.duracion}min)` : "")),
                vigilador:    "—",
                pag:          "",
                anomalia:     "",
                calificacion: "",
                obs:          c(obs || a.tema || ""),
                rowH:         7,
            });
        } else if (a.tipo === "traslado") {
            rows.push({
                tipo:         "traslado",
                objetivo:     "—",
                entrada:      c(a.horaInicio || a.inicio || ""),
                salida:       c(a.horaFin   || a.fin    || ""),
                vigilador:    "—",
                pag:          "",
                anomalia:     "",
                calificacion: "",
                obs:          c(a.descripcion || a.detalle || a.actividad || ""),
                rowH:         7,
            });
        } else {
            const obs = [a.actividad || "", a.descripcion || a.detalle || ""].filter(Boolean).join(" — ");
            rows.push({
                tipo:         a.tipo || "otras",
                objetivo:     "—",
                entrada:      c(a.horaInicio || a.inicio || ""),
                salida:       c(a.horaFin   || a.fin    || ""),
                vigilador:    "—",
                pag:          "",
                anomalia:     "",
                calificacion: "",
                obs:          c(obs),
                rowH:         7,
            });
        }
    });

    // Fila sintética de fin
    if (j.horaFin) {
        rows.push({
            tipo:         "fin",
            objetivo:     "—",
            entrada:      j.horaFin,
            salida:       "",
            vigilador:    "—",
            pag:          "",
            anomalia:     "",
            calificacion: "",
            obs:          "Cierre de jornada",
            rowH:         7,
        });
    }

    // ── RENDER ─────────────────────────────────────────────────────────────────
    drawPageHeader(doc, empresaNombre, logoBase64, j.fecha);
    let y = 32;

    // ── Fila 1: Supervisor | Fecha | Vehículo | Km Inicio | Km Final | Total Km ──
    const cw6 = CW / 6;
    infoCell(doc, PAD,             y, cw6 * 2, 13, "Supervisor",  j.nombre    || j.email || "--", true);
    infoCell(doc, PAD + cw6 * 2,   y, cw6,     13, "Fecha",       j.fecha     || "--");
    infoCell(doc, PAD + cw6 * 3,   y, cw6,     13, "Vehiculo",    j.vehiculo  || "--");
    infoCell(doc, PAD + cw6 * 4,   y, cw6 / 2, 13, "Km Inicio",  j.kmInicial || "--");
    infoCell(doc, PAD + cw6 * 4 + cw6/2, y, cw6 / 2, 13, "Km Final", j.kmFinal || "--");
    y += 13;

    // ── Fila 2: Hora ini | Hora fin | Total Hs | Hs Trasl. | Hs Sup. | Hs Cap. | Hs Admin. | Total Km ──
    const cw7 = CW / 8;
    infoCell(doc, PAD,             y, cw7,    13, "Hora inicio",  j.horaInicio || "--");
    infoCell(doc, PAD + cw7,       y, cw7,    13, "Hora fin",     j.horaFin    || "--");
    infoCell(doc, PAD + cw7 * 2,   y, cw7,    13, "Total Horas",  fmtHHMM(minTotal) + " Hs");
    infoCell(doc, PAD + cw7 * 3,   y, cw7,    13, "Hs Traslados", fmtHHMM(minTraslado) + " Hs");
    infoCell(doc, PAD + cw7 * 4,   y, cw7,    13, "Hs Supervision", fmtHHMM(minCtrl) + " Hs");
    infoCell(doc, PAD + cw7 * 5,   y, cw7,    13, "Hs Apoyo/Cap.", fmtHHMM(minCap) + " Hs");
    infoCell(doc, PAD + cw7 * 6,   y, cw7,    13, "Hs Admin.",    fmtHHMM(minAdmin) + " Hs");
    infoCell(doc, PAD + cw7 * 7,   y, cw7,    13, "Total Km",     km > 0 ? km + " km" : "--");
    y += 15;

    // ── Tabla de actividades ──────────────────────────────────────────────────
    y = sectionTitle(doc, y, `Detalle de actividades (${rows.filter(r => r.tipo !== "inicio" && r.tipo !== "fin").length} registros)`, [20, 50, 110]);
    y = drawTableHeader(doc, y);

    rows.forEach((row, i) => {
        const neededH = row.rowH || 7;
        // Espacio para la fila + al menos el resumen (40mm) en la misma página
        if (y + neededH + 40 > 285) {
            doc.addPage();
            drawPageHeader(doc, empresaNombre, logoBase64, j.fecha);
            y = 32;
            y = drawTableHeader(doc, y);
        }
        y = drawActivityRow(doc, y, row, i % 2 === 1);
    });

    y += 4;

    // ── Anomalías destacadas ──────────────────────────────────────────────────
    const anomalias = acts.filter(a => a.tipo === "ctrl" && (a.anomalia === "Si" || a.anomalia === "Sí" || a.anomalia === true));
    if (anomalias.length > 0) {
        if (y + 30 > 260) { doc.addPage(); drawPageHeader(doc, empresaNombre, logoBase64, j.fecha); y = 32; }
        y = sectionTitle(doc, y, `Anomalias detectadas (${anomalias.length})`, [190, 25, 25]);
        anomalias.forEach((a, i) => {
            if (y + 14 > 270) { doc.addPage(); drawPageHeader(doc, empresaNombre, logoBase64, j.fecha); y = 32; }
            doc.setFillColor(255, 242, 242);
            doc.rect(PAD, y, CW, 13, "F");
            doc.setDrawColor(220, 150, 150);
            doc.rect(PAD, y, CW, 13, "S");
            // Borde izquierdo rojo
            doc.setFillColor(220, 38, 38);
            doc.rect(PAD, y, 3, 13, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(180, 0, 0);
            doc.text(c(a.objetivo || a.puesto || "--"), PAD + 6, y + 5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...TEXTO);
            const desc = c(a.informeAnomalia || a.novedad || a.observacion || "Sin descripcion");
            doc.text(desc, PAD + 6, y + 10, { maxWidth: CW - 10 });
            y += 15;
        });
        y += 2;
    }

    // ── Novedades generales ───────────────────────────────────────────────────
    const novedades = j.novedades || j.observaciones || j.novedad;
    if (novedades) {
        if (y + 28 > 260) { doc.addPage(); drawPageHeader(doc, empresaNombre, logoBase64, j.fecha); y = 32; }
        y = sectionTitle(doc, y, "Novedades / Observaciones generales", [140, 100, 0]);
        doc.setFillColor(255, 251, 230);
        doc.rect(PAD, y, CW, 18, "F");
        doc.setDrawColor(220, 180, 80);
        doc.rect(PAD, y, CW, 18, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXTO);
        doc.text(c(novedades), PAD + 3, y + 7, { maxWidth: CW - 6 });
        y += 22;
    }

    // ── Resumen de jornada ────────────────────────────────────────────────────
    if (y + 25 > 272) { doc.addPage(); drawPageHeader(doc, empresaNombre, logoBase64, j.fecha); y = 32; }
    y += 4;
    drawResumen(doc, y, [
        { val: noCtrls,              label: "Controles"       },
        { val: noCaps,               label: "Capacitaciones"  },
        { val: noOtras,              label: "Otras act."      },
        { val: fmtHHMM(minCtrl),    label: "Hs Supervision"  },
        { val: fmtHHMM(minTraslado),label: "Hs Traslados"    },
        { val: fmtHHMM(minAdmin),   label: "Hs Admin."       },
        { val: km > 0 ? km + " km" : "—", label: "Km recorridos" },
        { val: noNocturno,           label: "Nocturnos"       },
        { val: noFdS,                label: "Fin de semana"   },
    ]);

    // ── Footers ───────────────────────────────────────────────────────────────
    drawFooters(doc, j.jornadaID, j.fecha);

    // ── Guardar ───────────────────────────────────────────────────────────────
    const nombre = c(j.nombre || "supervisor").split(" ").slice(0, 2).join("_");
    const fecha  = String(j.fecha || "").replace(/\//g, "_");
    doc.save(`HojaSupervision_${nombre}_${fecha}_${j.jornadaID || "J"}.pdf`);
}

// ── Descarga múltiple ─────────────────────────────────────────────────────────
export function generarPDFMultiple(jornadas, empresaNombre = "Brinks", logoBase64 = null) {
    if (!jornadas?.length) return;
    jornadas.forEach(j => generarPDFJornada(j, empresaNombre, logoBase64));
}
