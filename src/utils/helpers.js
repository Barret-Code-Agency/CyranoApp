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
