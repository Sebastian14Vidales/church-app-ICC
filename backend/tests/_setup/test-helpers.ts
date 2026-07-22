import type { Express, Router } from "express";

/**
 * Helpers de testing para el módulo de Cursos (backend).
 *
 * Estos helpers viven en `backend/tests/_setup/` (carpeta de soporte, no
 * son tests). Sigue el patrón marcado por `AGENTS.md` §9:
 *   - sin `console.log` (vitest usa `expect` y `vi.fn()`),
 *   - sin `any` libre (se usa `unknown` controlado + cast mínimos),
 *   - determinismo: nada de Mongo real ni JWT real.
 *
 * El objetivo es reusable en los smoke tests de los tres routers
 * (`course.routes`, `course-assignment.routes`, `attendance.routes`)
 * montados bajo el mismo prefijo `/api/courses` ( ADR-0001 §D1 ).
 */

/**
 * Sesión autenticada de prueba. Se inyecta vía el header `x-test-auth`
 * gracias al mock de `middleware/auth.middleware`. Si el mock no la
 * encuentra, responde 401 como el middleware real.
 */
export type TestAuth = {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  profileId?: string | null;
};

export const authHeader = (auth: TestAuth): Record<string, string> => ({
  // El middleware real espera `Authorization: Bearer <token>`. El mock
  // ignora el token y lee `x-test-auth` (JSON) para decidir la sesión.
  // Mantenemos `Authorization` para que el extractor de bearer no falle
  // antes de entrar al mock y para que el test refleje el flujo real.
  Authorization: "Bearer test-token",
  "x-test-auth": JSON.stringify(auth),
});

/** Header sin sesión: equivalente a petición sin `Authorization`. */
export const noAuthHeader = (): Record<string, string> => ({});

/**
 * Construye una cadena thenable estilo Mongoose.
 *
 * Los controllers hacen `await Course.find(filter).sort(...).skip(...).limit(...)`.
 * Para mockearlo sin importar Mongo, devolvemos un objeto que:
 *   - expone `sort`, `skip`, `limit`, `populate`, `lean`, `exec` que
 *     devuelven la propia cadena (fluent),
 *   - es thenable (`then`) → se resuelve con `items` al hacer `await`.
 *
 * No incluye métodos que no se usen en los smoke tests actuales; se
 * pueden añadir sin romper la jerarquía.
 */
type Chainable<T> = {
  sort: () => Chainable<T>;
  skip: () => Chainable<T>;
  limit: () => Chainable<T>;
  populate: () => Chainable<T>;
  lean: () => Chainable<T>;
  exec: () => Promise<T>;
  then: <U>(onfulfilled: (value: T) => U | PromiseLike<U>) => Promise<U>;
};

export const chainable = <T>(items: T): Chainable<T> => {
  const self: Chainable<T> = {
    sort: () => self,
    skip: () => self,
    limit: () => self,
    populate: () => self,
    lean: () => self,
    exec: () => Promise.resolve(items),
    then: <U>(onfulfilled: (value: T) => U | PromiseLike<U>) =>
      Promise.resolve(items).then(onfulfilled),
  };
  return self;
};

/**
 * Monta un router bajo el prefijo `/api/courses` en una app Express
 * nueva, sin `connectDB`, sin `seedDatabase` y sin CORS (no se necesita
 * para Supertest). Pensado para smoke tests por router.
 *
 * El orden de montaje de los tres routers lo controla cada test
 * explícitamente (ver `server.ts`): aquí no imponemos orden global.
 */
export const mountUnderCoursesPrefix = (router: Router): Express => {
  // Express 5: `express` por defecto es la función factory; `express.json()`
  // está disponible. Se importa dinámicamente para no acoplar este helper
  // a un único test file.
  const express = require("express") as typeof import("express");
  const app = express();
  app.use(express.json());
  app.use("/api/courses", router);
  return app;
};

/** MongoId válido para los tests (24 hex). */
export const VALID_ID = "65a1f0c0c1d2a3b4f5e6f7a8";
/** Otro MongoId válido, distinto del anterior. */
export const OTHER_VALID_ID = "65a1f0c0c1d2a3b4f5e6f7a9";
/** String que NO es MongoId (para asserts de 400). */
export const INVALID_ID = "not-a-mongoid";