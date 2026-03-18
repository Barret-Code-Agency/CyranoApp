// src/App.jsx
import { useState, useEffect } from "react";
import { useGeo } from "./utils/helpers";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import "./styles/variables.css";
import "./styles/global.css";

import SplashScreen        from "./screens/LatamMapSplash";
import RoleSelectScreen    from "./screens/RoleSelectScreen";
import SuperAdminScreen    from "./screens/SuperAdminScreen";
import VigHome             from "./screens/VigHome";
import LoadingScreen       from "./screens/LoadingScreen";
import Login               from "./screens/Login";
import AdminScreen         from "./screens/AdminScreen";
import AdminContratoHome  from "./screens/AdminContratoHome";
import AdminEmpresaScreen  from "./screens/AdminEmpresaScreen";
import SupervisorDashboard from "./screens/SupervisorDashboard";
import SupervisorHome      from "./screens/SupervisorHome";
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
    const [loginRoleError, setLoginRoleError] = useState(null);
    const [user, setUser]               = useState(null);
    const [modal, setModal]             = useState(null);
    const [pendingDest, setPendingDest] = useState(null);
    const [country, setCountry]         = useState(null);  // { name, src }

    const { jornadaActiva, actividadActiva, dbReady } = useAppData();
    const { logout, user: authUser } = useAuth();
    const geo = useGeo();

    const goTo = (p) => setPhase(p);


    const handleRoleSelect = (role) => {
        setLoginRole(role);
        setLoginRoleError(null);
        goTo("login");
    };

    // Acceso directo Super Admin — desde el logo en la splash
    const handleSuperAdminAccess = () => {
        setLoginRole("super_admin");
        setLoginRoleError(null);
        goTo("login");
    };

    const handleLogin = (u) => {
        // Mapa: perfil seleccionado → roles Firebase permitidos
        const ROLES_PERMITIDOS = {
            super_admin:   ["super_admin"],
            admin_empresa: ["admin_empresa"],
            admin:         ["admin_contrato", "admin_empresa"],           // admin_empresa puede entrar como admin contrato
            supervisor:    ["supervisor", "admin_contrato", "admin_empresa"],
            user:          ["vigilador", "supervisor", "admin_contrato", "admin_empresa"],
        };
        const permitidos = ROLES_PERMITIDOS[loginRole] ?? [];
        if (!permitidos.includes(u.rol)) {
            const msgs = {
                admin:      "Tu cuenta no tiene permisos de Administrador.",
                supervisor: "Tu cuenta no tiene permisos de Supervisor.",
                user:       "Tu cuenta no tiene permisos de Vigilador.",
            };
            setLoginRoleError(msgs[loginRole] ?? "Perfil incorrecto.");
            return;
        }

        setLoginRoleError(null);
        setUser(u);

        // Routing por perfil elegido (no por rol Firestore — un admin puede entrar como supervisor)
        let dest;
        if      (loginRole === "super_admin")   dest = "super_admin";
        else if (loginRole === "admin_empresa") dest = "admin_empresa";
        else if (loginRole === "admin")         dest = "admin";
        else if (loginRole === "supervisor")    dest = "supervisor_dash";
        else if (loginRole === "user")          dest = "vig_home";
        else if (jornadaActiva) {
            if (actividadActiva) {
                const map = { ctrl: "ctrl", cap: "capacitacion", otra: "otra" };
                dest = map[actividadActiva.tipo] || "menu";
            } else {
                dest = "menu";
            }
        }
        setPendingDest(dest);
        goTo("loading_post");
    };

    const handleLoadingDone    = () => goTo(pendingDest);
    const handleIniciarJornada = () => { jornadaActiva ? goTo("menu") : goTo("jornada"); };
    const handleJornadaStarted = () => goTo("menu");
    const handleModalClose     = () => { setModal(null); setUser(null); goTo("splash"); };

    const isAdmin    = phase === "admin";
    // Pantallas con header propio — no mostrar el header global
    const showHeader = !["splash", "loading", "loading_post", "login",
                         "role_select", "super_admin", "admin_empresa", "vig_home",
                         "supervisor_dash", "admin"].includes(phase);

    if (phase === "splash")
        return <SplashScreen
            onContinue={(flag) => { setCountry(flag); goTo("role_select"); }}
            onSuperAdmin={handleSuperAdminAccess}
        />;

    if (phase === "role_select")
        return <RoleSelectScreen
            country={country}
            onSelect={handleRoleSelect}
            onBack={() => goTo("splash")}
        />;

    if (phase === "loading")
        return <LoadingScreen onFinished={() => goTo("login")} />;

    if (phase === "loading_post" && user)
        return <LoadingScreen postLogin={true} userName={user.name} dbReady={dbReady} onFinished={handleLoadingDone} />;

    if (phase === "login")
        return <Login
            forcedRole={loginRole}
            roleError={loginRoleError}
            onLogin={handleLogin}
            onBack={() => {
                setLoginRoleError(null);
                goTo(loginRole === "super_admin" ? "splash" : "role_select");
            }}
        />;

    // ── Pantallas de panel completo — fuera del wrapper .main ──────────────
    if (phase === "super_admin")
        return <SuperAdminScreen onExit={() => { setUser(null); goTo("splash"); }} />;

    if (phase === "admin_empresa")
        return <AdminEmpresaScreen onExit={() => { setUser(null); goTo("splash"); }} />;

    if (phase === "vig_home")
        return <div className="panel-viewport"><VigHome user={authUser || user} onLogout={() => { setUser(null); goTo("splash"); }} /></div>;

    if (phase === "supervisor_dash" && (user || authUser))
        return <div className="panel-viewport"><SupervisorHome user={authUser || user} onIniciarJornada={handleIniciarJornada} onExit={() => { setUser(null); goTo("splash"); }} /></div>;

    if (phase === "admin")
        return <div className="panel-viewport"><AdminContratoHome onExit={() => { setUser(null); goTo("splash"); }} /></div>;

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
