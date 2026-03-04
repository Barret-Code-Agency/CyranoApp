// src/App.jsx
import { useState, useEffect } from "react";
import { useGeo }                      from "./utils/helpers";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider, useAuth }       from "./context/AuthContext";

import "./styles/variables.css";
import "./styles/global.css";

import SplashScreen        from "./screens/LatamMapSplash";
import LoadingScreen       from "./screens/LoadingScreen";
import Login               from "./screens/Login";
import AdminScreen         from "./screens/AdminScreen";
import SupervisorDashboard from "./screens/SupervisorDashboard";
import JornadaScreen       from "./screens/JornadaScreen";
import MenuScreen          from "./screens/MenuScreen";
import CapacitacionScreen  from "./screens/CapacitacionScreen";
import OtraActividadScreen from "./screens/OtraActividadScreen";
import ControlScreen       from "./screens/ControlScreen";
import FinJornadaScreen    from "./screens/FinJornadaScreen";
import SendModal           from "./screens/SendModal";
import ShieldLogo          from "./components/ShieldLogo";

function AppInner() {
    const { user, loading: authLoading, logout } = useAuth();
    const { jornadaActiva } = useAppData();
    const geo = useGeo();

    const [phase,       setPhase]       = useState("splash");
    const [loadingDone, setLoadingDone] = useState(false);
    const [modal,       setModal]       = useState(null);

    const goTo = (p) => setPhase(p);

    // Redirigir cuando loading animación termina + Firebase resolvió
    useEffect(() => {
        if (phase !== "loading") return;
        if (!loadingDone)        return;
        if (authLoading)         return;
        goTo(user
            ? (user.role === "admin" ? "admin" : "supervisor_dash")
            : "login");
    }, [phase, loadingDone, authLoading, user]);

    const handleLoginSuccess = () => goTo("loading");

    const handleLogout = async () => {
        await logout();
        setModal(null);
        goTo("login");
    };

    const handleIniciarJornada = () =>
        jornadaActiva ? goTo("menu") : goTo("jornada");

    const isAdmin    = phase === "admin";
    const showHeader = !["splash", "loading", "login"].includes(phase);

    return (
        <>
            {phase === "splash" && (
                <SplashScreen onAdvance={() => goTo("loading")} />
            )}

            {phase === "loading" && (
                <LoadingScreen onFinished={() => setLoadingDone(true)} />
            )}

            {phase === "login" && (
                <Login onLogin={handleLoginSuccess} />
            )}

            {showHeader && (
                <div className="app">
                    <header
                        className="header"
                        style={isAdmin ? {
                            background: "var(--color-primary-dark)",
                            borderBottom: "3px solid var(--color-red)",
                        } : {}}
                    >
                        <div className="header-logo-area">
                            <ShieldLogo size={44} />
                            <div className="header-logo-text" style={isAdmin ? { color: "#ffffff" } : {}}>
                                <div className="header-logo-dot" />
                                CYRANO
                                <span style={isAdmin ? { color: "var(--color-red)" } : {}}>APP</span>
                                {isAdmin && (
                                    <span style={{
                                        fontSize: "10px", fontWeight: 700, letterSpacing: "2px",
                                        background: "var(--color-red)", color: "#fff",
                                        padding: "2px 8px", borderRadius: "4px", marginLeft: "4px",
                                    }}>ADMIN</span>
                                )}
                            </div>
                        </div>
                        {user && (
                            <div
                                className="user-chip"
                                style={isAdmin
                                    ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }
                                    : { cursor: "pointer" }}
                                onClick={handleLogout}
                                title="Cerrar sesión"
                            >
                                <div className="user-avatar" style={{ background: isAdmin ? "var(--color-red)" : "var(--color-primary)" }}>
                                    {user.name?.[0]?.toUpperCase() || "?"}
                                </div>
                                <span className="user-name" style={isAdmin ? { color: "#ffffff" } : {}}>
                                    {user.name}
                                </span>
                                <span style={{ fontSize: 10, marginLeft: 2, color: isAdmin ? "rgba(255,255,255,0.5)" : "var(--color-muted)" }}>
                                    ⏏
                                </span>
                            </div>
                        )}
                    </header>

                    <main className="main">
                        {phase === "admin" && (
                            <AdminScreen onExit={handleLogout} />
                        )}
                        {phase === "supervisor_dash" && user && (
                            <SupervisorDashboard user={user} onIniciarJornada={handleIniciarJornada} />
                        )}
                        {phase === "jornada" && user && (
                            <JornadaScreen user={user} onStarted={() => goTo("menu")} />
                        )}
                        {phase === "menu"         && <MenuScreen onSelect={goTo} />}
                        {phase === "capacitacion" && <CapacitacionScreen onBack={() => goTo("menu")} />}
                        {phase === "otra"         && <OtraActividadScreen geo={geo} onBack={() => goTo("menu")} />}
                        {phase === "ctrl"         && <ControlScreen geo={geo} onBack={() => goTo("menu")} />}
                        {phase === "fin"          && (
                            <FinJornadaScreen
                                onClosed={(j) => setModal(j)}
                                onBack={() => goTo("menu")}
                            />
                        )}
                    </main>

                    {modal && (
                        <SendModal
                            session={modal}
                            onClose={() => { setModal(null); goTo("supervisor_dash"); }}
                        />
                    )}
                </div>
            )}
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppDataProvider>
                <AppInner />
            </AppDataProvider>
        </AuthProvider>
    );
}
