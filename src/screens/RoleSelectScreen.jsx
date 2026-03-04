// src/screens/RoleSelectScreen.jsx
import ShieldLogo from "../components/ShieldLogo";
import "../styles/RoleSelectScreen.css";

export default function RoleSelectScreen({ onSelect }) {
    return (
        <div className="role-wrap">
            <div className="role-bg" />
            <div className="role-content">
                <div className="role-logo-area">
                    <ShieldLogo size={110} />
                    <div className="role-brand">CYRANO<span>APP</span></div>
                    <div className="role-tagline">Sistema de Supervisión &amp; Seguridad</div>
                </div>

                <div className="role-divider" />
                <p className="role-prompt">¿Cómo querés ingresar?</p>

                <div className="role-buttons">
                    <button
                        className="role-btn role-btn-operator"
                        onClick={() => onSelect("operator")}
                    >
                        <span className="role-btn-icon">👷</span>
                        <div className="role-btn-text">
                            <strong>Supervisor</strong>
                            <small>Registrar jornada y actividades</small>
                        </div>
                        <span className="role-btn-arrow">›</span>
                    </button>

                    <button
                        className="role-btn role-btn-admin"
                        onClick={() => onSelect("admin")}
                    >
                        <span className="role-btn-icon">🔐</span>
                        <div className="role-btn-text">
                            <strong>Administrador</strong>
                            <small>Dashboard, configuración y reportes</small>
                        </div>
                        <span className="role-btn-arrow">›</span>
                    </button>
                </div>

                <p className="role-version">v1.0 · Modo demo</p>
            </div>
        </div>
    );
}
