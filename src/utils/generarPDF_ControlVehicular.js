// src/utils/generarPDF_ControlVehicular.js
// Genera PDF del Control Vehicular Diario usando jsPDF

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

const SECCIONES_LABELS = {
    exterior: "EXTERIOR", interior: "INTERIOR", equipamiento: "EQUIPAMIENTO",
    sistemas: "SISTEMAS", fluidos: "FLUIDOS", documentacion: "DOCUMENTACIÓN", enlace: "PRUEBA DE ENLACE",
};

export async function generarPDFControlVehicular(control) {
    const JsPDF = await cargarJsPDF();
    const doc   = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const W = 210, H = 297, M = 8, CW = W - M * 2;

    const R  = (x, y, w, h, fill) => {
        if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, "F"); }
        else { doc.setDrawColor(190, 200, 220); doc.rect(x, y, w, h, "S"); }
    };
    const T  = (t, x, y, sz, bold, al, color) => {
        doc.setFontSize(sz || 7); doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...(color || [0, 0, 0]));
        doc.text(String(t ?? ""), x, y, { align: al || "left" });
    };
    const L  = (x1, y1, x2, y2, c) => { if (c) doc.setDrawColor(...c); doc.line(x1, y1, x2, y2); };
    const RR = (x, y, w, h, r, fill) => { doc.setFillColor(...fill); doc.roundedRect(x, y, w, h, r, r, "F"); };

    let y = M;

    // ── Franja azul superior ──────────────────────────────────
    R(M, y, CW, 1.2, [0, 48, 135]); y += 1.2;

    // ── Header ───────────────────────────────────────────────
    const HEADER_H = 14;
    R(M, y, CW, HEADER_H, [252, 253, 255]);
    doc.setDrawColor(190, 200, 220); doc.rect(M, y, CW, HEADER_H, "S");

    try {
        const logoData = await loadImage("/images/LogoApp.png");
        if (logoData) {
            const ratio = logoData.w / logoData.h;
            const lh = HEADER_H - 3, lw = Math.min(lh * ratio, 52);
            doc.addImage(logoData.data, "PNG", M + 2, y + 1.5, lw, lh);
        }
    } catch {}

    T("CONTROL VEHICULAR DIARIO", W / 2, y + 6, 13, true, "center", [0, 48, 135]);
    T("Revisión de estado del vehículo antes del servicio", W / 2, y + 10.5, 5, false, "center", [140, 140, 140]);
    T("ID: " + (control.jornadaID || "—"), W - M - 1, y + 10.5, 5, true, "right", [0, 48, 135]);
    y += HEADER_H;

    R(M, y, CW, 0.8, [226, 1, 19]); y += 1.8;

    // ── Datos cabecera ────────────────────────────────────────
    const H5 = 5.5;
    const campo = (lbl, val, x, lw, vw) => {
        doc.setDrawColor(190, 200, 220);
        R(x, y, lw + vw, H5);
        R(x, y, lw, H5, [230, 238, 252]);
        T(lbl, x + 1, y + 3.8, 4.5, true, "left", [0, 48, 135]);
        T(String(val ?? "—"), x + lw + 1, y + 3.8, 5.5);
    };

    campo("Supervisor", control.supervisor || "—", M,       24, 52);
    campo("Vehículo",   control.vehiculo    || "—", M + 76,  14, 44);
    campo("Fecha",      control.fecha       || "—", M + 134, 10, 16);
    campo("Hora",       control.hora        || "—", M + 160, 8,  14);
    y += H5;

    // resultado general
    const sinNov = control.sinNovedad;
    R(M, y, CW, 7, [252, 253, 255]);
    doc.setDrawColor(190, 200, 220); doc.rect(M, y, CW, 7, "S");
    RR(M + 1, y + 0.8, 60, 5.5, 1.5, sinNov ? [240, 255, 245] : [255, 240, 240]);
    T(sinNov ? "✓  SIN NOVEDADES" : "⚠  CON NOVEDADES",
        M + 31, y + 4.2, 7.5, true, "center", sinNov ? [22, 163, 74] : [220, 38, 38]);
    T("Respondidos: " + (control.respondidos || 0) + " ítems  ·  Con novedad: " + (control.conNovedad || 0),
        M + 70, y + 4.2, 5.5, false, "left", [90, 90, 90]);
    y += 7 + 1.5;

    // ── Checklist por sección ─────────────────────────────────
    const checks = control.checks || {};
    const secIds = ["exterior", "interior", "equipamiento", "sistemas", "fluidos", "documentacion", "enlace"];

    // Agrupar items por sección
    const porSeccion = {};
    Object.entries(checks).forEach(([key, val]) => {
        const [secId, ...rest] = key.split("__");
        if (!porSeccion[secId]) porSeccion[secId] = [];
        porSeccion[secId].push({ item: rest.join("__"), val });
    });

    // Layout: 3 columnas para los checks
    const COLS3 = 3;
    const colW  = CW / COLS3;
    const ITEM_H = 4.2;

    secIds.forEach(secId => {
        const items = porSeccion[secId] || [];
        if (!items.length) return;

        const rows   = Math.ceil(items.length / COLS3);
        const secH   = 6 + rows * ITEM_H + 2;

        // ¿Cabe en página?
        if (y + secH > H - M - 10) { doc.addPage(); y = M + 4; }

        // Header sección
        R(M, y, CW, 6, [0, 48, 135]);
        T(SECCIONES_LABELS[secId] || secId.toUpperCase(), M + 3, y + 4.2, 6, true, "left", [255, 255, 255]);
        const cnCount = items.filter(i => i.val === "cn").length;
        if (cnCount > 0) {
            RR(W - M - 22, y + 1, 20, 4, 1.5, [220, 38, 38]);
            T(cnCount + " C/N", W - M - 12, y + 4, 5, true, "center", [255, 255, 255]);
        }
        y += 6;

        // Items en 3 columnas
        for (let row = 0; row < rows; row++) {
            const rowY = y + row * ITEM_H;
            for (let col = 0; col < COLS3; col++) {
                const idx  = row * COLS3 + col;
                if (idx >= items.length) break;
                const { item, val } = items[idx];
                const cx = M + col * colW;
                const bg = val === "sn" ? [240, 255, 245] : val === "cn" ? [255, 240, 240] : [250, 251, 255];
                R(cx, rowY, colW, ITEM_H, bg);
                doc.setDrawColor(210, 218, 235); doc.rect(cx, rowY, colW, ITEM_H, "S");
                T(item, cx + 1.5, rowY + 3, 4.5, false, "left", [30, 40, 70]);
                if (val) {
                    const badge = val === "sn" ? [22, 163, 74] : [220, 38, 38];
                    RR(cx + colW - 11, rowY + 0.7, 9.5, ITEM_H - 1.4, 1, badge);
                    T(val === "sn" ? "S/N" : "C/N", cx + colW - 6.25, rowY + 3, 4.5, true, "center", [255, 255, 255]);
                }
            }
            // Línea horizontal entre filas
            doc.setDrawColor(210, 218, 235);
            doc.line(M, rowY + ITEM_H, M + CW, rowY + ITEM_H);
        }
        y += rows * ITEM_H + 2;
    });

    // ── Novedades ─────────────────────────────────────────────
    if (control.novedades) {
        if (y + 20 > H - M - 10) { doc.addPage(); y = M + 4; }
        R(M, y, CW, 6, [255, 244, 220]);
        doc.setDrawColor(245, 158, 11); doc.rect(M, y, CW, 6, "S");
        T("DETALLE DE NOVEDADES", M + 3, y + 4.2, 6, true, "left", [160, 80, 0]);
        y += 6;
        const lines = doc.splitTextToSize(control.novedades, CW - 4);
        const novH  = lines.length * 5 + 4;
        R(M, y, CW, novH, [255, 252, 245]);
        doc.setDrawColor(245, 158, 11); doc.rect(M, y, CW, novH, "S");
        doc.setFontSize(5.5); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 60, 0);
        doc.text(lines, M + 2, y + 4.5);
        y += novH + 2;
    }

    // ── Fotos ─────────────────────────────────────────────────
    if (control.fotos?.length) {
        if (y + 50 > H - M - 10) { doc.addPage(); y = M + 4; }
        R(M, y, CW, 6, [230, 238, 252]);
        doc.setDrawColor(190, 200, 220); doc.rect(M, y, CW, 6, "S");
        T("EVIDENCIA FOTOGRÁFICA (" + control.fotos.length + " foto/s)", M + 3, y + 4.2, 6, true, "left", [0, 48, 135]);
        y += 6 + 2;

        const fotoW = 42, fotoH = 32;
        control.fotos.slice(0, 5).forEach((foto, i) => {
            try {
                const fx = M + (i % 4) * (fotoW + 2);
                const fy = y + Math.floor(i / 4) * (fotoH + 2);
                doc.addImage(foto, "JPEG", fx, fy, fotoW, fotoH);
                doc.setDrawColor(190, 200, 220); doc.rect(fx, fy, fotoW, fotoH, "S");
            } catch {}
        });
        y += Math.ceil(control.fotos.length / 4) * (fotoH + 2) + 2;
    }

    // ── Pie ───────────────────────────────────────────────────
    R(M, H - M - 0.8, CW, 0.8, [226, 1, 19]);
    doc.setFontSize(4.5); doc.setTextColor(160, 160, 160); doc.setFont("helvetica", "normal");
    doc.text(
        `CyranoApp · Control Vehicular · ${new Date().toLocaleString("es-AR")} · ${control.supervisor || ""}`,
        W / 2, H - M + 1.5, { align: "center" }
    );

    const veh   = (control.vehiculo || "vehiculo").replace(/\s+/g, "_");
    const fecha = (control.fecha || "hoy").replace(/\//g, "-");
    const filename = `ControlVehicular_${veh}_${fecha}.pdf`;
    return { blob: doc.output("blob"), dataUrl: doc.output("datauristring"), filename };
}
