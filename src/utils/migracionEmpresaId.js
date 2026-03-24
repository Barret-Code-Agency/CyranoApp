// src/utils/migracionEmpresaId.js
// Script de migración ONE-TIME: agrega el campo empresaId a todos los documentos
// que usan el campo legacy "empresa" (nombre) en lugar de "empresaId" (ID).
//
// El mapeo nombre → ID se construye DINÁMICAMENTE leyendo la colección "empresas"
// de Firestore, por lo que funciona para cualquier empresa sin hardcodear nada.
//
// IMPORTANTE: Solo escribe en documentos que NO tienen empresaId ya.
// Es seguro correr múltiples veces (idempotente).

import {
    collection, getDocs, writeBatch, doc,
} from "firebase/firestore";
import { db } from "../firebase";

// Colecciones a migrar y el campo que usan como fuente del nombre
const COLECCIONES = [
    { nombre: "legajos",               campoFuente: "empresa" },
    { nombre: "informes",              campoFuente: "empresa" },
    { nombre: "programacionServicios", campoFuente: "empresa" },
    { nombre: "objetivos",             campoFuente: "empresa" },
    { nombre: "clientes",              campoFuente: "empresa" },
    { nombre: "comunicaciones",        campoFuente: "empresa" },
    { nombre: "plantillasRonda",       campoFuente: "empresa" },
    { nombre: "rondas",                campoFuente: "empresa" },
    { nombre: "procedimientos",        campoFuente: "empresa" },
    { nombre: "capacitaciones",        campoFuente: "empresa" },
    { nombre: "diagramas14x14",        campoFuente: "empresa" },
    { nombre: "conductores",           campoFuente: "empresa" },
    { nombre: "encargados",            campoFuente: "empresa" },
    { nombre: "supervisores",          campoFuente: "empresa" },
    { nombre: "vehiculos",             campoFuente: "empresa" },
    { nombre: "ingresosTurno",         campoFuente: "empresa" },
    { nombre: "planCapacitacion",      campoFuente: "empresa" },
    { nombre: "admins",                campoFuente: "empresa" },
];

/**
 * Construye el mapa nombre → empresaId leyendo la colección "empresas" de Firestore.
 * También incluye variantes comunes del nombre (con/sin puntuación, mayúsculas, etc).
 */
async function construirMapaNombres(onProgress) {
    const mapa = {};
    try {
        const snap = await getDocs(collection(db, "empresas"));
        snap.docs.forEach(d => {
            const id     = d.id;                    // empresaId canónico
            const nombre = d.data().nombre || "";   // nombre visible
            if (!nombre) return;
            // Mapear el nombre exacto y algunas variantes
            mapa[nombre]             = id;
            mapa[nombre.trim()]      = id;
            mapa[nombre.toLowerCase()] = id;
            // Variante sin puntuación: "Brinks Argentina S.A." → "Brinks Argentina SA"
            mapa[nombre.replace(/\./g, "").trim()] = id;
        });
        onProgress?.(`🗺️  Mapa de empresas construido: ${snap.size} empresa(s) encontrada(s)`);
    } catch (e) {
        onProgress?.(`⚠️  No se pudo leer colección "empresas": ${e.message}. Usando mapa vacío.`);
    }
    return mapa;
}

/**
 * Migra una colección: agrega empresaId a docs que no lo tienen.
 * Firestore admite máx 500 writes por batch.
 */
async function migrarColeccion(colNombre, campoFuente, mapaEmpresa, onProgress) {
    const snap = await getDocs(collection(db, colNombre));
    const docsAMigrar = snap.docs.filter(d => {
        const data = d.data();
        // Ya tiene empresaId → no tocar
        if (data.empresaId) return false;
        // Tiene campo fuente → migrar
        return !!data[campoFuente];
    });

    if (docsAMigrar.length === 0) {
        onProgress?.(`${colNombre}: ya migrada o vacía`);
        return { coleccion: colNombre, migrados: 0, sinMapeo: 0 };
    }

    let migrados  = 0;
    let sinMapeo  = 0;
    let batch     = writeBatch(db);
    let enBatch   = 0;

    for (const d of docsAMigrar) {
        const data      = d.data();
        const nombreEmp = (data[campoFuente] ?? "").trim();
        // Buscar en el mapa con el nombre exacto, en minúsculas, o sin puntuación
        const empresaId =
            mapaEmpresa[nombreEmp] ||
            mapaEmpresa[nombreEmp.toLowerCase()] ||
            mapaEmpresa[nombreEmp.replace(/\./g, "").trim()];

        if (!empresaId) {
            sinMapeo++;
            onProgress?.(`⚠️  ${colNombre}/${d.id}: sin mapeo para "${nombreEmp}"`);
            continue;
        }

        batch.update(doc(db, colNombre, d.id), { empresaId });
        enBatch++;
        migrados++;

        // Commit cada 499 docs (límite Firestore: 500 por batch)
        if (enBatch === 499) {
            await batch.commit();
            batch   = writeBatch(db);
            enBatch = 0;
        }
    }

    if (enBatch > 0) await batch.commit();

    onProgress?.(`✅ ${colNombre}: ${migrados} migrados, ${sinMapeo} sin mapeo`);
    return { coleccion: colNombre, migrados, sinMapeo };
}

/**
 * Punto de entrada principal.
 * @param {function} onProgress  Callback (string) para mostrar progreso en UI
 * @returns {Promise<Array>}     Resultados por colección
 */
export async function correrMigracion(onProgress) {
    // Construir mapa dinámico desde Firestore
    const mapaEmpresa = await construirMapaNombres(onProgress);

    const resultados = [];
    for (const { nombre, campoFuente } of COLECCIONES) {
        try {
            const r = await migrarColeccion(nombre, campoFuente, mapaEmpresa, onProgress);
            resultados.push(r);
        } catch (err) {
            onProgress?.(`❌ Error en ${nombre}: ${err.message}`);
            resultados.push({ coleccion: nombre, error: err.message });
        }
    }
    return resultados;
}
