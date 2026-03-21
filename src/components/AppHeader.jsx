// src/components/AppHeader.jsx
// Header azul unificado para todos los perfiles del sistema.
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import ShieldLogo     from "./ShieldLogo";
import "./AppHeader.css";

export default function AppHeader({ onLogout }) {
    const { user }                           = useAuth();
    const { empresaLogos, empresaNombre }    = useAppData();

    return (
        <header className="app-header">
            <div className="app-header-left">
                {empresaLogos?.panel
                    ? <img src={empresaLogos.panel} alt="Logo" className="app-header-logo" />
                    : <ShieldLogo size={36} className="app-header-shield" />
                }
                <div>
                    <div className="app-header-empresa">{empresaNombre}</div>
                    <div className="app-header-user">{user?.name}</div>
                </div>
            </div>
            <button className="app-header-logout" onClick={onLogout} title="Cerrar sesión">🚪</button>
        </header>
    );
}
