/**
 * Eliminación del índice legacy único sobre `{ professor: 1 }` en
 * `CourseAssigned` — epic EPC-COURSES-001 / ADR-0009 §D3.1.
 *
 * Responsable: database-engineer
 * Fecha: 2026-08-08
 *
 * ## Qué hace
 * El schema de `CourseAssigned` define el índice correcto
 * `course_assigned_unique_active_professor` como unique con
 * `partialFilterExpression: { status: "active", deletedAt: null }`.
 *
 * En producción todavía existe el índice autogenerado por Mongoose
 * `professor_1` (o similar) que es unique sobre `{ professor: 1 }` sin
 * `partialFilterExpression`. Ese índice legacy considera duplicados a los
 * documentos soft-deleted del mismo profesor, impidiendo reasignarle un
 * curso.
 *
 * Este script:
 *   1. Lista los índices de la colección `CourseAssigned`.
 *   2. Identifica y dropea de forma defensiva cualquier índice legacy que
 *      sea unique sobre `{ professor: 1 }` sin `partialFilterExpression` y
 *      cuyo nombre no sea el índice correcto del schema.
 *   3. Ejecuta `CourseAssigned.syncIndexes()` para materializar el índice
 *      correcto del schema.
 *
 * ## Cuándo ejecutarlo
 * - Una sola vez en producción (y opcional en dev) tras confirmar que el
 *   índice correcto `course_assigned_unique_active_professor` ya está
 *   presente.
 * - Idempotente: si el legacy ya no existe, no hace nada.
 *
 * ## Cómo ejecutarlo
 *   npm run migrate:courses-drop-legacy-professor-index
 *
 * O directamente con ts-node:
 *   npx ts-node backend/src/config/migrations/20260808-courses-drop-legacy-professor-index.ts
 *
 * ## Riesgo
 * Dropear el índice legacy es seguro porque:
 *   (a) el índice correcto con `partialFilterExpression` ya fue creado por
 *       `syncIndexes` en la migración previa, y
 *   (b) los fantasmas soft-deleted ya no aportan valor de negocio
 *       (ADR-0009 §D2/D3.1).
 *
 * La ventana de riesgo es breve: el índice correcto sigue garantizando la
 * unicidad de profesores activos mientras el legacy se elimina.
 *
 * ## Variable de entorno
 * `DATABASE_URL` (la que ya usa `backend/src/config/db.ts`).
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import CourseAssigned from "../../models/course-assigned.model";

dotenv.config();

/**
 * Subconjunto mínimo de los campos que devuelve
 * `collection.indexInformation({ full: true })` y que necesitamos para
 * identificar el índice legacy.
 */
export interface IndexInfo {
  v: number;
  key: Record<string, number>;
  name: string;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

const CORRECT_INDEX_NAME = "course_assigned_unique_active_professor";

/**
 * Determina si un índice es el legacy que debe eliminarse.
 *
 * Criterio defensivo:
 *   - La clave es exactamente `{ professor: 1 }`.
 *   - Es unique.
 *   - No tiene `partialFilterExpression`.
 *   - Su nombre NO es el del índice correcto del schema.
 */
export const isLegacyProfessorUniqueIndex = (index: IndexInfo): boolean => {
  const key = index.key || {};
  const keyFields = Object.keys(key);

  const hasOnlyProfessorKey =
    keyFields.length === 1 && keyFields[0] === "professor" && key.professor === 1;
  const isUnique = index.unique === true;
  const hasNoPartialFilter = !index.partialFilterExpression;
  const isNotCorrectName = index.name !== CORRECT_INDEX_NAME;

  return hasOnlyProfessorKey && isUnique && hasNoPartialFilter && isNotCorrectName;
};

const run = async (): Promise<void> => {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error(
      colors.red.bold(
        "MIGRATION-COURSES-DROP-LEGACY-PROFESSOR-INDEX: DATABASE_URL no definida en el entorno.",
      ),
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(db);
    console.log(
      colors.green.bold(
        "Connected to MongoDB for legacy professor index cleanup",
      ),
    );
  } catch (error) {
    console.error(
      colors.red.bold(
        "Error connecting to MongoDB during legacy professor index cleanup",
      ),
    );
    console.error(error);
    process.exit(1);
  }

  try {
    console.log(
      colors.cyan.bold(
        "MIGRATION-COURSES-DROP-LEGACY-PROFESSOR-INDEX: iniciando limpieza...",
      ),
    );

    const collection = CourseAssigned.collection;
    const indexes = (await collection.indexInformation({
      full: true,
    })) as unknown as IndexInfo[];

    const legacyIndexes = indexes.filter(isLegacyProfessorUniqueIndex);

    if (legacyIndexes.length === 0) {
      console.log(
        colors.yellow(
          "  No se encontró ningún índice legacy único sobre { professor: 1 }. Nada que limpiar.",
        ),
      );
    } else {
      for (const index of legacyIndexes) {
        await collection.dropIndex(index.name);
        console.log(
          colors.green(
            `  Índice legacy dropeado: ${index.name} ({ professor: 1 }, unique)`,
          ),
        );
      }
    }

    const synced = await CourseAssigned.syncIndexes();
    console.log(
      colors.green(
        `  CourseAssigned syncIndexes: ${synced ? synced.join(", ") : "(sin cambios)"}`,
      ),
    );

    console.log(
      colors.green.bold(
        "MIGRATION-COURSES-DROP-LEGACY-PROFESSOR-INDEX: limpieza completada.",
      ),
    );
  } catch (error) {
    console.error(
      colors.red.bold(
        "MIGRATION-COURSES-DROP-LEGACY-PROFESSOR-INDEX: error durante la limpieza.",
      ),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(
      colors.gray("MongoDB connection closed (legacy professor index cleanup end)."),
    );
  }
};

void run();
