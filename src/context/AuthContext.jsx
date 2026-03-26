// src/context/AuthContext.jsx
// Autenticación Firebase + roles + permisos resueltos desde Firestore

import { createContext, useContext, useState, useEffect } from "react";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
} from "firebase/auth";
import {
    doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { resolverPermisos, ROLES_CREABLES_POR } from "../config/roles";

const AuthContext = createContext(null);

// ── Helpers Firestore ──────────────────────────────────────────────────────────
const getUserDoc  = (uid)  => doc(db, "usuarios", uid);
const getUsuarios = ()     => collection(db, "usuarios");

export async function fetchUserData(uid) {
    const snap = await getDoc(getUserDoc(uid));
    return snap.exists() ? snap.data() : null;
}

// Construye el objeto de usuario completo con permisos resueltos
function buildUser(uid, email, data) {
    const rol      = data.rol      ?? "vigilador";
    const permisos = resolverPermisos(rol, data.permisosOverride ?? {});
    return {
        uid,
        email,
        name:            data.nombre          ?? email.split("@")[0],
        rol,
        roles:           Array.isArray(data.roles) && data.roles.length ? data.roles : [rol],
        // compatibilidad hacia atrás (algunos componentes usan .role)
        role:            rol === "admin_contrato" || rol === "admin_empresa" || rol === "super_admin"
                            ? "admin" : "operator",
        empresaId:       data.empresaId       ?? null,
        contratoIds:     data.contratoIds     ?? [],
        cargo:           data.cargo           ?? null,
        permisos,
        permisosModulos: data.permisosModulos ?? null,
        activo:          data.activo !== false,
    };
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
    const [user,    setUser]    = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                let data = await fetchUserData(firebaseUser.uid);
                // Bootstrap super_admin sin doc en Firestore
                if (!data && firebaseUser.email === "supervision.brinks@gmail.com") {
                    data = { nombre: "Super Admin", email: firebaseUser.email, rol: "super_admin", activo: true };
                    await setDoc(getUserDoc(firebaseUser.uid), { ...data, creadoEn: serverTimestamp(), ultimoAcceso: null });
                }
                if (data && data.activo !== false) {
                    setUser(buildUser(firebaseUser.uid, firebaseUser.email, data));
                } else {
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

    // ── Login ──────────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        let data = await fetchUserData(cred.user.uid);

        // Bootstrap super_admin: si no tiene doc en usuarios, lo crea automáticamente
        if (!data && cred.user.email === "supervision.brinks@gmail.com") {
            data = {
                nombre:       "Super Admin",
                email:        cred.user.email,
                rol:          "super_admin",
                activo:       true,
                creadoEn:     serverTimestamp(),
                ultimoAcceso: null,
            };
            await setDoc(getUserDoc(cred.user.uid), data);
        }

        if (!data) throw new Error("Usuario no configurado. Contactá al administrador.");
        if (data.activo === false) {
            await signOut(auth);
            throw new Error("Tu cuenta está desactivada. Contactá al administrador.");
        }

        await updateDoc(getUserDoc(cred.user.uid), { ultimoAcceso: serverTimestamp() });

        return buildUser(cred.user.uid, cred.user.email, data);
    };

    // ── Logout ─────────────────────────────────────────────────────────────────
    const logout = async () => {
        await signOut(auth);
        setUser(null);
    };

    // ── Crear usuario ──────────────────────────────────────────────────────────
    // El creador solo puede asignar roles que tiene permitido (ROLES_CREABLES_POR)
    const crearUsuario = async ({
        email, password, nombre, rol,
        cargo        = "",
        empresaId    = null,
        contratoIds  = [],
        permisosOverride = {},
        zona         = null,
    }) => {
        const { initializeApp }                                  = await import("firebase/app");
        const { getAuth, createUserWithEmailAndPassword: crear } = await import("firebase/auth");

        const secondaryApp  = initializeApp(auth.app.options, "secondary_" + Date.now());
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const cred = await crear(secondaryAuth, email.trim(), password);
            await updateProfile(cred.user, { displayName: nombre });

            await setDoc(getUserDoc(cred.user.uid), {
                nombre,
                email:           email.trim(),
                rol:             rol ?? "vigilador",
                cargo:           cargo || "",
                empresaId,
                contratoIds,
                permisosOverride,
                activo:          true,
                zona:            zona || null,
                creadoEn:        serverTimestamp(),
                ultimoAcceso:    null,
            });

            return cred.user.uid;
        } finally {
            const { deleteApp } = await import("firebase/app");
            await secondaryAuth.signOut();
            await deleteApp(secondaryApp);
        }
    };

    // ── Actualizar usuario ─────────────────────────────────────────────────────
    const actualizarUsuario = async (uid, datos) => {
        await updateDoc(getUserDoc(uid), datos);
    };

    // ── Reset contraseña ───────────────────────────────────────────────────────
    const resetPassword = async (email) => {
        await sendPasswordResetEmail(auth, email);
    };

    // ── Listar usuarios ────────────────────────────────────────────────────────
    // Opcionalmente filtra por empresaId para que cada admin solo vea los suyos
    const listarUsuarios = async (empresaId = null) => {
        const snap = await getDocs(getUsuarios());
        const todos = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        if (empresaId) return todos.filter(u => u.empresaId === empresaId);
        return todos;
    };

    // ── Roles que puede crear el usuario actual ────────────────────────────────
    const rolesCreables = user ? (ROLES_CREABLES_POR[user.rol] ?? []) : [];

    return (
        <AuthContext.Provider value={{
            user, loading,
            login, logout,
            crearUsuario, actualizarUsuario, resetPassword, listarUsuarios,
            rolesCreables,
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
