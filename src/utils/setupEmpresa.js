// src/utils/setupEmpresa.js
// Inicializa la estructura Firestore completa de una empresa nueva.
// Se llama una sola vez al crear la empresa desde el panel Super Admin.
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const TIPOS_ACTIVIDAD_DEFAULT = [
    "Reparaciones (taller)",
    "Traslado de personal",
    "Traslado de elementos",
    "Tareas administrativas",
    "Análisis de vulnerabilidades",
    "Análisis de riesgos",
    "Atención de reclamos",
    "Reunión con cliente",
    "Visita Gremial",
    "Almuerzo/Cena",
    "Otras actividades",
];

/**
 * Crea los documentos de configuración base para una empresa nueva.
 * El admin de la empresa completa el resto desde la app.
 *
 * @param {string} empresaId  ID de la empresa en Firestore
 * @param {string} nombre     Nombre visible de la empresa
 * @param {object} modulos    Mapa { key: boolean } de módulos habilitados
 */
export async function setupEmpresa(empresaId, nombre, modulos = {}) {
    // Config operativa — el admin la llena desde Configuración
    await setDoc(doc(db, "empresas", empresaId, "datos", "config_global"), {
        config: {
            supervisorEmail: "",
            vehiculos:       [],
            objetivos:       [],
            vigiladores:     [],
            supervisores:    [],
            tiposActividad:  TIPOS_ACTIVIDAD_DEFAULT,
        },
        updatedAt: serverTimestamp(),
    });

    // Plan de supervisión vacío
    await setDoc(doc(db, "empresas", empresaId, "datos", "plan_global"), {
        objetivos: [],
        updatedAt: serverTimestamp(),
    });

    // Planes de supervisores vacío
    await setDoc(doc(db, "empresas", empresaId, "datos", "planes_super"), {
        planes:    {},
        updatedAt: serverTimestamp(),
    });
}
