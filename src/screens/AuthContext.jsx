// src/context/AuthContext.jsx
// Maneja autenticación Firebase + roles desde Firestore
// Reemplaza loginDemo de helpers.js

import { createContext, useContext, useState, useEffect } from "react";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    createUserWithEmailAndPassword,
    updateProfile,
} from "firebase/auth";
import {
    doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

// ── Helpers Firestore ─────────────────────────────────────────────────────────
const getUserDoc = (uid) => doc(db, "usuarios", uid);
const getUsuarios = () => collection(db, "usuarios");

export async function fetchUserData(uid) {
    const snap = await getDoc(getUserDoc(uid));
    return snap.exists() ? snap.data() : null;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);   // { uid, email, name, role, activo }
    const [loading, setLoading] = useState(true);   // mientras Firebase resuelve la sesión

    // Escuchar cambios de sesión Firebase
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const data = await fetchUserData(firebaseUser.uid);
                if (data && data.activo !== false) {
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        name: data.nombre || firebaseUser.email.split("@")[0],
                        role: data.rol || "operator",
                        activo: data.activo !== false,
                        zona: data.zona || null,
                        objetivosVisibles: data.objetivosVisibles || null,
                        vehiculosVisibles: data.vehiculosVisibles || null,
                        esAnalista: data.esAnalista === true,
                        supervisoresVisibles: data.supervisoresVisibles || null,
                    });
                } else {
                    // Usuario desactivado o sin datos → forzar logout
                    await signOut(auth);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    // ── Login ────────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const data = await fetchUserData(cred.user.uid);

        if (!data) throw new Error("Usuario no configurado. Contactá al administrador.");
        if (data.activo === false) {
            await signOut(auth);
            throw new Error("Tu cuenta está desactivada. Contactá al administrador.");
        }

        // Actualizar último acceso
        await updateDoc(getUserDoc(cred.user.uid), { ultimoAcceso: serverTimestamp() });

        return {
            uid: cred.user.uid,
            email: cred.user.email,
            name: data.nombre,
            role: data.rol || "operator",
            zona: data.zona || null,
            objetivosVisibles: data.objetivosVisibles || null,
            vehiculosVisibles: data.vehiculosVisibles || null,
            esAnalista: data.esAnalista === true,
            supervisoresVisibles: data.supervisoresVisibles || null,
        };
    };

    // ── Logout ───────────────────────────────────────────────────────────────
    const logout = async () => {
        await signOut(auth);
        setUser(null);
    };

    // ── Crear usuario (solo admin) ────────────────────────────────────────────
    // Crea la cuenta en Firebase Auth + documento en Firestore
    const crearUsuario = async ({ email, password, nombre, rol }) => {
        // Firebase crea la cuenta con la sesión del admin
        // Usamos una app secundaria para no perder la sesión del admin
        const { initializeApp } = await import("firebase/app");
        const { getAuth, createUserWithEmailAndPassword: crear } = await import("firebase/auth");

        const secondaryApp = initializeApp(auth.app.options, "secondary_" + Date.now());
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const cred = await crear(secondaryAuth, email.trim(), password);
            await updateProfile(cred.user, { displayName: nombre });

            // Guardar en Firestore
            await setDoc(getUserDoc(cred.user.uid), {
                nombre,
                email: email.trim(),
                rol: rol || "operator",
                activo: true,
                creadoEn: serverTimestamp(),
                ultimoAcceso: null,
            });

            await secondaryAuth.signOut();
            return cred.user.uid;
        } finally {
            const { deleteApp } = await import("firebase/app");
            await secondaryAuth.signOut();
            await deleteApp(secondaryApp);
        }
    };

    // ── Actualizar datos de usuario ───────────────────────────────────────────
    const actualizarUsuario = async (uid, datos) => {
        await updateDoc(getUserDoc(uid), datos);
    };

    // ── Reset de contraseña (envía mail automático) ───────────────────────────
    const resetPassword = async (email) => {
        await sendPasswordResetEmail(auth, email);
    };

    // ── Listar todos los usuarios ─────────────────────────────────────────────
    const listarUsuarios = async () => {
        const snap = await getDocs(getUsuarios());
        return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    };

    return (
        <AuthContext.Provider value={{
            user, loading,
            login, logout,
            crearUsuario, actualizarUsuario, resetPassword, listarUsuarios,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
    return ctx;
}
