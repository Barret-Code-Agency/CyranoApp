// src/components/ErrorBoundary.jsx
// Captura errores de render en cualquier componente hijo.
// Evita la pantalla blanca en producción y da al usuario una salida.
import { Component } from "react";

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // En producción conectar aquí Sentry / LogRocket / etc.
        // vite.config drop:["console"] lo elimina en build, así que es seguro dejarlo.
        console.error("[ErrorBoundary]", error.message, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", minHeight: "100vh", padding: "2rem",
                textAlign: "center", fontFamily: "Inter, sans-serif",
                background: "var(--color-bg, #f5f5f5)",
            }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                <h2 style={{ margin: "0 0 0.5rem", color: "var(--color-text, #111)" }}>
                    Algo salió mal
                </h2>
                <p style={{ color: "var(--color-text-muted, #666)", maxWidth: "360px", margin: "0 0 1.5rem" }}>
                    Ocurrió un error inesperado. Recargá la página para continuar.
                    Si el problema persiste, contactá a soporte.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: "0.6rem 1.5rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "var(--color-primary, #002d72)",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "1rem",
                    }}
                >
                    Recargar aplicación
                </button>
            </div>
        );
    }
}
