import React from 'react';
import './CyranoScreen.css';

const flags = [
    { name: 'Argentina', src: 'https://flagcdn.com/ar.svg' },
    { name: 'Bolivia', src: 'https://flagcdn.com/bo.svg' },
    { name: 'Brasil', src: 'https://flagcdn.com/br.svg' },
    { name: 'Chile', src: 'https://flagcdn.com/cl.svg' },
    { name: 'Colombia', src: 'https://flagcdn.com/co.svg' },
    { name: 'Costa Rica', src: 'https://flagcdn.com/cr.svg' },
    { name: 'Cuba', src: 'https://flagcdn.com/cu.svg' },
    { name: 'Ecuador', src: 'https://flagcdn.com/ec.svg' },
    { name: 'El Salvador', src: 'https://flagcdn.com/sv.svg' },
    { name: 'Guatemala', src: 'https://flagcdn.com/gt.svg' },
    { name: 'Haití', src: 'https://flagcdn.com/ht.svg' },
    { name: 'Honduras', src: 'https://flagcdn.com/hn.svg' },
    { name: 'México', src: 'https://flagcdn.com/mx.svg' },
    { name: 'Nicaragua', src: 'https://flagcdn.com/ni.svg' },
    { name: 'Panamá', src: 'https://flagcdn.com/pa.svg' },
    { name: 'Paraguay', src: 'https://flagcdn.com/py.svg' },
    { name: 'Perú', src: 'https://flagcdn.com/pe.svg' },
    { name: 'Puerto Rico', src: 'https://flagcdn.com/pr.svg' },
    { name: 'Rep. Dominicana', src: 'https://flagcdn.com/do.svg' },
    { name: 'Uruguay', src: 'https://flagcdn.com/uy.svg' },
    { name: 'Venezuela', src: 'https://flagcdn.com/ve.svg' },
];

const CyranoScreen = () => {
    return (
        <div className="cyrano-container">
            <header className="cyrano-header">
                <div className="logo-wrapper">
                    {/* Usando el logo del león con fondo transparente */}
                    <img src="https://i.ibb.co/LhY0mYV/leon-transparent.png" alt="Cyrano Logo" className="leon-logo" />
                </div>
                <div className="text-content">
                    <h1 className="main-title">Cyrano</h1>
                    <h2 className="sub-title">Latinoamérica</h2>
                    <p className="tagline">El software más completo para gestión de seguridad</p>
                </div>
            </header>

            <main className="flags-grid">
                {flags.map((flag) => (
                    <div key={flag.name} className="flag-card">
                        <img src={flag.src} alt={flag.name} title={flag.name} />
                    </div>
                ))}
            </main>
        </div>
    );
};

export default CyranoScreen;