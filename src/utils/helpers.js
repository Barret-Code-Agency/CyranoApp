// src/utils/helpers.js

export const nowTime = () =>
    new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

export const todayDate = () =>
    new Date().toLocaleDateString("es-AR");

export const genID = () =>
    "J-" + Date.now().toString().slice(-6);

export function useGeo() {
    const get = () =>
        new Promise((res) => {
            if (!navigator.geolocation) return res("GPS no disponible");
            navigator.geolocation.getCurrentPosition(
                (p) => res(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
                () => res("GPS no disponible"),
                { timeout: 8000 }
            );
        });
    return { get };
}

// Opciones de período para filtros de historial y capacitaciones
export const PERIODOS_FILTRO = [
    { k: "7",    l: "7 días"  },
    { k: "30",   l: "30 días" },
    { k: "90",   l: "3 meses" },
    { k: "todo", l: "Todo"    },
];

// Formatea minutos a "2h 30m"
export function fmtMin(m) {
    if (!m || m <= 0) return "0m";
    const h = Math.floor(m / 60), r = m % 60;
    return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

// Convierte URL de imagen a base64
export async function urlToBase64(url) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

// ── Login ─────────────────────────────────────────────────────────────────────
// Roles: "admin" | "operator"
// Escribir "administrador" como usuario → acceso al panel de administración.
// Cualquier email válido → operador normal.

export function loginDemo(input, password) {
    return new Promise((res, rej) => {
        if (!input || !password)
            return rej(new Error("Completá usuario y contraseña"));
        if (password.length < 4)
            return rej(new Error("Contraseña muy corta (mín. 4 caracteres)"));

        setTimeout(() => {
            const normalized = input.trim().toLowerCase();
            const isAdmin = normalized === "administrador" || normalized === "admin";

            if (isAdmin) {
                res({
                    provider: "demo",
                    token: "demo",
                    role: "admin",
                    name: "Administrador",
                    email: "admin@cyranoapp.com",
                    picture: null,
                });
                return;
            }

            // Operador — requiere email válido
            if (!input.includes("@"))
                return rej(new Error("Email inválido (o escribí 'administrador' para el panel admin)"));

            const name = input
                .split("@")[0]
                .replace(/[._]/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

            res({
                provider: "demo",
                token: "demo",
                role: "operator",
                name,
                email: input,
                picture: null,
            });
        }, 900);
    });
}
