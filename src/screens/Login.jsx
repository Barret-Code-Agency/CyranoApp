// src/screens/Login.jsx — Firebase Auth
import { useState } from "react";
import { useAuth }  from "../context/AuthContext";
import "../styles/Login.css";

const ROLE_LABELS = {
    super_admin:   { label: "Super Administrador",      icon: "⚙️",  variant: "super"    },
    admin_empresa: { label: "Administrador de Empresa", icon: "🏛️", variant: "empresa"  },
    admin:         { label: "Administrador de Contrato",icon: "🏢",  variant: "admin"    },
    supervisor:    { label: "Supervisor",               icon: "🔍",  variant: "supervisor"},
    user:          { label: "Vigilador",                icon: "👷",  variant: "user"     },
};

export default function Login({ onLogin, waiting, forcedRole, roleError, onBack }) {
    const { login } = useAuth();

    const [email,    setEmail]    = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState("");

    const handleLogin = async () => {
        if (!email.trim()) return setError("Ingresá tu email.");
        if (!password)     return setError("Ingresá tu contraseña.");
        setError(""); setLoading(true);
        try {
            const loggedUser = await login(email, password);
            onLogin(loggedUser);
        } catch (e) {
            const msg = e.code || e.message;
            if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential"))
                setError("Email o contraseña incorrectos.");
            else if (msg.includes("too-many-requests"))
                setError("Demasiados intentos. Intentá más tarde.");
            else if (msg.includes("network"))
                setError("Sin conexión. Verificá tu internet.");
            else
                setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const isLoading = loading || waiting;

    return (
        <div className="lw-root">
            <div className="lw-topbar" />

            <div className="lw-card">

                {/* ── Header ── */}
                <div className="lw-header">
                    <div className="lw-deco-1" />
                    <div className="lw-deco-2" />
                    <div className="lw-deco-3" />

                    <div className="lw-logo-row">
                        <div className="lw-logo-ring">
                            <img
                                src="/images/Leon.png"
                                alt="Cyrano App"
                                className="lw-leon"
                            />
                        </div>
                        <div className="lw-brand-block">
                            <div className="lw-brand">CYRANO<span>APP</span></div>
                            <div className="lw-divider-line" />
                            <div className="lw-tagline">Sistema de Gestión de Seguridad</div>
                        </div>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="lw-body">
                    <div className="lw-title">Iniciar sesión</div>

                    {forcedRole && ROLE_LABELS[forcedRole] && (
                        <div className={`lw-role-badge lw-role-badge--${ROLE_LABELS[forcedRole].variant}`}>
                            <span>{ROLE_LABELS[forcedRole].icon}</span>
                            <span>{ROLE_LABELS[forcedRole].label}</span>
                        </div>
                    )}

                    <div className="lw-sub">Ingresá tus credenciales para continuar</div>

                    <div className="lw-field">
                        <label className="lw-label">Email</label>
                        <div className="lw-input-wrap">
                            <input
                                className="lw-input"
                                type="email"
                                placeholder="usuario@empresa.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleLogin()}
                                autoComplete="email"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="lw-field">
                        <label className="lw-label">Contraseña</label>
                        <div className="lw-input-wrap">
                            <input
                                className={`lw-input lw-pass-input`}
                                type={showPass ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleLogin()}
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="lw-toggle"
                                onClick={() => setShowPass(s => !s)}
                                disabled={isLoading}
                            >
                                {showPass ? "🙈" : "👁️"}
                            </button>
                        </div>
                    </div>

                    {(error || roleError) && (
                        <div className="lw-error">
                            <span>⚠️</span> {roleError || error}
                        </div>
                    )}

                    <button
                        className="lw-btn"
                        onClick={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? <><div className="lw-spinner" /> Ingresando...</>
                            : "Ingresar"}
                    </button>

                    <p className="lw-footer">
                        Si olvidaste tu contraseña, contactá al administrador<br />
                        para que te envíe un mail de reseteo.
                    </p>

                    {onBack && (
                        <button className="lw-back" onClick={onBack}>
                            ← Cambiar perfil
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
