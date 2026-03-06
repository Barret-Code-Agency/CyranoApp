import { useEffect, useState } from "react";
import '../styles/LatamMapSplash.css';

const flags = [
    { name: 'Argentina',       src: 'https://flagcdn.com/ar.svg' },
    { name: 'Bolivia',         src: 'https://flagcdn.com/bo.svg' },
    { name: 'Brasil',          src: 'https://flagcdn.com/br.svg' },
    { name: 'Chile',           src: 'https://flagcdn.com/cl.svg' },
    { name: 'Colombia',        src: 'https://flagcdn.com/co.svg' },
    { name: 'Costa Rica',      src: 'https://flagcdn.com/cr.svg' },
    { name: 'Cuba',            src: 'https://flagcdn.com/cu.svg' },
    { name: 'Ecuador',         src: 'https://flagcdn.com/ec.svg' },
    { name: 'El Salvador',     src: 'https://flagcdn.com/sv.svg' },
    { name: 'Guatemala',       src: 'https://flagcdn.com/gt.svg' },
    { name: 'Haití',           src: 'https://flagcdn.com/ht.svg' },
    { name: 'Honduras',        src: 'https://flagcdn.com/hn.svg' },
    { name: 'México',          src: 'https://flagcdn.com/mx.svg' },
    { name: 'Nicaragua',       src: 'https://flagcdn.com/ni.svg' },
    { name: 'Panamá',          src: 'https://flagcdn.com/pa.svg' },
    { name: 'Paraguay',        src: 'https://flagcdn.com/py.svg' },
    { name: 'Perú',            src: 'https://flagcdn.com/pe.svg' },
    { name: 'Puerto Rico',     src: 'https://flagcdn.com/pr.svg' },
    { name: 'Rep. Dominicana', src: 'https://flagcdn.com/do.svg' },
    { name: 'Uruguay',         src: 'https://flagcdn.com/uy.svg' },
    { name: 'Venezuela',       src: 'https://flagcdn.com/ve.svg' },
];

export default function LatamMapSplash({ onSelect }) {
    const [visible, setVisible] = useState(false);
    const [flagsVisible, setFlagsVisible] = useState([]);
    const [ctaVisible, setCtaVisible] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setVisible(true), 100);
        flags.forEach((_, i) => {
            setTimeout(() => setFlagsVisible(prev => [...prev, i]), 400 + i * 60);
        });
        const t2 = setTimeout(() => setCtaVisible(true), 400 + flags.length * 60 + 300);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    return (
        <div className="splash-root">
            <div className="splash-accent-bar" />

            <header className={`splash-header ${visible ? 'visible' : ''}`}>
                <div className="splash-logo-box">
                    <img src="./images/Leon.png" width="110" height="110" alt="Cyrano Logo" />
                </div>
                <div>
                    <h1 className="splash-title">Cyrano</h1>
                    <p className="splash-subtitle">Latinoamérica</p>
                    <p className="splash-tagline">El software más completo para gestión de seguridad</p>
                </div>
            </header>

            <div className="splash-divider" />

            <div className="splash-flags">
                {flags.map((flag, i) => (
                    <div key={flag.name} className={`flag-item ${flagsVisible.includes(i) ? 'shown' : ''}`}>
                        <div className="flag-card-inner">
                            <img src={flag.src} alt={flag.name} />
                            <div className="flag-name">{flag.name}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={`splash-cta ${ctaVisible ? 'visible' : ''}`}>
                <p className="splash-access-label">Acceder como</p>
                <div className="splash-role-btns">
                    <button className="role-btn role-btn--admin" onClick={() => onSelect("admin")}>
                        <span className="role-btn-icon">🔐</span>
                        <span className="role-btn-label">Administrador</span>
                    </button>
                    <button className="role-btn role-btn--sup" onClick={() => onSelect("supervisor")}>
                        <span className="role-btn-icon">👤</span>
                        <span className="role-btn-label">Usuario</span>
                    </button>
                </div>
            </div>
        </div>
    );
}