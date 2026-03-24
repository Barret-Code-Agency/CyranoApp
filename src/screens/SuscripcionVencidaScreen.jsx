// src/screens/SuscripcionVencidaScreen.jsx
// Se muestra cuando la empresa está desactivada o su suscripción venció.
import { useAuth } from "../context/AuthContext";

export default function SuscripcionVencidaScreen() {
    const { logout } = useAuth();

    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minHeight: "100vh", padding: "2rem",
            textAlign: "center", fontFamily: "Inter, sans-serif",
            background: "var(--color-bg, #f5f5f5)",
        }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔒</div>
            <h2 style={{ margin: "0 0 0.5rem", color: "var(--color-text, #111)", fontSize: "1.4rem" }}>
                Acceso suspendido
            </h2>
            <p style={{
                color: "var(--color-text-muted, #666)", maxWidth: "380px",
                margin: "0 0 0.5rem", lineHeight: 1.6,
            }}>
                La suscripción de tu empresa está vencida o fue desactivada.
            </p>
            <p style={{ color: "var(--color-text-muted, #666)", maxWidth: "380px", margin: "0 0 2rem", lineHeight: 1.6 }}>
                Contactá a tu administrador o al soporte para renovar el acceso.
            </p>
            <button
                onClick={logout}
                style={{
                    padding: "0.6rem 1.5rem", borderRadius: "8px", border: "none",
                    background: "var(--color-primary, #002d72)", color: "#fff",
                    cursor: "pointer", fontSize: "1rem",
                }}
            >
                Cerrar sesión
            </button>
        </div>
    );
}
