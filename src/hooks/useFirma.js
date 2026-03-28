// src/hooks/useFirma.js
// Hook para firmar documentos electrónicamente desde cualquier pantalla.

import { useState } from "react";
import { firmarDocumento } from "../utils/firma";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";

export function useFirma() {
    const { user }      = useAuth();
    const { empresaId } = useAppData();

    const [firmando,    setFirmando]    = useState(false);
    const [firmaResult, setFirmaResult] = useState(null);  // { hash, firmaId }
    const [firmaError,  setFirmaError]  = useState(null);

    // Firma un documento y devuelve { hash, firmaId }
    const firmar = async ({ tipo, datos, legajo = null, referenciaId = null }) => {
        setFirmando(true);
        setFirmaError(null);
        try {
            const result = await firmarDocumento({
                tipo,
                datos,
                empresaId:    user?.empresaId || empresaId || null,
                uid:          user?.uid,
                displayName:  user?.name || user?.displayName || "",
                email:        user?.email || "",
                legajo:       legajo || user?.legajo || null,
                referenciaId,
            });
            setFirmaResult(result);
            return result;
        } catch (e) {
            setFirmaError(e.message || "Error al firmar");
            throw e;
        } finally {
            setFirmando(false);
        }
    };

    const resetFirma = () => {
        setFirmaResult(null);
        setFirmaError(null);
    };

    return { firmar, firmando, firmaResult, firmaError, resetFirma };
}
