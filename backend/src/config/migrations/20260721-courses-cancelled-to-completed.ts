/**
 * Migración: CourseAssigned.cancelled -> CourseAssigned.completed
 *
 * Epic: EPC-COURSES-001 (ADR-0001 §D2)
 * Responsable: database-engineer
 * Fecha: 2026-07-21
 *
 * ## Qué hace
 * Convierte cualquier `CourseAssigned` con `status: "cancelled"` a
 * `status: "completed"`, fijando `endedAt = updatedAt` (el instante real de
 * última actualización del documento, que actuye como proxy del cierre real;
 * ver ADR-0001 §D6). El campo `updatedAt` existe por los timestamps de
 * Mongoose.
 *
 * ## Idempotencia
 * Si no existen documentos con `status: "cancelled"`, la migración reporta
 * "Nada que migrar" y termina OK. Re-ejecutar el script sobre una base ya
 * migrada es seguro (AC2.6).
 *
 * ## Cómo ejecutarlo
 *   npm run migrate:courses-cancelled
 *
 * O directamente con ts-node (ya instalado en el backend, no requiere ADR):
 *   npx ts-node backend/src/config/migrations/20260721-courses-cancelled-to-completed.ts
 *
 * ## Requisitos previos
 * - Realizar un backup de la base de datos antes de ejecutar (riesgo vigilado
 *   en ADR-0001).
 * - Variable de entorno `DATABASE_URL` configurada (la que usa `config/db.ts`).
 *
 * ## Salida
 * Log con título `MIGRATION-COURSES-CANCELLED` y conteos
 * `{ matched, modified }`. No lanza excepción si no hay nada que migrar.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import CourseAssigned from "../../models/course-assigned.model";

dotenv.config();

const run = async (): Promise<void> => {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error(
      colors.red.bold(
        "MIGRATION-COURSES-CANCELLED: DATABASE_URL no definida en el entorno.",
      ),
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(db);
    console.log(colors.green.bold("Connected to MongoDB for migration"));
  } catch (error) {
    console.error(
      colors.red.bold("Error connecting to MongoDB during migration"),
    );
    console.error(error);
    process.exit(1);
  }

  try {
    // Preflight: ¿hay algo que migrar?
    const pendingCount = await CourseAssigned.countDocuments({
      status: "cancelled",
    }).exec();

    if (pendingCount === 0) {
      console.log(
        colors.yellow.bold(
          "MIGRATION-COURSES-CANCELLED: Nada que migrar (no hay documentos con status=\"cancelled\").",
        ),
      );
      return;
    }

    // Aggregation pipeline update: usa el campo existente `updatedAt` del
    // documento (provisto por timestamps de Mongoose) como valor de `endedAt`.
    // La sintaxis de array en el segundo argumento indica "update pipeline"
    // (no operadores $set clásicos), permitiendo referenciar "$updatedAt".
    const result = await CourseAssigned.updateMany(
      { status: "cancelled" },
      [{ $set: { status: "completed", endedAt: "$updatedAt" } }],
    ).exec();

    console.log(
      colors.green.bold(
        "MIGRATION-COURSES-CANCELLED: migración completada con éxito.",
      ),
    );
    console.log(
      colors.green(
        `  matched: ${result.matchedCount}  modified: ${result.modifiedCount}`,
      ),
    );
  } catch (error) {
    console.error(
      colors.red.bold("MIGRATION-COURSES-CANCELLED: error durante la migración."),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(colors.gray("MongoDB connection closed (migration end)."));
  }
};

void run();