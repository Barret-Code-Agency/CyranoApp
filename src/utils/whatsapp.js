// src/utils/whatsapp.js — Integración CallMeBot para WhatsApp

/**
 * Envía un mensaje de WhatsApp vía CallMeBot.
 * Usa Image() para evitar problemas de CORS.
 */
export function enviarWhatsApp(numero, apikey, texto) {
    const url =
        `https://api.callmebot.com/whatsapp.php` +
        `?phone=${encodeURIComponent(numero)}` +
        `&text=${encodeURIComponent(texto)}` +
        `&apikey=${encodeURIComponent(apikey)}`;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(true);
        img.onerror = () => resolve(true); // CallMeBot retorna imagen vacía incluso en éxito
        img.src = url;
        setTimeout(() => resolve(true), 5000); // fallback timeout
    });
}

/**
 * Construye el mensaje de resumen diario.
 * @param {Date}   fecha
 * @param {Array}  actividades   [{label, hora?, tipo}]
 * @param {Array}  cumpleanos    ["Apellido", ...]
 */
export function buildResumenDiario(fecha, actividades = [], cumpleanos = []) {
    const DIAS  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const MESES = ["enero","febrero","marzo","abril","mayo","junio",
                   "julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const dia   = DIAS[fecha.getDay()];
    const fmtFecha = `${dia} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;

    let msg = `📅 *Resumen del día — ${fmtFecha}*\n`;

    if (cumpleanos.length) {
        msg += `\n🎂 *Cumpleaños hoy:*\n`;
        cumpleanos.forEach(ap => { msg += `  • ${ap}\n`; });
    }

    if (actividades.length) {
        msg += `\n📋 *Actividades:*\n`;
        actividades.forEach(a => {
            msg += a.hora ? `  • ${a.hora} — ${a.label}\n` : `  • ${a.label}\n`;
        });
    }

    if (!cumpleanos.length && !actividades.length) {
        msg += `\nSin actividades ni cumpleaños para hoy.`;
    }

    return msg;
}
