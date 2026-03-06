// src/App.jsx
// ── CAMBIOS respecto al original ─────────────────────────────────────────────
// 1. Se importa SupervisorDashboard
// 2. handleLogin de supervisor va a "supervisor_dash" en vez de "jornada"/"menu"
// 3. Se agrega phase "supervisor_dash" en el render
// Todo lo demás queda EXACTAMENTE igual.

import { useState } from "react";
import { useGeo } from "./utils/helpers";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import "./styles/variables.css";
import "./styles/global.css";

import SplashScreen         from "./screens/LatamMapSplash";
import LoadingScreen        from "./screens/LoadingScreen";
import RoleSelectScreen     from "./screens/RoleSelectScreen";
import Login                from "./screens/Login";
import AdminScreen          from "./screens/AdminScreen";
import SupervisorDashboard  from "./screens/SupervisorDashboard";   // ← NUEVO
import JornadaScreen        from "./screens/JornadaScreen";
import MenuScreen           from "./screens/MenuScreen";
import CapacitacionScreen   from "./screens/CapacitacionScreen";
import OtraActividadScreen  from "./screens/OtraActividadScreen";
import ControlScreen        from "./screens/ControlScreen";
import FinJornadaScreen     from "./screens/FinJornadaScreen";
import SendModal            from "./screens/SendModal";
import ShieldLogo           from "./components/ShieldLogo";

function AppContent() {
    const [phase, setPhase]         = useState("splash");
    const [loginRole, setLoginRole] = useState(null);
    const [user, setUser]           = useState(null);
    const [modal, setModal]         = useState(null);
    const [pendingDest, setPendingDest] = useState(null);

    const { jornadaActiva, dbReady } = useAppData();
    const geo = useGeo();

    const goTo = (p) => setPhase(p);

    const handleRoleSelect = (role) => {
        setLoginRole(role);
        goTo("login");
    };

    const handleLogin = (u) => {
        setUser(u);
        const dest = u.role === "admin" ? "admin" : (jornadaActiva ? "menu" : "supervisor_dash");
        setPendingDest(dest);
        goTo("loading_post");
    };

    const handleLoadingDone = () => goTo(pendingDest);

    // ← NUEVO: desde el dashboard el supervisor decide iniciar jornada
    const handleIniciarJornada = () => {
        jornadaActiva ? goTo("menu") : goTo("jornada");
    };

    const handleJornadaStarted = () => goTo("menu");

    const handleModalClose = () => {
        setModal(null);
        setUser(null);
        goTo("roleSelect");
    };

    const isAdmin    = phase === "admin";
    const showHeader = !["splash", "loading", "loading_post", "login", "roleSelect"].includes(phase);

    return (
        <>
            {phase === "splash" && (
                <SplashScreen onAdvance={() => goTo("loading")} />
            )}

            {phase === "loading" && (
                <LoadingScreen onFinished={() => goTo("roleSelect")} />
            )}

            {phase === "loading_post" && user && (
                <LoadingScreen
                    postLogin={true}
                    userName={user.name}
                    dbReady={dbReady}
                    onFinished={handleLoadingDone}
                />
            )}

            {phase === "roleSelect" && (
                <RoleSelectScreen onSelect={handleRoleSelect} />
            )}

            {!["splash", "loading", "loading_post", "roleSelect"].includes(phase) && (
                <div className="app">
                    {showHeader && (
                        <header className="header" style={isAdmin ? { background: "var(--color-primary-dark)" } : {}}>
                            <div className="header-logo-area">
                                <ShieldLogo size={44} />
                                <div className="header-logo-text">
                                    <div className="header-logo-dot" />
                                    CYRANO<span>APP</span>
                                    {isAdmin && <span className="admin-badge">ADMIN</span>}
                                </div>
                            </div>
                            {user && (
                                <div className="user-chip">
                                    <div className="user-avatar" style={isAdmin ? { background: "var(--color-red)" } : {}}>
                                        {user.name ? user.name[0].toUpperCase() : "?"}
                                    </div>
                                    <span className="user-name">{user.name}</span>
                                </div>
                            )}
                        </header>
                    )}

                    <main className="main">
                        {phase === "login" && (
                            <Login forcedRole={loginRole} onLogin={handleLogin} onBack={() => goTo("roleSelect")} />
                        )}

                        {phase === "admin" && (
                            <AdminScreen onExit={() => { setUser(null); goTo("roleSelect"); }} />
                        )}

                        {/* ← NUEVO: dashboard personal del supervisor */}
                        {phase === "supervisor_dash" && user && (
                            <SupervisorDashboard
                                user={user}
                                onIniciarJornada={handleIniciarJornada}
                            />
                        )}

                        {phase === "jornada" && user && (
                            <JornadaScreen user={user} onStarted={handleJornadaStarted} />
                        )}

                        {phase === "menu" && (
                            <MenuScreen onSelect={goTo} />
                        )}

                        {phase === "capacitacion" && (
                            <CapacitacionScreen onBack={() => goTo("menu")} />
                        )}

                        {phase === "otra" && (
                            <OtraActividadScreen geo={geo} onBack={() => goTo("menu")} />
                        )}

                        {phase === "ctrl" && (
                            <ControlScreen geo={geo} onBack={() => goTo("menu")} />
                        )}

                        {phase === "fin" && (
                            <FinJornadaScreen
                                onClosed={(j) => setModal(j)}
                                onBack={() => goTo("menu")}
                            />
                        )}
                    </main>

                    {modal && <SendModal session={modal} onClose={handleModalClose} />}
                </div>
            )}
        </>
    );
}

// Wrapper para pasar uid al AppDataProvider
function AppDataProviderWithAuth({ children }) {
    const { user } = useAuth();
    return <AppDataProvider uid={user?.uid}>{children}</AppDataProvider>;
}

export default function App() {
    return (
        <AuthProvider>
            <AppDataProviderWithAuth>
                <AppContent />
            </AppDataProviderWithAuth>
        </AuthProvider>
    );
}
