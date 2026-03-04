// src/screens/LoadingScreen.jsx
import { useState, useEffect } from "react";
import ShieldLogo from "../components/ShieldLogo";
import "../styles/LoadingScreen.css";

const MESSAGES = [
    "Iniciando sistema...",
    "Verificando módulos...",
    "Cargando configuración...",
    "Preparando interfaz...",
    "Listo.",
];

export default function LoadingScreen({ onFinished }) {
    const [progress, setProgress] = useState(0);
    const [exiting,  setExiting]  = useState(false);

    useEffect(() => {
        const duration     = 3500;
        const intervalTime = 50;
        const increment    = 100 / (duration / intervalTime);

        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setExiting(true);
                    setTimeout(onFinished, 480);
                    return 100;
                }
                return Math.min(prev + increment, 100);
            });
        }, intervalTime);

        return () => clearInterval(timer);
    }, [onFinished]);

    const msgIdx = Math.min(
        Math.floor((progress / 100) * MESSAGES.length),
        MESSAGES.length - 1
    );

    return (
        <div className={`loading-screen${exiting ? " exit" : ""}`}>
            <div className="loading-bg" />

            {/* Logo */}
            <div className="loading-logo-wrap">
                <ShieldLogo size={160} />
            </div>

            {/* Marca */}
            <div className="loading-brand">
                CYRANO<span>APP</span>
            </div>
            <div className="loading-tagline">Supervisión &amp; Seguridad</div>

            {/* Barra */}
            <div className="loading-bar-wrap">
                <div className="loading-label">{MESSAGES[msgIdx]}</div>
                <div className="loading-bar-track">
                    <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="loading-percent">{Math.round(progress)}%</div>
            </div>
        </div>
    );
}
