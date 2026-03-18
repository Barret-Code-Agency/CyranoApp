// src/screens/MigrateUtil.jsx
// Herramienta de migración única — eliminar después de usar
import { useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const MIGRACION = [
    { email: "supervision.brinks@gmail.com", rol: "super_admin",    empresaId: "brinks" },
    { email: "fdelgado@brinks.com.ar",        rol: "admin_empresa",  empresaId: "brinks" },
    { email: "rgirelli@brinks.com.ar",        rol: "admin_contrato", empresaId: "brinks" },
];

export default function MigrateUtil({ onDone }) {
    const [log,     setLog]     = useState([]);
    const [running, setRunning] = useState(false);
    const [done,    setDone]    = useState(false);

    const addLog = (msg, ok = true) =>
        setLog(prev => [...prev, { msg, ok }]);

    const ejecutar = async () => {
        setRunning(true);
        setLog([]);
        try {
            const snap = await getDocs(collection(db, "usuarios"));
            let actualizados = 0;

            for (const d of snap.docs) {
                const data  = d.data();
                const match = MIGRACION.find(m => m.email === data.email);
                if (match) {
                    await updateDoc(doc(db, "usuarios", d.id), {
                        rol:       match.rol,
                        empresaId: match.empresaId,
                    });
                    addLog(`✅  ${data.email}  →  ${match.rol}`);
                    actualizados++;
                }
            }

            if (actualizados === 0) {
                addLog("⚠️  No se encontró ningún usuario. Verificá que existan en Firestore.", false);
            } else {
                addLog(`✔  ${actualizados} usuario/s migrados correctamente.`);
                setDone(true);
            }
        } catch (e) {
            addLog("❌  Error: " + e.message, false);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center",
            justifyContent: "center", background: "#0d1117", padding: 24,
        }}>
            <div style={{
                width: "100%", maxWidth: 480,
                background: "#161b22", borderRadius: 12,
                border: "1px solid #30363d", padding: 32,
                fontFamily: "monospace",
            }}>
                <div style={{ color: "#58a6ff", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
                    🛠 Migración de usuarios
                </div>
                <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 24 }}>
                    Asigna el campo <code style={{ color: "#79c0ff" }}>rol</code> y <code style={{ color: "#79c0ff" }}>empresaId</code> a los usuarios existentes en Firestore.
                </div>

                <div style={{ marginBottom: 20 }}>
                    {MIGRACION.map(u => (
                        <div key={u.email} style={{
                            display: "flex", justifyContent: "space-between",
                            padding: "6px 0", borderBottom: "1px solid #21262d",
                            fontSize: 13,
                        }}>
                            <span style={{ color: "#c9d1d9" }}>{u.email}</span>
                            <span style={{ color: "#56d364", fontWeight: 600 }}>{u.rol}</span>
                        </div>
                    ))}
                </div>

                {log.length > 0 && (
                    <div style={{
                        background: "#0d1117", borderRadius: 8, padding: 14,
                        marginBottom: 20, fontSize: 13, lineHeight: 2,
                    }}>
                        {log.map((l, i) => (
                            <div key={i} style={{ color: l.ok ? "#56d364" : "#f85149" }}>
                                {l.msg}
                            </div>
                        ))}
                    </div>
                )}

                {!done ? (
                    <button
                        onClick={ejecutar}
                        disabled={running}
                        style={{
                            width: "100%", padding: "12px 0",
                            background: running ? "#21262d" : "#238636",
                            border: "1px solid #2ea043",
                            borderRadius: 8, color: "#fff",
                            fontSize: 14, fontWeight: 700,
                            cursor: running ? "not-allowed" : "pointer",
                            fontFamily: "monospace",
                        }}
                    >
                        {running ? "⏳ Ejecutando..." : "▶  Ejecutar migración"}
                    </button>
                ) : (
                    <button
                        onClick={onDone}
                        style={{
                            width: "100%", padding: "12px 0",
                            background: "#1f6feb", border: "1px solid #388bfd",
                            borderRadius: 8, color: "#fff",
                            fontSize: 14, fontWeight: 700,
                            cursor: "pointer", fontFamily: "monospace",
                        }}
                    >
                        ✔  Listo — ir al sistema
                    </button>
                )}
            </div>
        </div>
    );
}
