/**
 * Migración: asignar `spiritualGrowthStage` a cursos legacy y renombrar
 * "Finanzas" a "Finanzas y Gobierno".
 *
 * Epic: EPC-COURSES-001 (ADR-0006, ADR-0007)
 * Responsable: database-engineer
 * Fecha: 2026-08-04
 *
 * ## Qué hace
 * Busca cursos activos (`deletedAt: null`) cuyo campo `spiritualGrowthStage`
 * sea `undefined`, no exista o sea `null`. Para cada uno infiere la etapa a
 * partir del nombre normalizado (sin tildes, minúsculas, sin espacios):
 *   - cosmovision / cosmovisón -> "Cosmovisión bíblica"
 *   - caracter cristiano / carácter cristiano -> "Carácter cristiano"
 *   - doctrina -> "Doctrina cristiana"
 *   - finanzas -> "Finanzas y Gobierno"
 *
 * El curso llamado "Finanzas" se renombra a "Finanzas y Gobierno" y se le
 * asigna la etapa homónima. Si ya existe otro curso con ese nombre, se
 * registra el conflicto, no se renombra y solo se asigna la etapa al curso
 * legacy.
 *
 * ## Idempotencia
 * Re-ejecutar el script sobre una base ya migrada encuentra 0 documentos
 * pendientes y termina OK con el mensaje "Nada que migrar".
 *
 * ## Cómo ejecutarlo
 *   npm run migrate:courses-missing-stage
 *
 * O directamente con ts-node:
 *   npx ts-node backend/src/config/migrations/20260804-courses-missing-spiritual-growth-stage.ts
 *
 * ## Requisitos previos
 * - Backup de la base de datos (ADR-0006 §"Decisiones que requieren ratificación").
 * - Variable de entorno `DATABASE_URL` configurada (la misma que usa
 *   `backend/src/config/db.ts`).
 *
 * ## Salida
 * Log con título `MIGRATION-COURSES-MISSING-STAGE` y conteos
 * `{ matched, updated, renamed, skipped, conflicts }`.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import Course from "../../models/course.model";
import { SPIRITUAL_GROWTH_STAGES } from "../../models/user-profile.model";

dotenv.config();

const FINAL_FINANZAS_NAME = "Finanzas y Gobierno";

interface LegacyCourse {
  _id: mongoose.Types.ObjectId;
  name: string;
}

interface MigrationSummary {
  matched: number;
  updated: number;
  renamed: number;
  skipped: number;
  conflicts: number;
}

/**
 * Normaliza un nombre de curso para el mapeo heurístico:
 * - Quita tildes (NFD + diacríticos).
 * - Minúsculas.
 * - Quita espacios en blanco.
 */
export const normalizeCourseName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");

/**
 * Infiere la etapa de crecimiento espiritual a partir del nombre del curso.
 * Devuelve `null` cuando no puede inferirse con seguridad.
 */
export const inferSpiritualGrowthStage = (name: string): string | null => {
  const normalized = normalizeCourseName(name);

  const aliasToStage: Record<string, string> = {
    cosmovision: "Cosmovisión bíblica",
    cosmovison: "Cosmovisión bíblica",
    caractercristiano: "Carácter cristiano",
    doctrina: "Doctrina cristiana",
    finanzas: "Finanzas y Gobierno",
    finanzasgobierno: "Finanzas y Gobierno",
    finanzasygobierno: "Finanzas y Gobierno",
  };

  const stage = aliasToStage[normalized];
  if (!stage || !SPIRITUAL_GROWTH_STAGES.includes(stage)) {
    return null;
  }

  return stage;
};

const buildMissingStageFilter = (): Record<string, unknown> => ({
  $or: [
    { spiritualGrowthStage: { $exists: false } },
    { spiritualGrowthStage: null },
  ],
  deletedAt: null,
});

const printSummary = (summary: MigrationSummary): void => {
  console.log(colors.cyan.bold("MIGRATION-COURSES-MISSING-STAGE"));
  console.log(colors.cyan(`  matched:   ${summary.matched}`));
  console.log(colors.green(`  updated:   ${summary.updated}`));
  console.log(colors.green(`  renamed:   ${summary.renamed}`));
  console.log(colors.yellow(`  skipped:   ${summary.skipped}`));
  console.log(colors.magenta(`  conflicts: ${summary.conflicts}`));
};

