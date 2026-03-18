// src/utils/generarPDFJornada.js
import { jsPDF } from "jspdf";

const AZUL  = [0, 45, 114];
const ROJO  = [226, 1, 19];
const GRIS  = [240, 242, 248];
const TEXTO = [13, 27, 62];
const MUTED = [136, 148, 172];
const W     = 210;
const PAD   = 14;

function diffMinutes(ini, fin) {
    if (!ini || !fin) return 0;
    try {
        const clean = s => s.replace(/[ap]\. ?m\./i, "").trim();
        const [h1, m1] = clean(ini).split(":").map(Number);
        const [h2, m2] = clean(fin).split(":").map(Number);
        if (isNaN(h1) || isNaN(h2)) return 0;
        const t1 = h1 * 60 + (m1 || 0), t2 = h2 * 60 + (m2 || 0);
        return t2 >= t1 ? t2 - t1 : 0;
    } catch { return 0; }
}

function fmtMin(m) {
    if (!m || m <= 0) return "--";
    const h = Math.floor(m / 60), min = m % 60;
    return h > 0 ? `${h}h ${min > 0 ? min + "m" : ""}`.trim() : `${min}m`;
}

// ── Header de página ──────────────────────────────────────────────────────────
function drawHeader(doc, empresaNombre, logoBase64) {
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, W, 28, "F");
    doc.setFillColor(...ROJO);
    doc.rect(0, 28, W, 2, "F");

    // Logo empresa — respetando proporción, altura máx 20mm
    let logoW = 0;
    if (logoBase64) {
        try {
            const fmt  = logoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
            const props = doc.getImageProperties(logoBase64);
            const maxH  = 20, maxW = 32;
            const ratio = props.width / props.height;
            let iw = maxH * ratio, ih = maxH;
            if (iw > maxW) { iw = maxW; ih = iw / ratio; }
            const iy = 4 + (maxH - ih) / 2;   // centrar verticalmente
            doc.addImage(logoBase64, fmt, PAD, iy, iw, ih);
            logoW = iw + 4;
        } catch { /* sin logo */ }
    }

    const textX = PAD + logoW;
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("HOJA DE SUPERVISION", textX, 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(empresaNombre || "CyranoApp", textX, 19);
    doc.setFontSize(7.5);
    doc.text("CyranoApp - Sistema de Gestion de Seguridad", W - PAD, 12, { align: "right" });
    doc.setTextColor(...TEXTO);
}

// ── Celda de info ─────────────────────────────────────────────────────────────
function infoCell(doc, x, y, w, label, value) {
    doc.setFillColor(...GRIS);
    doc.rect(x, y, w, 14, "F");
    doc.setDrawColor(210, 213, 222);
    doc.rect(x, y, w, 14, "S");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "bold");
    const val = String(value || "--").substring(0, 28);
    doc.text(val, x + 3, y + 11);
}

// ── Resumen en celdas (reemplaza la línea de texto con chars especiales) ───────
function resumenCells(doc, y, items) {
    const totalW = W - PAD * 2;
    const cw = totalW / items.length;
    items.forEach((item, i) => {
        const x = PAD + i * cw;
        doc.setFillColor(235, 240, 255);
        doc.rect(x, y, cw, 10, "F");
        doc.setDrawColor(210, 218, 235);
        doc.rect(x, y, cw, 10, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...AZUL);
        doc.text(String(item.val), x + cw / 2, y + 5.5, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text(item.label, x + cw / 2, y + 9, { align: "center" });
    });
    return y + 10;
}

// ── Título de sección ─────────────────────────────────────────────────────────
function sectionTitle(doc, y, label, color = AZUL) {
    doc.setFillColor(...color);
    doc.rect(PAD, y, W - PAD * 2, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), PAD + 3, y + 5);
    doc.setTextColor(...TEXTO);
    return y + 7;
}

