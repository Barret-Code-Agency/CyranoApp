// src/App.jsx
import { useState } from "react";
import { useGeo } from "./utils/helpers";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

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

function AppContent() {
    const [phase, setPhase]             = useState("splash");
    const [loginRole, setLoginRole]     = useState(null);
    const [user, setUser]               = useState(null);
    const [modal, setModal]             = useState(null);
    const [pendingDest, setPendingDest] = useState(null);

    const { jornadaActiva, dbReady } = useAppData();
    const { logout, user: authUser } = useAuth();
    const geo = useGeo();

    const goTo = (p) => setPhase(p);

    const handleRoleSelect = (role) => {
        setLoginRole(role);
        goTo("login");
    };

    const handleLogin = (u) => {
        // u includes: role, zona, esAnalista, objetivosVisibles, vehiculosVisibles from AuthContext
        setUser(u);
        const dest = u.role === "admin" ? "admin" : (jornadaActiva ? "menu" : "supervisor_dash");
        setPendingDest(dest);
        goTo("loading_post");
    };

    const handleLoadingDone    = () => goTo(pendingDest);
    const handleIniciarJornada = () => { jornadaActiva ? goTo("menu") : goTo("jornada"); };
    const handleJornadaStarted = () => goTo("menu");
    const handleModalClose     = () => { setModal(null); setUser(null); goTo("splash"); };

    const isAdmin    = phase === "admin";
    const showHeader = !["splash", "loading", "loading_post", "login"].includes(phase);

    if (phase === "splash")
        return <SplashScreen onSelect={handleRoleSelect} />;

    if (phase === "loading")
        return <LoadingScreen onFinished={() => goTo("login")} />;

    if (phase === "loading_post" && user)
        return <LoadingScreen postLogin={true} userName={user.name} dbReady={dbReady} onFinished={handleLoadingDone} />;

    if (phase === "login")
        return <Login forcedRole={loginRole} onLogin={handleLogin} onBack={() => goTo("splash")} />;

    return (
        <div className="app">
            {showHeader && (
                <header className="header" style={isAdmin ? { background: "#ffffff", borderBottom: "2px solid var(--color-primary)" } : {}}>
                    <div className="header-logo-area">
                        <ShieldLogo size={54} />
                        <div className="header-logo-text">
                            <div className="header-logo-dot" />
                            CYRANO<span>APP</span>
                            {isAdmin && <span className="admin-badge">ADMIN</span>}
                        </div>
                    </div>
                    {user && (
                        <button
                            onClick={async () => { await logout(); setUser(null); goTo("splash"); }}
                            style={{
                                cursor: "pointer", border: "1.5px solid",
                                borderColor: isAdmin ? "var(--color-primary)" : "var(--color-border)",
                                borderRadius: "var(--radius-full)",
                                background: isAdmin ? "var(--color-primary-ghost)" : "var(--color-surface2)",
                                padding: "5px 12px", display: "flex", alignItems: "center",
                                gap: 6, fontSize: 11, fontWeight: 700,
                                color: isAdmin ? "var(--color-primary)" : "var(--color-text-secondary)",
                                whiteSpace: "nowrap", transition: "all 0.15s ease",
                            }}
                        >
                            🚪 Cerrar sesión
                        </button>
                    )}
                </header>
            )}
            <main className="main">
                {phase === "admin"          && <AdminScreen onExit={() => { setUser(null); goTo("splash"); }} />}
                {phase === "supervisor_dash" && (user || authUser) && <SupervisorDashboard user={authUser || user} onIniciarJornada={handleIniciarJornada} />}
                {phase === "jornada"        && (user || authUser) && <JornadaScreen user={authUser || user} onStarted={handleJornadaStarted} />}
                {phase === "menu"           && <MenuScreen onSelect={goTo} />}
                {phase === "capacitacion"   && <CapacitacionScreen onBack={() => goTo("menu")} />}
                {phase === "otra"           && <OtraActividadScreen geo={geo} onBack={() => goTo("menu")} />}
                {phase === "ctrl"           && <ControlScreen geo={geo} onBack={() => goTo("menu")} />}
                {phase === "fin"            && <FinJornadaScreen onClosed={(j) => setModal(j)} onBack={() => goTo("menu")} />}
            </main>
            {modal && <SendModal session={modal} onClose={handleModalClose} />}
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppDataProvider>
                <AppContent />
            </AppDataProvider>
        </AuthProvider>
    );
}
