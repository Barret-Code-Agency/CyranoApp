// src/screens/gerencia/InformeGestionScreen.jsx
// Informe de gestión — embebe los tres dashboards uno debajo del otro
import DashboardPersonalScreen  from "../administrativo/DashboardPersonalScreen";
import DashboardsGestionScreen  from "./DashboardsGestionScreen";
import DashboardScreen          from "./DashboardScreen";
import "./InformeGestionScreen.css";

export default function InformeGestionScreen() {
    return (
        <div className="ig-root">
            {/* ── 1. Dashboard de Personal ─────────────────── */}
            <div className="ig-dash-bloque">
                <DashboardPersonalScreen onBack={() => {}} embedded />
            </div>

            {/* ── 2. Dashboard de Gestión ──────────────────── */}
            <div className="ig-dash-bloque">
                <DashboardsGestionScreen onBack={() => {}} embedded />
            </div>

            {/* ── 3. Cumplimiento por objetivos ── */}
            <div className="ig-dash-bloque">
                <DashboardScreen embedded />
            </div>
        </div>
    );
}
