// src/utils/exportarExcel.js
// Exporta el resumen mensual a Excel usando SheetJS (xlsx)
// Uso: await exportarExcel({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor })

async function cargarSheetJS() {
    if (window.XLSX) return window.XLSX;
    await new Promise((res, rej) => {
        if (document.querySelector("#sheetjs-script")) {
            const wait = setInterval(() => { if (window.XLSX) { clearInterval(wait); res(); } }, 50);
            return;
        }
        const s = document.createElement("script");
        s.id = "sheetjs-script";
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });
    return window.XLSX;
}

const semanasDePatron = (patron, custom) => {
    if (patron === "todas")   return [1,2,3,4];
    if (patron === "impares") return [1,3];
    if (patron === "pares")   return [2,4];
    if (patron === "custom")  return custom || [];
    return [1,2,3,4];
};

const fmtHs = (min) => {
    if (!min || min <= 0) return "00:00";
    return String(Math.floor(min/60)).padStart(2,"0") + ":" + String(min%60).padStart(2,"0");
};
const toMin = (t) => { if (!t) return 0; const [h,m] = t.split(":").map(Number); return h*60+(m||0); };
const diffMin = (a,b) => { let d = toMin(b)-toMin(a); return d<0?d+1440:Math.max(d,0); };

export async function exportarExcel({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor }) {
    const XLSX = await cargarSheetJS();
    const wb   = XLSX.utils.book_new();

    const mesActual = new Date();
    const mesInicio = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const mesNombre = mesActual.toLocaleString("es-AR", { month: "long", year: "numeric" });

    const jornadasMes = jornadas.filter(j => new Date(j.creadaEn || 0) >= mesInicio);
    const supervisores = getSupervisoresConEmail();

    // ── HOJA 1: RESUMEN MENSUAL POR SUPERVISOR ────────────────────────────────
    const resumenRows = [];
    resumenRows.push([`RESUMEN MENSUAL DE SUPERVISIÓN — ${mesNombre.toUpperCase()}`]);
    resumenRows.push([]);
    resumenRows.push([
        "Supervisor","Email","Turno","Objetivos","Req./Mes",
        "Realizadas","Cumpl. %","Ctrl. Diurnos","Ctrl. Nocturnos",
        "Ctrl. Fin Sem.","Km Recorridos","Jornadas"
    ]);

    const supStats = [];
    supervisores.forEach(sup => {
        const planSup   = sup.email ? getPlanSupervisor(sup.email) : null;
        const reqMes    = planSup
            ? (planSup.objetivos||[]).reduce((s,o) =>
                s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana||1), 0)
            : 0;

        const jSup = jornadasMes.filter(j =>
            j.email === sup.email || j.supervisor === sup.nombre || j.nombre === sup.nombre
        );
        const ctrlSup = jSup.flatMap(j => (j.actividades||[]).filter(a => a.tipo === "ctrl"));
        const real    = ctrlSup.length;
        const pct     = reqMes > 0 ? Math.round(real/reqMes*100)/100 : null;
        const noc     = ctrlSup.filter(c => c.turno === "nocturno").length;
        const fds     = ctrlSup.filter(c => c.esFinDeSemana).length;
        const km      = jSup.reduce((s,j) => { const k = Number(j.kmFinal||0)-Number(j.kmInicial||0); return s+(k>0?k:0); }, 0);
        const turno   = { diurno:"☀️ Diurno", nocturno:"🌙 Nocturno", mixto:"🔄 Mixto" }[planSup?.turnoBase||"mixto"] || "—";

        resumenRows.push([
            sup.nombre, sup.email||"—", turno,
            planSup?.objetivos?.length||0, reqMes,
            real, pct !== null ? pct : "Sin plan",
            noc, 0, fds, km > 0 ? km : 0, jSup.length
        ]);

        supStats.push({ nombre: sup.nombre, real, reqMes, pct, noc, fds, km, jornadas: jSup.length });
    });

    // Totales
    resumenRows.push([]);
    const totReal = supStats.reduce((s,x) => s+x.real, 0);
    const totReq  = supStats.reduce((s,x) => s+x.reqMes, 0);
    resumenRows.push([
        "TOTAL","","",
        supStats.reduce((s,x) => s+(x.reqMes>0?1:0),0), totReq,
        totReal, totReq > 0 ? Math.round(totReal/totReq*100)/100 : "—",
        supStats.reduce((s,x) => s+x.noc, 0), 0,
        supStats.reduce((s,x) => s+x.fds, 0),
        supStats.reduce((s,x) => s+x.km, 0),
        supStats.reduce((s,x) => s+x.jornadas, 0),
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(resumenRows);
    ws1["!cols"] = [
        {wch:26},{wch:30},{wch:14},{wch:10},{wch:10},
        {wch:11},{wch:10},{wch:13},{wch:14},{wch:13},{wch:13},{wch:10}
    ];
    // Formato % en columna G (índice 6), fila 4 en adelante
    const pctFmt = "0%";
    for (let r = 3; r < resumenRows.length; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c: 6 });
        if (ws1[cellRef] && typeof ws1[cellRef].v === "number") {
            ws1[cellRef].t = "n";
            ws1[cellRef].z = pctFmt;
        }
    }
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen Mensual");

    // ── HOJA 2: CUMPLIMIENTO POR OBJETIVO ─────────────────────────────────────
    const objRows = [];
    objRows.push([`CUMPLIMIENTO POR PUESTO — ${mesNombre.toUpperCase()}`]);
    objRows.push([]);
    objRows.push(["Puesto / Objetivo","Req./Sem","Req. Mes","Realizadas","Cumpl. %","Diurnos","Nocturnos","Fin Semana","Estado"]);

    const ctrlTodos = jornadasMes.flatMap(j => (j.actividades||[]).filter(a => a.tipo==="ctrl"));
    plan.forEach(p => {
        const real = ctrlTodos.filter(c => c.objetivo === p.objetivo).length;
        const req  = (p.visitasPorSemana||1) * 4;
        const pct  = req > 0 ? real/req : 0;
        const noc  = ctrlTodos.filter(c => c.objetivo===p.objetivo && c.turno==="nocturno").length;
        const fds  = ctrlTodos.filter(c => c.objetivo===p.objetivo && c.esFinDeSemana).length;
        const dia  = real - noc;
        const est  = pct >= 1 ? "✓ Cumplido" : pct >= 0.5 ? "~ Parcial" : "✗ Pendiente";
        objRows.push([p.objetivo, p.visitasPorSemana||1, req, real, pct, dia, noc, fds, est]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(objRows);
    ws2["!cols"] = [{wch:40},{wch:12},{wch:10},{wch:11},{wch:10},{wch:10},{wch:11},{wch:11},{wch:14}];
    for (let r = 3; r < objRows.length; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c: 4 });
        if (ws2[cellRef] && typeof ws2[cellRef].v === "number") {
            ws2[cellRef].t = "n";
            ws2[cellRef].z = pctFmt;
        }
    }
    XLSX.utils.book_append_sheet(wb, ws2, "Cumplimiento por Objetivo");

    // ── HOJA 3: DETALLE DE JORNADAS ───────────────────────────────────────────
    const jornRows = [];
    jornRows.push([`DETALLE DE JORNADAS — ${mesNombre.toUpperCase()}`]);
    jornRows.push([]);
    jornRows.push(["Fecha","Supervisor","Vehículo","H. Inicio","H. Fin","Km Inicio","Km Fin","Km Recorr.","Controles","Capacit.","Otras Act.","Hs Superv.","Hs Traslado"]);

    [...jornadasMes].sort((a,b) => (a.fecha||"").localeCompare(b.fecha||"")).forEach(j => {
        const acts  = j.actividades || [];
        const ctrl  = acts.filter(a => a.tipo==="ctrl");
        const cap   = acts.filter(a => a.tipo==="cap");
        const otras = acts.filter(a => a.tipo==="otra");
        const km    = Math.max(Number(j.kmFinal||0)-Number(j.kmInicial||0), 0);

        let hsSuper = 0;
        ctrl.forEach(a => { if(a.horaInicio&&a.horaFin) hsSuper += diffMin(a.horaInicio,a.horaFin); });

        const actsOrd = [...acts].filter(a=>a.horaInicio&&a.horaFin).sort((a,b)=>toMin(a.horaInicio)-toMin(b.horaInicio));
        let hsTras = 0;
        for (let i=1;i<actsOrd.length;i++) {
            const g = diffMin(actsOrd[i-1].horaFin, actsOrd[i].horaInicio);
            if (g>5&&g<180) hsTras += g;
        }

        jornRows.push([
            j.fecha||"—", j.nombre||j.supervisor||"—", j.vehiculo||"—",
            j.horaInicio||"—", j.horaFin||"—",
            j.kmInicial||"—", j.kmFinal||"—", km||0,
            ctrl.length, cap.length, otras.length,
            fmtHs(hsSuper), fmtHs(hsTras)
        ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(jornRows);
    ws3["!cols"] = [{wch:12},{wch:26},{wch:20},{wch:10},{wch:10},{wch:10},{wch:10},{wch:12},{wch:10},{wch:10},{wch:10},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws3, "Detalle Jornadas");

    // ── HOJA 4: TENDENCIA SEMANAL ─────────────────────────────────────────────
    const tendRows = [];
    tendRows.push(["TENDENCIA SEMANAL — ÚLTIMAS 8 SEMANAS"]);
    tendRows.push([]);

    // Calcular semanas
    const semanas = [];
    for (let i = 7; i >= 0; i--) {
        const inicio = new Date();
        inicio.setDate(inicio.getDate() - inicio.getDay() - i * 7 + 1);
        inicio.setHours(0,0,0,0);
        const fin = new Date(inicio); fin.setDate(fin.getDate()+6); fin.setHours(23,59,59,999);
        const label = `${inicio.getDate()}/${inicio.getMonth()+1}`;
        semanas.push({ inicio, fin, label });
    }

    tendRows.push(["Supervisor", ...semanas.map(s => s.label), "Total", "Promedio"]);

    supervisores.forEach(sup => {
        const vals = semanas.map(sem => {
            return jornadas
                .filter(j => {
                    const d = new Date(j.creadaEn||0);
                    return (j.email===sup.email||j.nombre===sup.nombre) && d>=sem.inicio && d<=sem.fin;
                })
                .flatMap(j => (j.actividades||[]).filter(a => a.tipo==="ctrl")).length;
        });
        const total = vals.reduce((s,v) => s+v, 0);
        const prom  = Math.round(total/semanas.length*10)/10;
        tendRows.push([sup.nombre, ...vals, total, prom]);
    });

    const ws4 = XLSX.utils.aoa_to_sheet(tendRows);
    ws4["!cols"] = [{wch:26}, ...semanas.map(()=>({wch:10})), {wch:8},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws4, "Tendencia Semanal");

    // ── Generar archivo ───────────────────────────────────────────────────────
    const fecha    = new Date().toLocaleDateString("es-AR").replace(/\//g,"-");
    const filename = `Reporte_Supervisores_${mesNombre.replace(" ","_")}_${fecha}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
}
