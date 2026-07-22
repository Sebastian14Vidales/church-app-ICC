import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";

import { AppError, handleControllerError } from "../../src/services/app-error";

/**
 * Tests unitarios de `app-error.ts` (introducido en EPC-COURSES-001 paso 5).
 *
 * Cubre:
 *   - Construction de `AppError` (status + message + name).
 *   - `handleControllerError` con `AppError` → responde `status` + `message`.
 *   - `handleControllerError` con error Mongo duplicate-key (code 11000) → 409
 *     con `duplicateKeyMessage` cuando se provee.
 *   - `handleControllerError` con error Mongo duplicate-key pero SIN
 *     `duplicateKeyMessage` → cae al fallback 500 (rama `duplicateKeyMessage`
 *     chequeada falsy).
 *   - `handleControllerError` con error genérico → 500 con `defaultMessage`.
 *
 * Sin `console.log`, sin `any`. Respuestas mockeadas mediante un stub de
 * `Response` con `status`/`json` encadenable estilo Express.
 */
type ResStub = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} & Response;

const resStub = (): ResStub => {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as ResStub;
};

describe("AppError", () => {
  it("construye con status y message y hereda de Error", () => {
    const error = new AppError(409, "conflicto");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("conflicto");
    expect(error.name).toBe("AppError");
  });
});

describe("handleControllerError", () => {
  it("mapea AppError a su status y message", () => {
    const res = resStub();
    handleControllerError(res, new AppError(404, "Asignacion no encontrada"), "default");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Asignacion no encontrada" });
  });

  it("mapea duplicate-key (code 11000) a 409 cuando se provee duplicateKeyMessage", () => {
    const res = resStub();
    const error: NodeJS.ErrnoException = Object.assign(new Error("dup"), {
      code: 11000,
    });
    handleControllerError(
      res,
      error,
      "Error al asignar curso",
      "Este profesor ya tiene un curso activo asignado",
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Este profesor ya tiene un curso activo asignado",
    });
  });

  it("cae al 500 default cuando duplicate-key ocurre sin duplicateKeyMessage", () => {
    const res = resStub();
    const error: NodeJS.ErrnoException = Object.assign(new Error("dup"), {
      code: 11000,
    });
    handleControllerError(res, error, "Error al asignar curso");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Error al asignar curso" });
  });

  it("responde 500 defaultMessage para errores genéricos", () => {
    const res = resStub();
    handleControllerError(res, new Error("boom"), "Error al cerrar el curso");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Error al cerrar el curso" });
  });

  it("responde 500 default cuando error no es objeto con code", () => {
    const res = resStub();
    // Cadena: `error instanceof Object` falso; no entra ramas válidas.
    handleControllerError(res, "cadenota", "Error al reabrir el curso");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Error al reabrir el curso" });
  });
});