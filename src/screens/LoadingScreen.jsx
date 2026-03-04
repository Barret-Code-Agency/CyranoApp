// src/screens/LoadingScreen.jsx
import { useState, useEffect } from "react";
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

    // clip-path revela el logo de abajo hacia arriba según el progreso
    const clipY = 100 - progress; // 100% = oculto arriba, 0% = totalmente visible

    return (
        <div className={`loading-screen${exiting ? " exit" : ""}`}>
            <div className="loading-bg" />

            {/* Logo con efecto de llenado */}
            <div className="loading-logo-wrap">
                {/* Logo gris de fondo (siempre visible) */}
                <img
                    src="/images/png-transparent-logo.png"
                    alt=""
                    className="loading-logo-base"
                />
                {/* Logo a color que se revela de abajo hacia arriba */}
                <img
                    src="/images/png-transparent-logo.png"
                    alt="Cyrano App"
                    className="loading-logo-fill"
                    style={{
                        clipPath: `inset(${clipY}% 0% 0% 0%)`,
                    }}
                />
            </div>

            {/* Marca */}
            <div className="loading-brand">CYRANO<span>APP</span></div>
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
