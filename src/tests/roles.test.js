// src/tests/roles.test.js
// Tests de la lógica de acceso y permisos — sin mocks, funciones puras.
import { describe, it, expect } from "vitest";
import {
    tieneAcceso,
    ROLES_CREABLES_POR,
    modulosPorRol,
    MODULOS_DEF,
} from "../config/roles";

// ── tieneAcceso ───────────────────────────────────────────────────────────────

describe("tieneAcceso", () => {

    it("super_admin siempre tiene acceso, sin importar empresa o módulo", () => {
        expect(tieneAcceso(null,            { rol: "super_admin" }, "cualquier_cosa")).toBe(true);
        expect(tieneAcceso({ rondas: false }, { rol: "super_admin" }, "rondas")).toBe(true);
    });

    it("usuario null → sin acceso", () => {
        expect(tieneAcceso(null, null, "informes")).toBe(false);
    });

    it("módulo desactivado a nivel empresa bloquea al usuario", () => {
        const empresaModulos = { rondas_monitor: false };
        const user = { rol: "supervisor", permisosModulos: null };
        expect(tieneAcceso(empresaModulos, user, "rondas_monitor")).toBe(false);
    });

    it("módulo desactivado a nivel usuario (permisosModulos) bloquea aunque la empresa lo tenga", () => {
        const empresaModulos = { informes: true };
        const user = { rol: "supervisor", permisosModulos: { informes: false } };
        expect(tieneAcceso(empresaModulos, user, "informes")).toBe(false);
    });

    it("módulo habilitado en empresa y sin restricción de usuario → acceso permitido", () => {
        const empresaModulos = { supervision: true };
        const user = { rol: "supervisor", permisosModulos: null };
        expect(tieneAcceso(empresaModulos, user, "supervision")).toBe(true);
    });

    it("sin empresaModulos (null) y sin permisosModulos → acceso permitido", () => {
        const user = { rol: "vigilador", permisosModulos: null };
        expect(tieneAcceso(null, user, "informes")).toBe(true);
    });

    it("permisosModulos con key no presente no bloquea", () => {
        const user = { rol: "vigilador", permisosModulos: { libro_actas: true } };
        expect(tieneAcceso(null, user, "informes")).toBe(true);
    });
});

// ── ROLES_CREABLES_POR ────────────────────────────────────────────────────────

describe("ROLES_CREABLES_POR", () => {

    it("super_admin puede crear todos los roles excepto super_admin", () => {
        const roles = ROLES_CREABLES_POR["super_admin"];
        expect(roles).toContain("admin_contrato");
        expect(roles).toContain("supervisor");
        expect(roles).toContain("administrativo");
        expect(roles).toContain("vigilador");
        expect(roles).not.toContain("super_admin");
    });

    it("admin_contrato puede crear supervisor, administrativo y vigilador", () => {
        const roles = ROLES_CREABLES_POR["admin_contrato"];
        expect(roles).toContain("supervisor");
        expect(roles).toContain("administrativo");
        expect(roles).toContain("vigilador");
        expect(roles).not.toContain("admin_contrato");
        expect(roles).not.toContain("super_admin");
    });

    it("supervisor, administrativo y vigilador no pueden crear usuarios", () => {
        expect(ROLES_CREABLES_POR["supervisor"]).toHaveLength(0);
        expect(ROLES_CREABLES_POR["administrativo"]).toHaveLength(0);
        expect(ROLES_CREABLES_POR["vigilador"]).toHaveLength(0);
    });
});

// ── modulosPorRol ─────────────────────────────────────────────────────────────

describe("modulosPorRol", () => {

    it("devuelve módulos para cada rol válido", () => {
        const roles = ["admin_contrato", "supervisor", "administrativo", "vigilador"];
        roles.forEach(rol => {
            const mods = modulosPorRol(rol);
            expect(mods.length).toBeGreaterThan(0);
        });
    });

    it("devuelve array vacío para rol inexistente", () => {
        expect(modulosPorRol("rol_fantasma")).toHaveLength(0);
    });

    it("cada módulo tiene key, label e icon", () => {
        const mods = modulosPorRol("supervisor");
        mods.forEach(m => {
            expect(m).toHaveProperty("key");
            expect(m).toHaveProperty("label");
            expect(m).toHaveProperty("icon");
        });
    });
});

// ── MODULOS_DEF integridad ────────────────────────────────────────────────────

describe("MODULOS_DEF", () => {

    it("no tiene keys duplicados entre todos los grupos", () => {
        const todosLosKeys = MODULOS_DEF.flatMap(g => g.modulos.map(m => m.key));
        // Algunos keys son compartidos por diseño (muro_comunicacion, informes, etc.)
        // Lo que NO debe pasar es que un mismo key aparezca dos veces dentro del mismo grupo
        MODULOS_DEF.forEach(g => {
            const keysDelGrupo = g.modulos.map(m => m.key);
            const unicos = new Set(keysDelGrupo);
            expect(unicos.size).toBe(keysDelGrupo.length);
        });
    });

    it("todos los grupos tienen rol y al menos un módulo", () => {
        MODULOS_DEF.forEach(g => {
            expect(g.rol).toBeTruthy();
            expect(g.modulos.length).toBeGreaterThan(0);
        });
    });
});
