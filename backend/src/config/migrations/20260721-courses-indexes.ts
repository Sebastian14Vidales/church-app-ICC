/**
 * Sincronización de índices del módulo Cursos — epic EPC-COURSES-001.
 *
 * Responsable: database-engineer
 * Fecha: 2026-07-21
 *
 * ## Qué hace
 * Llama a `Model.syncIndexes()` en `CourseAssigned`, `ClassSession` y
 * `Course`. Mongoose compara los índices definidos en el schema con los
 * existentes en la colección:
 *   - Crea los índices faltantes (por nombre — idempotente).
 *   - NO elimina índices extras a menos que se pase `{ drop: true }` aquí.
 *
 * ## Cuándo ejecutarlo
 * - Opcional en dev: Mongoose con `autoIndex: true` (default) crea los
 *   índices al `mongoose.connect(...)` automáticamente, así que tras levantar
 *   el servidor una vez los índices ya están materializados.
 * - Recomendado en **producción** donde `autoIndex` puede estar deshabilitado
 *   por rendimiento. Una sola ejecución tras cada despliegue que cambie
 *   índices del módulo es suficiente.
 *
 * ## Idempotencia
 * `createIndex` y por extensión `syncIndexes()` son idempotentes a nivel de
 * nombre de índice — re-ejecutar no duplica índices.
 *
 * ## Cómo ejecutarlo
 *   npm run migrate:courses-indexes
 *
 * O directamente con ts-node:
 *   npx ts-node backend/src/config/migrations/20260721-courses-indexes.ts
 *
 * ## Advertencia
 * NO pasar `{ drop: true }` sin ADR previo. Si un índice fue renombrado
 * (p. ej. el unique de profesor activo pasó a llamarse
 * `course_assigned_unique_active_professor`), este script crea el nuevo
 * índice. El índice antiguo con nombre autogenerado por Mongoose (_id de
 * profesor_1) debería limpiarse manualmente con `db.collection.dropIndex()`
 * una vez verificado que el nuevo está activo. Esto se documenta en el ADR.
 *
 * ## Variable de entorno
 * `DATABASE_URL` (la que ya usa `backend/src/config/db.ts`).
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import Course from "../../models/course.model";
import CourseAssigned from "../../models/course-assigned.model";
import ClassSession from "../../models/class-session.model";

dotenv.config();

const syncOne = async (model: mongoose.Model<unknown>): Promise<string> => {
  // No usamos `{ drop: true }` para no eliminar índices extras que otros
  // procesos puedan haber creado manualmente. El método devuelve la lista
  // de índices sincronizados (nombres).
  const dropped = await model.syncIndexes();
  return dropped ? dropped.join(", ") : "(sin cambios)";
};

const run = async (): Promise<void> => {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error(
      colors.red.bold(
        "MIGRATION-COURSES-INDEXES: DATABASE_URL no definida en el entorno.",
      ),
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(db);
    console.log(colors.green.bold("Connected to MongoDB for index sync"));
  } catch (error) {
    console.error(
      colors.red.bold("Error connecting to MongoDB during index sync"),
    );
    console.error(error);
    process.exit(1);
  }

  try {
    console.log(colors.cyan.bold("MIGRATION-COURSES-INDEXES: iniciando sync..."));

    const courseDropped = await syncOne(Course as unknown as mongoose.Model<unknown>);
    console.log(colors.green(`  Course: ${courseDropped}`));

    const assignedDropped = await syncOne(
      CourseAssigned as unknown as mongoose.Model<unknown>,
    );
    console.log(colors.green(`  CourseAssigned: ${assignedDropped}`));

    const sessionDropped = await syncOne(
      ClassSession as unknown as mongoose.Model<unknown>,
    );
    console.log(colors.green(`  ClassSession: ${sessionDropped}`));

    console.log(
      colors.green.bold("MIGRATION-COURSES-INDEXES: sincronización completada."),
    );
  } catch (error) {
    console.error(
      colors.red.bold("MIGRATION-COURSES-INDEXES: error durante la sincronización."),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(colors.gray("MongoDB connection closed (index sync end)."));
  }
};

void run();