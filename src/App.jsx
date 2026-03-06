// src/App.jsx
// ── CAMBIOS respecto al original ─────────────────────────────────────────────
// 1. Se importa SupervisorDashboard
// 2. handleLogin de supervisor va a "supervisor_dash" en vez de "jornada"/"menu"
// 3. Se agrega phase "supervisor_dash" en el render
// Todo lo demás queda EXACTAMENTE igual.

import { useState } from "react";
import { useGeo } from "./utils/helpers";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider } from "./context/AuthContext";

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
    // Bloqueo: si la jornada tiene vehículo pero no hizo control vehicular
    const requiereControlVeh = jornadaActiva?.vehiculo && !jornadaActiva?.controlVehicular;
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
    const showHeader = !["splash", "loading_post", "login"].includes(phase);

    return (
        <>
            {phase === "splash" && (
                <SplashScreen onSelect={handleRoleSelect} />
            )}

            {phase === "loading_post" && user && (
                <LoadingScreen
                    postLogin={true}
                    userName={user.name}
                    dbReady={dbReady}
                    onFinished={handleLoadingDone}
                />
            )}

            {!["splash", "loading_post"].includes(phase) && (
                <div className="app">
                    {showHeader && (
                        <header className="header" style={{}}>
                            <div className="header-logo-area">
                                <ShieldLogo size={44} />
                                <div className="header-logo-text">
                                    <div className="header-logo-dot" />
                                    CYRANO<span>APP</span>
                                    {isAdmin && <span className="admin-badge">ADMIN</span>}
                                </div>
                            </div>
                            {user && (
                                <button className="user-chip user-chip--logout" onClick={() => { setUser(null); goTo("splash"); }}>
                                    <div className="user-avatar" style={{}}>
                                        {user.name ? user.name[0].toUpperCase() : "?"}
                                    </div>
                                    <span className="user-name">Cerrar sesión</span>
                                </button>
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
                            <JornadaScreen user={user} onStarted={handleJornadaStarted} onBack={() => goTo("supervisor_dash")} />
                        )}

                        {phase === "menu" && (
                            <MenuScreen onSelect={goTo} bloqueado={requiereControlVeh} />
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

export default function App() {
    return (
        <AuthProvider>
            <AppDataProvider>
                <AppContent />
            </AppDataProvider>
        </AuthProvider>
    );
}
