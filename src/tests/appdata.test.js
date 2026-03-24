// src/tests/appdata.test.js
// Tests de funciones puras exportadas de AppDataContext.
import { describe, it, expect } from "vitest";
import { clasificarControl } from "../context/AppDataContext";

describe("clasificarControl", () => {

    // ── Turno nocturno ────────────────────────────────────────────────────────
    it("18:00 es nocturno (límite superior)", () => {
        expect(clasificarControl("18:00", "2025-01-15").turno).toBe("nocturno");
    });

    it("23:59 es nocturno", () => {
        expect(clasificarControl("23:59", "2025-01-15").turno).toBe("nocturno");
    });

    it("00:00 es nocturno (medianoche)", () => {
        expect(clasificarControl("00:00", "2025-01-15").turno).toBe("nocturno");
    });

    it("05:59 es nocturno (límite inferior nocturno)", () => {
        expect(clasificarControl("05:59", "2025-01-15").turno).toBe("nocturno");
    });

    // ── Turno diurno ──────────────────────────────────────────────────────────
    it("06:00 es diurno (inicio del turno diurno)", () => {
        expect(clasificarControl("06:00", "2025-01-15").turno).toBe("diurno");
    });

    it("09:00 es diurno", () => {
        expect(clasificarControl("09:00", "2025-01-15").turno).toBe("diurno");
    });

    it("17:59 es diurno (límite superior diurno)", () => {
        expect(clasificarControl("17:59", "2025-01-15").turno).toBe("diurno");
    });

    // ── Fin de semana ─────────────────────────────────────────────────────────
    // Usar hora local explícita para evitar ambigüedad de timezone (ISO date-only = midnight UTC)
    it("sábado (2025-01-18T12:00) es fin de semana", () => {
        expect(clasificarControl("10:00", "2025-01-18T12:00:00").esFinDeSemana).toBe(true);
    });

    it("domingo (2025-01-19T12:00) es fin de semana", () => {
        expect(clasificarControl("10:00", "2025-01-19T12:00:00").esFinDeSemana).toBe(true);
    });

    it("lunes (2025-01-20T12:00) NO es fin de semana", () => {
        expect(clasificarControl("10:00", "2025-01-20T12:00:00").esFinDeSemana).toBe(false);
    });

    it("viernes (2025-01-17T12:00) NO es fin de semana", () => {
        expect(clasificarControl("10:00", "2025-01-17T12:00:00").esFinDeSemana).toBe(false);
    });

    // ── Casos borde ───────────────────────────────────────────────────────────
    it("sin horaInicio devuelve diurno y no fin de semana", () => {
        const result = clasificarControl(null, "2025-01-15");
        expect(result.turno).toBe("diurno");
        expect(result.esFinDeSemana).toBe(false);
    });

    it("sin fechaISO no marca fin de semana", () => {
        const result = clasificarControl("10:00", null);
        expect(result.esFinDeSemana).toBe(false);
    });

    it("hora con minutos — 18:30 es nocturno", () => {
        expect(clasificarControl("18:30", "2025-01-15").turno).toBe("nocturno");
    });

    it("hora con minutos — 05:30 es nocturno", () => {
        expect(clasificarControl("05:30", "2025-01-15").turno).toBe("nocturno");
    });
});
