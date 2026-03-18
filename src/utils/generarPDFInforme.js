// src/utils/generarPDFInforme.js
// Genera PDF del informe sencillo replicando el formato oficial.

import jsPDF from "jspdf";

export function generarPDFInformeSencillo({
    objetivo = "",
    fecha    = "",
    ref      = "",
    cuerpo   = "",
    producidoPor       = "",
    paraConocimientoDe = "",
    empresa  = "",
    logoUrl  = null,
    firma    = null,
}) {
    const doc  = new jsPDF({ unit: "mm", format: "a4" });
    const W    = 210;
    const PAD  = 18;
    const CW   = W - PAD * 2;   // content width
    let y      = 14;

    // ── Logo ────────────────────────────────────────────────────
    let logoW = 0;
    if (logoUrl) {
        try {
            const fmt   = logoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
            const props = doc.getImageProperties(logoUrl);
            const maxH  = 18, maxW = 40;
            const ratio = props.width / props.height;
            let iw = maxH * ratio, ih = maxH;
            if (iw > maxW) { iw = maxW; ih = iw / ratio; }
            const iy = y + (maxH - ih) / 2;
            doc.addImage(logoUrl, fmt, PAD, iy, iw, ih);
            logoW = iw + 4;
        } catch (_) {}
    }

    // ── Título ──────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 30, 80);
    doc.text("I N F O R M E", W / 2, y + 10, { align: "center" });

    if (empresa) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 160);
        doc.text(empresa, W / 2, y + 17, { align: "center" });
    }
    y += 26;

    // Separador
    doc.setDrawColor(180, 180, 220);
    doc.setLineWidth(0.4);
    doc.line(PAD, y, W - PAD, y);
    y += 6;

    // ── Tabla Objetivo / Fecha ───────────────────────────────────
    const c1 = CW * 0.65;
    const c2 = CW * 0.35;

    doc.setFillColor(238, 240, 255);
    doc.roundedRect(PAD,      y, c1 - 2, 15, 2, 2, "F");
    doc.roundedRect(PAD + c1, y, c2,     15, 2, 2, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 150);
    doc.text("Objetivo:",  PAD + 3,      y + 5);
    doc.text("Fecha:",     PAD + c1 + 3, y + 5);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 60);
    const objLines = doc.splitTextToSize(objetivo, c1 - 8);
    doc.text(objLines[0] || "", PAD + 3, y + 11);
    doc.text(fecha,             PAD + c1 + 3, y + 11);
    y += 19;

    // ── REF ──────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 130);
    doc.text("REF:", PAD, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 60);
    doc.text(ref, PAD + 14, y);
    y += 8;

    doc.setDrawColor(210, 210, 235);
    doc.line(PAD, y, W - PAD, y);
    y += 7;

    // ── Cuerpo ───────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 60);
    const bodyLines = doc.splitTextToSize(cuerpo, CW);

    // ¿entra en esta página?
    const lineH      = 6;
    const bodyHeight = bodyLines.length * lineH;
    const remaining  = 297 - 25 - y;  // A4 height - footer - current y

    if (bodyHeight > remaining - 40) {
        // puede necesitar salto de página a mitad
        let lineY = y;
        for (const line of bodyLines) {
            if (lineY > 270) {
                doc.addPage();
                lineY = 20;
            }
            doc.text(line, PAD, lineY);
            lineY += lineH;
        }
        y = lineY + 6;
    } else {
        doc.text(bodyLines, PAD, y);
        y += bodyHeight + 8;
    }

    // si estamos muy abajo, nueva página para el footer del informe
    if (y > 240) { doc.addPage(); y = 20; }

    // ── Separador ────────────────────────────────────────────────
    doc.setDrawColor(210, 210, 235);
    doc.line(PAD, y, W - PAD, y);
    y += 6;

    // ── Producido por / Para conocimiento de ────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 150);
    doc.text("Producido por:",        PAD,      y);
    doc.text("Para conocimiento de:", PAD + c1, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 60);
    doc.text(producidoPor,       PAD,      y + 7);
    doc.text(paraConocimientoDe, PAD + c1, y + 7);
    y += 18;

    // ── Firma ────────────────────────────────────────────────────
    if (firma) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 150);
        doc.text("Firma:", PAD, y);
        y += 3;

        try {
            doc.addImage(firma, "PNG", PAD, y, 80, 20);
            y += 22;
        } catch (_) { y += 4; }

        doc.setDrawColor(80, 80, 180);
        doc.setLineWidth(0.5);
        doc.line(PAD, y, PAD + 80, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 140);
        doc.text(producidoPor, PAD, y + 5);
    }

    // ── Footer por página ────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(170, 170, 195);
        doc.text(`Pág. ${i} / ${totalPages}`, W - PAD, 290, { align: "right" });
        if (empresa) doc.text(empresa, PAD, 290);
    }

    // ── Guardar ──────────────────────────────────────────────────
    const slug = ref.replace(/\s+/g, "_").slice(0, 30) || "informe";
    doc.save(`Informe_${slug}_${fecha}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Informe de Novedad
// ─────────────────────────────────────────────────────────────────────────────
export function generarPDFInformeNovedad({
    datos = {},
    hechoDenunciado = "",
    cronologia = [],
    quienDetecta = "",
    acciones = [],
    personal = [],
    servicioComp = "",
    consignasInc = null,
    consignasDetalle = "",
    comisaria = "",
    fechaDenuncia = "",
    reclamos = "",
    comentarios = "",
    producidoPor = "",
    empresa = "",
    logoUrl = null,
    firma = null,
}) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, PAD = 15, CW = W - PAD * 2;
    let y = 14;

    const addPage = () => { doc.addPage(); y = 16; };
    const checkY = (needed = 20) => { if (y + needed > 280) addPage(); };

    // ── Logo ──────────────────────────────────────────────────
    if (logoUrl) {
        try {
            const fmt = logoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
            const props = doc.getImageProperties(logoUrl);
            const maxH = 16, maxW = 36;
            const ratio = props.width / props.height;
            let iw = maxH * ratio, ih = maxH;
            if (iw > maxW) { iw = maxW; ih = iw / ratio; }
            doc.addImage(logoUrl, fmt, PAD, y, iw, ih);
        } catch (_) {}
    }

    // ── Título ────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(180, 20, 20);
    doc.text("INFORME DE NOVEDAD", W / 2, y + 9, { align: "center" });
    if (empresa) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.setTextColor(120, 120, 160);
        doc.text(empresa, W / 2, y + 16, { align: "center" });
    }
    y += 24;

    doc.setDrawColor(200, 30, 30); doc.setLineWidth(0.5);
    doc.line(PAD, y, W - PAD, y); y += 6;

    // Helper: section title
    const sectionTitle = (title) => {
        checkY(12);
        doc.setFillColor(245, 240, 240);
        doc.rect(PAD, y, CW, 8, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.setTextColor(150, 20, 20);
        doc.text(title.toUpperCase(), PAD + 3, y + 5.5);
        y += 11;
    };

    // Helper: label + value row
    const labelVal = (label, val, x = PAD, w = CW) => {
        checkY(10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 100, 140);
        doc.text(label + ":", x, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 60);
        const lines = doc.splitTextToSize(val || "—", w - 30);
        doc.text(lines, x + 28, y);
        y += lines.length * 5.5 + 3;
    };

    // Helper: two column row
    const row2 = (l1, v1, l2, v2) => {
        checkY(10);
        const hw = CW / 2 - 3;
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 100, 140);
        doc.text(l1 + ":", PAD, y);
        doc.text(l2 + ":", PAD + CW / 2, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 60);
        doc.text(doc.splitTextToSize(v1 || "—", hw - 26)[0], PAD + 26, y);
        doc.text(doc.splitTextToSize(v2 || "—", hw - 26)[0], PAD + CW / 2 + 26, y);
        y += 8;
    };

    // Helper: multiline text block
    const textBlock = (label, text) => {
        if (!text) return;
        checkY(14);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 100, 140);
        doc.text(label + ":", PAD, y); y += 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 60);
        const lines = doc.splitTextToSize(text, CW);
        for (const line of lines) {
            checkY(6);
            doc.text(line, PAD + 3, y); y += 5.5;
        }
        y += 3;
    };

    // ── 1. Datos generales ────────────────────────────────────
    sectionTitle("1. Datos generales");
    row2("Cliente", datos.cliente, "Fecha", datos.fecha);
    row2("Servicio", datos.servicio, "Puesto", datos.puesto);
    row2("Dirección", datos.direccion, "Teléfono", datos.telefono);
    row2("Referente", datos.referente, "Cargo", datos.cargo);
    y += 3;

    // ── 2. Incidente ──────────────────────────────────────────
    sectionTitle("2. Incidente");
    textBlock("Hecho denunciado", hechoDenunciado);

    // Cronología
    if (cronologia.length > 0) {
        checkY(14);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 100, 140);
        doc.text("Relación cronológica:", PAD, y); y += 5;
        // header
        doc.setFillColor(240, 240, 250);
        doc.rect(PAD, y, CW, 6, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(80, 80, 130);
        doc.text("Fecha",  PAD + 2, y + 4);
        doc.text("Hora",   PAD + 34, y + 4);
        doc.text("Hechos", PAD + 60, y + 4);
        y += 7;
        for (const row of cronologia) {
            if (!row.fecha && !row.hora && !row.hechos) continue;
            checkY(8);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 60);
            doc.text(row.fecha || "", PAD + 2, y);
            doc.text(row.hora  || "", PAD + 34, y);
            const hl = doc.splitTextToSize(row.hechos || "", CW - 62);
            doc.text(hl[0] || "", PAD + 60, y);
            if (hl.length > 1) { y += 5; doc.text(hl[1], PAD + 60, y); }
            doc.setDrawColor(220, 220, 235); doc.setLineWidth(0.2);
            doc.line(PAD, y + 2, W - PAD, y + 2);
            y += 7;
        }
        y += 3;
    }

    // ── 3. Detección ──────────────────────────────────────────
    sectionTitle("3. Detección de la novedad");
    textBlock("¿Quién detecta?", quienDetecta);

    // ── 4. Acciones BSC ───────────────────────────────────────
    sectionTitle("4. Acciones inmediatas (BSC)");
    if (acciones.length > 0) {
        checkY(14);
        doc.setFillColor(240, 240, 250);
        doc.rect(PAD, y, CW, 6, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(80, 80, 130);
        doc.text("Fecha", PAD + 2, y + 4);
        doc.text("Hora",  PAD + 34, y + 4);
        doc.text("Acción tomada", PAD + 60, y + 4);
        y += 7;
        for (const row of acciones) {
            if (!row.fecha && !row.hora && !row.accion) continue;
            checkY(8);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 60);
            doc.text(row.fecha  || "", PAD + 2, y);
            doc.text(row.hora   || "", PAD + 34, y);
            const al = doc.splitTextToSize(row.accion || "", CW - 62);
            doc.text(al[0] || "", PAD + 60, y);
            if (al.length > 1) { y += 5; doc.text(al[1], PAD + 60, y); }
            doc.setDrawColor(220, 220, 235); doc.setLineWidth(0.2);
            doc.line(PAD, y + 2, W - PAD, y + 2);
            y += 7;
        }
        y += 3;
    }

    // ── 5. Personal involucrado ───────────────────────────────
    sectionTitle("5. Personal involucrado");
    const personasConDatos = personal.filter(p => p.nombre);
    if (personasConDatos.length === 0) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text("No se registró personal involucrado.", PAD + 3, y); y += 8;
    } else {
        for (const p of personasConDatos) {
            checkY(16);
            row2("Nombre", p.nombre, "Cargo", p.cargo);
            row2("Teléfono", p.telefono, "Empresa", p.empresa);
            doc.setDrawColor(220, 220, 235); doc.setLineWidth(0.2);
            doc.line(PAD, y, W - PAD, y); y += 4;
        }
    }

    // ── 6. Servicio de seguridad ──────────────────────────────
    sectionTitle("6. Servicio de seguridad");
    textBlock("Servicio compuesto por", servicioComp);
    checkY(8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100, 100, 140);
    doc.text("¿Hay consignas incumplidas?", PAD, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.setTextColor(consignasInc === true ? 180 : 20, consignasInc === true ? 20 : (consignasInc === false ? 100 : 100), 20);
    doc.text(consignasInc === true ? "SÍ" : consignasInc === false ? "NO" : "—", PAD + 72, y);
    y += 8;
    if (consignasInc === true) textBlock("Detalle de consignas incumplidas", consignasDetalle);

    // ── 7. Denuncia policial ──────────────────────────────────
    sectionTitle("7. Denuncia policial");
    row2("Comisaría", comisaria, "Fecha de denuncia", fechaDenuncia);
    y += 3;

    // ── 8. Reclamos y comentarios ─────────────────────────────
    sectionTitle("8. Reclamos y comentarios");
    textBlock("Reclamos del cliente", reclamos);
    textBlock("Comentarios adicionales", comentarios);

    // ── 9. Producido por / Firma ──────────────────────────────
    sectionTitle("9. Firma");
    checkY(30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 100, 140);
    doc.text("Producido por:", PAD, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 60);
    doc.text(producidoPor || "", PAD + 3, y); y += 8;

    if (firma) {
        try { doc.addImage(firma, "PNG", PAD, y, 80, 20); y += 22; } catch (_) { y += 4; }
        doc.setDrawColor(80, 80, 180); doc.setLineWidth(0.5);
        doc.line(PAD, y, PAD + 80, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 140);
        doc.text(producidoPor || "", PAD, y + 5);
    }

    // ── Footer ────────────────────────────────────────────────
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(170, 170, 195);
        doc.text(`Pág. ${i} / ${total}`, W - PAD, 290, { align: "right" });
        if (empresa) doc.text(empresa, PAD, 290);
    }

    const slug = (datos.cliente || "novedad").replace(/\s+/g, "_").slice(0, 30);
    doc.save(`InformeNovedad_${slug}_${datos.fecha || ""}.pdf`);
}
