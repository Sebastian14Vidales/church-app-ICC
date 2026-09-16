/**
 * Migración: renombrar valores legacy de ministerios en UserProfile.
 *
 * Epic: actualización del catálogo de ministerios
 * Responsable: database-engineer
 * Fecha: 2026-09-15
 *
 * ## Qué hace
 * Renombra los valores legacy almacenados en los campos `ministry` y
 * `ministryInterest` de `UserProfile` para alinearlos con la lista oficial
 * de 14 ministerios exportada en `backend/src/models/user-profile.model.ts`.
 *
 * Mapeo aplicado:
 *   - "Ministerio de Danza (Niñas entre 7 y 14 años)" -> "Ministerio de Danza"
 *   - "Ministerio de Hombres" -> "Ministerio de Varones"
 *   - "Ministerio de Parejas y Familias" -> "Ministerio de Parejas y Familia"
 *   - "Ministerio Iglesia Infantil" -> "Ministerio Infantil"
 *   - "Ministerio de Evangelismo y Consolidación G.V.E" -> "Ministerio de Evangelismo y Consolidación"
 *
 * ## Idempotencia
 * Re-ejecutar el script es seguro: solo actúa sobre documentos cuyo campo
 * contenga exactamente un valor legacy. Si todos los valores ya fueron
 * renombrados, reporta "Nada que migrar" y termina OK.
 *
 * ## No destructiva
 * No elimina documentos ni campos, no modifica valores nulos, vacíos o
 * valores que ya coincidan con la lista oficial.
 *
 * ## Cómo ejecutarlo
 *   npm run migrate:ministries-rename
 *
 * O directamente con ts-node:
 *   npx ts-node backend/src/config/migrations/20260915-ministries-rename.ts
 *
 * ## Requisitos previos
 * - Backup de la base de datos antes de ejecutar.
 * - Variable de entorno `DATABASE_URL` configurada (la misma que usa
 *   `backend/src/config/db.ts`).
 *
 * ## Salida
 * Log con título `MIGRATION-MINISTRIES-RENAME` y conteos
 * `{ field, legacy, renamed }` por campo y totales.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import UserProfile from "../../models/user-profile.model";

dotenv.config();

/**
 * Mapeo de valores legacy a los nombres oficiales actuales.
 * Exportado para facilitar tests unitarios sin base de datos real.
 */
export const MINISTRY_RENAMES: Record<string, string> = {
  "Ministerio de Danza (Niñas entre 7 y 14 años)": "Ministerio de Danza",
  "Ministerio de Hombres": "Ministerio de Varones",
  "Ministerio de Parejas y Familias": "Ministerio de Parejas y Familia",
  "Ministerio Iglesia Infantil": "Ministerio Infantil",
  "Ministerio de Evangelismo y Consolidación G.V.E":
    "Ministerio de Evangelismo y Consolidación",
};

const FIELDS = ["ministry", "ministryInterest"] as const;

interface FieldRenameResult {
  field: string;
  legacy: string;
  renamed: number;
}

const run = async (): Promise<void> => {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error(
      colors.red.bold(
        "MIGRATION-MINISTRIES-RENAME: DATABASE_URL no definida en el entorno.",
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

  const results: FieldRenameResult[] = [];
  let totalRenamed = 0;

  try {
    for (const field of FIELDS) {
      for (const [legacyValue, newValue] of Object.entries(MINISTRY_RENAMES)) {
        const result = await UserProfile.updateMany(
          { [field]: legacyValue },
          { $set: { [field]: newValue } },
        ).exec();

        if (result.modifiedCount > 0) {
          results.push({
            field,
            legacy: legacyValue,
            renamed: result.modifiedCount,
          });
          totalRenamed += result.modifiedCount;

          console.log(
            colors.green(
              `  [renamed] ${field}: "${legacyValue}" -> "${newValue}" (${result.modifiedCount} documentos)`,
            ),
          );
        }
      }
    }

    if (totalRenamed === 0) {
      console.log(
        colors.yellow.bold(
          "MIGRATION-MINISTRIES-RENAME: Nada que migrar (no hay valores legacy pendientes).",
        ),
      );
    } else {
      console.log(
        colors.green.bold(
          "MIGRATION-MINISTRIES-RENAME: migración completada con éxito.",
        ),
      );
      console.log(
        colors.cyan.bold("  Resumen:"),
      );
      for (const { field, legacy, renamed } of results) {
        console.log(
          colors.cyan(`    ${field} | "${legacy}" -> ${renamed} documentos`),
        );
      }
      console.log(
        colors.green.bold(`  Total de documentos renombrados: ${totalRenamed}`),
      );
    }
  } catch (error: unknown) {
    console.error(
      colors.red.bold("MIGRATION-MINISTRIES-RENAME: error durante la migración."),
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
