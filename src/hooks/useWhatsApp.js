// src/hooks/useWhatsApp.js
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { enviarWhatsApp } from "../utils/whatsapp";

export function useWhatsApp() {
    const { user } = useAuth();
    const [config, setConfig] = useState(null); // { whatsappNum, callmebotKey }

    useEffect(() => {
        if (!user?.uid) return;
        getDoc(doc(db, "usuarios", user.uid))
            .then(snap => {
                if (!snap.exists()) return;
                const { whatsappNum, callmebotKey } = snap.data();
                if (whatsappNum && callmebotKey) setConfig({ whatsappNum, callmebotKey });
            })
            .catch(() => setConfig(null));
    }, [user?.uid]);

    const enviar = (texto) => {
        if (!config) return Promise.reject("Sin configuración de WhatsApp");
        return enviarWhatsApp(config.whatsappNum, config.callmebotKey, texto);
    };

    return { configurado: !!config, enviar };
}