// ── Fila de tabla ─────────────────────────────────────────────────────────────
function tableRow(doc, y, cols, isHeader = false, alt = false) {
    const totalW = W - PAD * 2;
    let x = PAD;
    if (isHeader) {
        doc.setFillColor(30, 60, 130);
        doc.rect(PAD, y, totalW, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
    } else {
        if (alt) { doc.setFillColor(248, 249, 252); doc.rect(PAD, y, totalW, 7, "F"); }
        doc.setDrawColor(225, 228, 235);
        doc.line(PAD, y + 7, PAD + totalW, y + 7);
        doc.setTextColor(...TEXTO);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
    }
    cols.forEach(({ text, w }) => {
        const tw = w * totalW;
        const safe = String(text || "--").replace(/[^\x00-\x7F]/g, "");
        doc.text(safe, x + 2, y + (isHeader ? 4.5 : 5), { maxWidth: tw - 4 });
        x += tw;
    });
    return y + (isHeader ? 6 : 7);
}

// ── Definición de categorías (igual que el modal) ─────────────────────────────
const CATS_PDF = [
    { tipo:"ctrl",     label:"Controles",       color: AZUL,            hdr:[30,60,130]  },
    { tipo:"cap",      label:"Capacitaciones",   color:[100,40,200],     hdr:[80,30,170]  },
    { tipo:"traslado", label:"Traslados",         color:[3,105,161],      hdr:[3,85,130]   },
    { tipo:"admin",    label:"Administrativo",    color:[55,65,81],       hdr:[50,60,75]   },
    { tipo:"vulnerab", label:"Vuln./Riesgos",     color:[180,83,9],       hdr:[160,70,5]   },
    { tipo:"reclamos", label:"Reclamos",           color:[220,38,38],      hdr:[190,20,20]  },
    { tipo:"almuerzo", label:"Almuerzo/Cena",     color:[21,128,61],      hdr:[15,100,45]  },
    { tipo:"taller",   label:"Taller/Rep.",       color:[107,114,128],    hdr:[80,88,100]  },
    { tipo:"gremial",  label:"Gremial",           color:[109,40,217],     hdr:[90,30,190]  },
    { tipo:"otras",    label:"Otras actividades", color:[107,114,128],    hdr:[80,88,100]  },
];

function calcMin(a) {
    if (a.tipo === "cap") return Number(a.duracion) || 0;
    return diffMinutes(a.inicio||a.horaInicio, a.fin||a.horaFin) + Number(a.duracionMin || 0);
}

// ── GENERADOR PRINCIPAL ───────────────────────────────────────────────────────
export function generarPDFJornada(j, empresaNombre = "Brinks", logoBase64 = null) {
    const doc       = new jsPDF({ unit: "mm", format: "a4" });
    const km        = Math.max(0, Number(j.kmFinal || 0) - Number(j.kmInicial || 0));
    const acts      = j.actividades || [];
    const ctrls     = acts.filter(a => a.tipo === "ctrl");
    const anomalias = ctrls.filter(c => c.anomalia === "Si" || c.anomalia === true || c.anomalia === "Sí");

    // Datos por categoría (solo las que tienen ítems)
    const catData = CATS_PDF.map(cat => ({
        ...cat,
        items:    acts.filter(a => a.tipo === cat.tipo),
        totalMin: acts.filter(a => a.tipo === cat.tipo).reduce((s, a) => s + calcMin(a), 0),
    })).filter(c => c.items.length > 0);

    drawHeader(doc, empresaNombre, logoBase64);
    let y = 36;

    // ── Fila 1: Supervisor / Fecha / ID ─────────────────────────────────────
    const cw  = (W - PAD * 2) / 4;
    const cw2 = (W - PAD * 2) / 2;
    infoCell(doc, PAD,            y, cw2, "Supervisor",  j.nombre    || "--");
    infoCell(doc, PAD + cw2,      y, cw,  "Fecha",       j.fecha     || "--");
    infoCell(doc, PAD + cw2 + cw, y, cw,  "Jornada ID",  j.jornadaID || "--");
    y += 14;

    // ── Fila 2: Vehículo / Km / Hora ini / Hora fin ──────────────────────────
    infoCell(doc, PAD,           y, cw, "Vehiculo",      j.vehiculo    || "--");
    infoCell(doc, PAD + cw,      y, cw, "Km recorridos", km > 0 ? km + " km" : "--");
    infoCell(doc, PAD + cw * 2,  y, cw, "Hora inicio",   j.horaInicio  || "--");
    infoCell(doc, PAD + cw * 3,  y, cw, "Hora fin",      j.horaFin     || "--");
    y += 14;

    // ── Fila 3: Km ini / Km fin / Km netos / Anomalías ──────────────────────
    infoCell(doc, PAD,           y, cw, "Km inicial",  j.kmInicial || "--");
    infoCell(doc, PAD + cw,      y, cw, "Km final",    j.kmFinal   || "--");
    infoCell(doc, PAD + cw * 2,  y, cw, "Km netos",    km > 0 ? km + " km" : "--");
    infoCell(doc, PAD + cw * 3,  y, cw, "Anomalias",   anomalias.length > 0 ? anomalias.length + " DETECTADAS" : "Sin anomalias");
    y += 16;

    // ── Resumen visual por categoría (solo las presentes) ────────────────────
    if (catData.length > 0) {
        const items = catData.map(c => ({
            label: c.label,
            val:   `${c.items.length} (${fmtMin(c.totalMin)})`,
        }));
        // Mostrar en filas de 4 si hay más de 4 categorías
        const cols = Math.min(items.length, 4);
        const rows = [];
        for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
        rows.forEach(row => {
            // Pad to cols
            while (row.length < cols) row.push({ label: "", val: "" });
            y = resumenCells(doc, y, row);
        });
    }
    y += 5;

    // ── Secciones por categoría ───────────────────────────────────────────────
    catData.forEach(cat => {
        if (y > 252) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
        const titleStr = `${cat.label} (${cat.items.length})  -  Tiempo total: ${fmtMin(cat.totalMin)}`;
        y = sectionTitle(doc, y, titleStr, cat.hdr);

        if (cat.tipo === "ctrl") {
            // ── Controles: Objetivo / Hora ini / Hora fin / Duración / Anomalía / Obs ──
            y = tableRow(doc, y, [
                { text: "Objetivo / Puesto",  w: 0.38 },
                { text: "Hora ini",           w: 0.13 },
                { text: "Hora fin",           w: 0.13 },
                { text: "Duracion",           w: 0.12 },
                { text: "Anomalia",           w: 0.11 },
                { text: "Observacion",        w: 0.13 },
            ], true);
            cat.items.forEach((c, i) => {
                if (y > 272) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
                const dur  = diffMinutes(c.inicio || c.horaInicio, c.fin || c.horaFin);
                const anom = (c.anomalia === "Si" || c.anomalia === true || c.anomalia === "Si") ? "SI" : "No";
                y = tableRow(doc, y, [
                    { text: c.objetivo || c.puesto || "--",     w: 0.38 },
                    { text: c.inicio || c.horaInicio || "--",   w: 0.13 },
                    { text: c.fin    || c.horaFin    || "--",   w: 0.13 },
                    { text: fmtMin(dur),                         w: 0.12 },
                    { text: anom,                                 w: 0.11 },
                    { text: c.observacion || c.novedad || "--", w: 0.13 },
                ], false, i % 2 === 1);
            });

        } else if (cat.tipo === "cap") {
            // ── Capacitaciones: Tema / Duración / Participantes / Descripción ────────
            y = tableRow(doc, y, [
                { text: "Tema",           w: 0.40 },
                { text: "Duracion",       w: 0.15 },
                { text: "Participantes",  w: 0.15 },
                { text: "Descripcion",    w: 0.30 },
            ], true);
            cat.items.forEach((c, i) => {
                if (y > 272) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
                y = tableRow(doc, y, [
                    { text: c.tema || c.descripcion || "--",           w: 0.40 },
                    { text: c.duracion ? c.duracion + " min" : "--",   w: 0.15 },
                    { text: c.cantPersonas || "--",                     w: 0.15 },
                    { text: c.detalle || c.descripcion || "--",         w: 0.30 },
                ], false, i % 2 === 1);
            });

        } else {
            // ── Actividades genéricas: Actividad / Descripción / Hora ini / Hora fin / Duración
            y = tableRow(doc, y, [
                { text: "Actividad",    w: 0.28 },
                { text: "Descripcion",  w: 0.34 },
                { text: "Hora ini",     w: 0.13 },
                { text: "Hora fin",     w: 0.13 },
                { text: "Duracion",     w: 0.12 },
            ], true);
            cat.items.forEach((a, i) => {
                if (y > 272) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
                const dur = calcMin(a);
                y = tableRow(doc, y, [
                    { text: a.actividad || a.tipo || "--",         w: 0.28 },
                    { text: a.descripcion || a.detalle || "--",    w: 0.34 },
                    { text: a.inicio || a.horaInicio || "--",      w: 0.13 },
                    { text: a.fin    || a.horaFin    || "--",      w: 0.13 },
                    { text: fmtMin(dur),                            w: 0.12 },
                ], false, i % 2 === 1);
            });
        }
        y += 4;
    });

    // ── Novedades ────────────────────────────────────────────────────────────
    const novedades = j.novedades || j.observaciones || j.novedad;
    if (novedades) {
        if (y > 252) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
        y = sectionTitle(doc, y, "Novedades / Observaciones", [160, 100, 0]);
        doc.setFillColor(255, 251, 230);
        doc.rect(PAD, y, W - PAD * 2, 18, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXTO);
        const safe = novedades.replace(/[^\x00-\x7F]/g, "");
        doc.text(safe, PAD + 3, y + 6, { maxWidth: W - PAD * 2 - 6 });
        y += 22;
    }

    // ── Anomalías ─────────────────────────────────────────────────────────────
    if (anomalias.length > 0) {
        if (y > 252) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
        y = sectionTitle(doc, y, `Anomalias detectadas (${anomalias.length})`, [200, 30, 30]);
        anomalias.forEach((c, i) => {
            if (y > 272) { doc.addPage(); drawHeader(doc, empresaNombre, logoBase64); y = 36; }
            doc.setFillColor(255, 240, 240);
            doc.rect(PAD, y, W - PAD * 2, 12, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(180, 0, 0);
            const obj = (c.objetivo || c.puesto || "--").replace(/[^\x00-\x7F]/g, "");
            doc.text(obj, PAD + 3, y + 5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...TEXTO);
            doc.setFontSize(7.5);
            const obs = (c.observacion || c.novedad || "Sin descripcion").replace(/[^\x00-\x7F]/g, "");
            doc.text(obs, PAD + 3, y + 10, { maxWidth: W - PAD * 2 - 6 });
            y += 15;
        });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...AZUL);
        doc.rect(0, 291, W, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        const fecha = new Date().toLocaleDateString("es-AR");
        doc.text(`CyranoApp  -  Generado el ${fecha}  -  Pag. ${p}/${totalPages}`, W / 2, 295, { align: "center" });
    }

    const nombre = (j.nombre || "supervisor").split(" ").slice(0, 2).join("_").replace(/[^\x00-\x7F]/g, "");
    const fecha  = (j.fecha || "").replace(/\//g, "-");
    doc.save(`Jornada_${j.jornadaID || "J"}_${nombre}_${fecha}.pdf`);
}

// ── Descarga múltiple ─────────────────────────────────────────────────────────
export function generarPDFMultiple(jornadas, empresaNombre = "Brinks", logoBase64 = null) {
    if (!jornadas?.length) return;
    jornadas.forEach(j => generarPDFJornada(j, empresaNombre, logoBase64));
}
