// src/screens/LoadingScreen.jsx
import { useState, useEffect, useRef } from "react";
import "../styles/LoadingScreen.css";

const MESSAGES_SPLASH = [
    "Iniciando sistema...",
    "Verificando módulos...",
    "Cargando configuración...",
    "Preparando interfaz...",
    "Listo.",
];

const MESSAGES_POST = [
    "Autenticando usuario...",
    "Conectando con Firebase...",
    "Cargando datos...",
    "Sincronizando jornadas...",
    "Listo.",
];

export default function LoadingScreen({ onFinished, postLogin = false, userName = "", dbReady = false }) {
    const [progress, setProgress] = useState(0);
    const [exiting,  setExiting]  = useState(false);
    const doneRef = useRef(false);

    const MESSAGES = postLogin ? MESSAGES_POST : MESSAGES_SPLASH;

    const finish = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        setProgress(100);
        setExiting(true);
        setTimeout(onFinished, 900);
    };

    useEffect(() => {
        if (!postLogin) {
            // Splash pre-login: timer fijo de 3.5s
            const duration = 5000;
            const intervalTime = 50;
            const increment = 100 / (duration / intervalTime);
            const timer = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) { clearInterval(timer); finish(); return 100; }
                    return Math.min(prev + increment, 100);
                });
            }, intervalTime);
            return () => clearInterval(timer);
        } else {
            // Post-login: avanza hasta 85% en ~1.7s, luego queda esperando
            const timer = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 85) { clearInterval(timer); return 85; }
                    return Math.min(prev + 2, 85);
                });
            }, 56);
            return () => clearInterval(timer);
        }
    }, []);

    // Post-login: cuando dbReady=true O tras 2s, completar la barra hasta 100% y LUEGO salir
    useEffect(() => {
        if (!postLogin) return;
        const runFinish = () => {
            if (doneRef.current) return;
            // Completar barra de 85→100% en ~600ms, luego salir
            const fillTimer = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) {
                        clearInterval(fillTimer);
                        finish();
                        return 100;
                    }
                    return Math.min(prev + 1, 100);
                });
            }, 40);
        };
        const minWait = setTimeout(runFinish, 4000);
        return () => clearTimeout(minWait);
    }, []);

    useEffect(() => {
        if (!postLogin || !dbReady) return;
        const runFinish = () => {
            if (doneRef.current) return;
            const fillTimer = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) {
                        clearInterval(fillTimer);
                        finish();
                        return 100;
                    }
                    return Math.min(prev + 1, 100);
                });
            }, 40);
        };
        const t = setTimeout(runFinish, 300);
        return () => clearTimeout(t);
    }, [dbReady]);

    const msgIdx = Math.min(
        Math.floor((progress / 100) * MESSAGES.length),
        MESSAGES.length - 1
    );

    const clipY = 100 - progress;

    return (
        <div className={`loading-screen${exiting ? " exit" : ""}`}>
            <div className="loading-bg" />

            <div className="loading-logo-wrap">
                <img src="/images/png-transparent-logo.png" alt="" className="loading-logo-base" />
                <img
                    src="/images/png-transparent-logo.png"
                    alt="Cyrano App"
                    className="loading-logo-fill"
                    style={{ clipPath: `inset(${clipY}% 0% 0% 0%)` }}
                />
            </div>

            <div className="loading-brand">CYRANO<span>APP</span></div>

            {postLogin && userName ? (
                <div className="loading-tagline">
                    Bienvenido, <strong>{userName.split(" ")[0]}</strong>
                </div>
            ) : (
                <div className="loading-tagline">Supervisión &amp; Seguridad</div>
            )}

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
