import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import { SPIRITUAL_GROWTH_STAGES } from "../models/user-profile.model";

dotenv.config();

const VALID_STAGES = SPIRITUAL_GROWTH_STAGES;

const run = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(colors.red.bold("DATABASE_URL no está definida"));
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log(colors.green.bold("Conectado a MongoDB"));

  const db = mongoose.connection.db;
  if (!db) {
    console.error(colors.red.bold("No se pudo obtener la base de datos"));
    process.exit(1);
  }

  const invalidProfileStages = await db
    .collection("userprofiles")
    .find({
      spiritualGrowthStage: { $nin: VALID_STAGES, $ne: null },
    })
    .project({ _id: 1, spiritualGrowthStage: 1, firstName: 1, lastName: 1 })
    .toArray();

  const invalidCourseStages = await db
    .collection("courses")
    .find({
      spiritualGrowthStage: { $nin: VALID_STAGES },
    })
    .project({ _id: 1, spiritualGrowthStage: 1, name: 1 })
    .toArray();

  const stageCounts = await db
    .collection("userprofiles")
    .aggregate([
      { $match: { spiritualGrowthStage: { $ne: null } } },
      { $group: { _id: "$spiritualGrowthStage", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  console.log(colors.cyan("\n--- Resumen de etapas en UserProfile ---"));
  if (stageCounts.length === 0) {
    console.log("No hay perfiles con etapa de crecimiento definida.");
  } else {
    stageCounts.forEach((entry: { _id: string; count: number }) => {
      const valid = VALID_STAGES.includes(entry._id)
        ? colors.green("✓ válido")
        : colors.red("✗ inválido");
      console.log(`  ${entry._id}: ${entry.count} ${valid}`);
    });
  }

  console.log(colors.cyan("\n--- Documentos con etapas inválidas ---"));
  if (invalidProfileStages.length === 0 && invalidCourseStages.length === 0) {
    console.log(colors.green("No se encontraron documentos con etapas inválidas."));
  } else {
    if (invalidProfileStages.length > 0) {
      console.log(
        colors.red(`UserProfile con etapas inválidas (${invalidProfileStages.length}):`),
      );
      invalidProfileStages.forEach(
        (doc: { _id: string; firstName?: string; lastName?: string; spiritualGrowthStage?: string }) =>
          console.log(
            `  - ${doc._id} | ${doc.firstName ?? ""} ${doc.lastName ?? ""} | ${doc.spiritualGrowthStage}`,
          ),
      );
    }
    if (invalidCourseStages.length > 0) {
      console.log(
        colors.red(`Course con etapas inválidas (${invalidCourseStages.length}):`),
      );
      invalidCourseStages.forEach(
        (doc: { _id: string; name?: string; spiritualGrowthStage?: string }) =>
          console.log(`  - ${doc._id} | ${doc.name ?? ""} | ${doc.spiritualGrowthStage}`),
      );
    }
  }

  await mongoose.disconnect();
  console.log(colors.green.bold("\nDesconectado de MongoDB"));

  if (invalidProfileStages.length > 0 || invalidCourseStages.length > 0) {
    process.exit(2);
  }
};

run().catch((error) => {
  console.error(colors.red.bold(error));
  process.exit(1);
});