const run = async (): Promise<void> => {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error(
      colors.red.bold(
        "MIGRATION-COURSES-MISSING-STAGE: DATABASE_URL no definida en el entorno.",
      ),
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(db);
    console.log(colors.green.bold("Connected to MongoDB for migration"));
  } catch (error: unknown) {
    console.error(
      colors.red.bold("Error connecting to MongoDB during migration"),
    );
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }

  const summary: MigrationSummary = {
    matched: 0,
    updated: 0,
    renamed: 0,
    skipped: 0,
    conflicts: 0,
  };

  const skippedDetails: Array<{ id: string; name: string }> = [];
  const conflictDetails: string[] = [];

  try {
    const missing = (await Course.find(buildMissingStageFilter())
      .lean()
      .exec()) as unknown as LegacyCourse[];

    summary.matched = missing.length;

    if (missing.length === 0) {
      console.log(
        colors.yellow.bold(
          "MIGRATION-COURSES-MISSING-STAGE: Nada que migrar (no hay cursos sin etapa).",
        ),
      );
      return;
    }

    for (const doc of missing) {
      const id = doc._id.toString();
      const { name } = doc;
      const stage = inferSpiritualGrowthStage(name);

      if (!stage) {
        console.log(
          colors.yellow(
            `  [skipped] ${id} | ${name}: no se pudo inferir la etapa`,
          ),
        );
        summary.skipped += 1;
        skippedDetails.push({ id, name });
        continue;
      }

      try {
        if (stage === FINAL_FINANZAS_NAME) {
          const existingConflict = await Course.findOne({
            name: FINAL_FINANZAS_NAME,
            _id: { $ne: doc._id },
          })
            .lean()
            .exec();

          if (existingConflict) {
            await Course.updateOne(
              { _id: doc._id, deletedAt: null },
              { $set: { spiritualGrowthStage: stage } },
            ).exec();

            const message = `  [conflict] ${id} | "${name}" no renombrado a "${FINAL_FINANZAS_NAME}" porque ya existe otro curso con ese nombre; etapa asignada: ${stage}`;
            console.log(colors.magenta(message));
            summary.conflicts += 1;
            conflictDetails.push(message.trim());
            continue;
          }

          await Course.updateOne(
            { _id: doc._id, deletedAt: null },
            { $set: { name: FINAL_FINANZAS_NAME, spiritualGrowthStage: stage } },
          ).exec();

          console.log(
            colors.green(
              `  [renamed] ${id} | "${name}" -> "${FINAL_FINANZAS_NAME}" (etapa: ${stage})`,
            ),
          );
          summary.renamed += 1;
          continue;
        }

        await Course.updateOne(
          { _id: doc._id, deletedAt: null },
          { $set: { spiritualGrowthStage: stage } },
        ).exec();

        console.log(
          colors.green(
            `  [updated] ${id} | "${name}" -> etapa: ${stage}`,
          ),
        );
        summary.updated += 1;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        console.log(
          colors.red(
            `  [error] ${id} | "${name}" no pudo actualizarse: ${reason}`,
          ),
        );
        summary.skipped += 1;
        skippedDetails.push({ id, name: `${name} (error: ${reason})` });
      }
    }

    if (skippedDetails.length > 0) {
      console.log(
        colors.yellow(
          `  skipped details: ${skippedDetails
            .map((s) => `${s.id} (${s.name})`)
            .join(", ")}`,
        ),
      );
    }

    if (conflictDetails.length > 0) {
      console.log(
        colors.magenta(
          `  conflict details: ${conflictDetails.join("; ")}`,
        ),
      );
    }

    printSummary(summary);
  } catch (error: unknown) {
    console.error(
      colors.red.bold(
        "MIGRATION-COURSES-MISSING-STAGE: error durante la migración.",
      ),
    );
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(colors.gray("MongoDB connection closed (migration end)."));
  }
};

if (require.main === module) {
  void run();
}
