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
import VigHome             from "./screens/vigilador/VigHome";
import LoadingScreen       from "./screens/LoadingScreen";
import Login               from "./screens/Login";
import AdminScreen         from "./screens/AdminScreen";
import AdminContratoHome  from "./screens/gerencia/AdminContratoHome";
import SupervisorDashboard   from "./screens/supervisor/SupervisorDashboard";
import SupervisorHome        from "./screens/supervisor/SupervisorHome";
import AdministrativoHome   from "./screens/administrativo/AdministrativoHome";
import JornadaScreen       from "./screens/vigilador/JornadaScreen";
import MenuScreen          from "./screens/MenuScreen";
import CapacitacionScreen  from "./screens/CapacitacionScreen";
import OtraActividadScreen from "./screens/OtraActividadScreen";
import ControlScreen       from "./screens/ControlScreen";
import FinJornadaScreen    from "./screens/vigilador/FinJornadaScreen";
import SendModal           from "./screens/SendModal";
import ShieldLogo          from "./components/ShieldLogo";
import AppHeader            from "./components/AppHeader";

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
            admin:         ["admin_contrato"],
            supervisor:    ["supervisor", "admin_contrato"],
            administrativo:["administrativo"],
            user:          ["vigilador", "supervisor", "admin_contrato"],
        };
        const permitidos  = ROLES_PERMITIDOS[loginRole] ?? [];
        const userRoles   = Array.isArray(u.roles) ? u.roles : [u.rol];
        if (!permitidos.some(r => userRoles.includes(r))) {
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
        else if (loginRole === "admin")          dest = "admin";
        else if (loginRole === "administrativo") dest = "administrativo_home";
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
                         "role_select", "super_admin", "vig_home",
                         "administrativo_home", "supervisor_dash", "admin"].includes(phase);

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

    if (phase === "vig_home")
        return <div className="panel-viewport"><VigHome user={authUser || user} onLogout={() => { setUser(null); goTo("splash"); }} /></div>;

    if (phase === "administrativo_home")
        return <div className="panel-viewport"><AdministrativoHome user={authUser || user} onLogout={() => { setUser(null); goTo("splash"); }} /></div>;

    if (phase === "supervisor_dash" && (user || authUser))
        return <div className="panel-viewport"><SupervisorHome user={authUser || user} onIniciarJornada={handleIniciarJornada} onExit={() => { setUser(null); goTo("splash"); }} /></div>;

    if (phase === "admin")
        return <div className="panel-viewport"><AdminContratoHome onExit={() => { setUser(null); goTo("splash"); }} /></div>;

    return (
        <div className="app">
            {showHeader && (
                <AppHeader onLogout={async () => { await logout(); setUser(null); goTo("splash"); }} />
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
