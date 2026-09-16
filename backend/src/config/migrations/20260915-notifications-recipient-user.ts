/**
 * Migración: cambiar destinatario de notificaciones de UserProfile a User.
 *
 * Epic: EPC-NOTIFICATIONS-001 (hotfix post-mortem recipiente nulo)
 * Responsable: database-engineer
 * Fecha: 2026-09-15
 *
 * ## Qué hace
 * La colección `notifications` fue creada inicialmente con el campo
 * `recipientProfileId`. Tras el incidente de superadmin sin UserProfile,
 * el arquitecto decidió que el destinatario de una notificación in-app es
 * la cuenta de usuario (`User`), no el perfil (`UserProfile`).
 *
 * Para cada documento `Notification` que aún tenga `recipientProfileId`
 * (y no tenga `recipientUser`):
 *   1. Busca el `UserProfile` correspondiente.
 *   2. Si el perfil tiene un `user` asociado:
 *      - `$set` { recipientUser: <user._id> }
 *      - `$unset` { recipientProfileId: "" }
 *   3. Si el perfil no tiene usuario (notificación huérfana):
 *      - Elimina el documento (no podía ser vista por nadie).
 *
 * ## Idempotencia
 * Re-ejecutar el script es seguro: solo procesa documentos con
 * `recipientProfileId` presente y `recipientUser` ausente. Documentos ya
 * migrados o sin campos legacy no se tocan.
 *
 * ## No destructiva (con respecto a datos de usuario)
 * No elimina notificaciones que puedan ser recuperadas. Solo borra
 * aquellas cuyo destinatario no tiene una cuenta de usuario.
 *
 * ## Cómo ejecutarlo
 *   npm run migrate:notifications-recipient-user
 *
 * O directamente con ts-node:
 *   npx ts-node backend/src/config/migrations/20260915-notifications-recipient-user.ts
 *
 * ## Requisitos previos
 * - Backup de la base de datos antes de ejecutar.
 * - Variable de entorno `DATABASE_URL` configurada (la misma que usa
 *   `backend/src/config/db.ts`).
 *
 * ## Salida
 * Log con título `MIGRATION-NOTIFICATIONS-RECIPIENT-USER` y conteos
 * `{ migrated, deleted, skipped }`.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import Notification from "../../models/notification.model";
import UserProfile from "../../models/user-profile.model";

dotenv.config();

interface LegacyNotificationDoc {
  _id: mongoose.Types.ObjectId;
  recipientProfileId: mongoose.Types.ObjectId;
}

interface UserProfileLookup {
  user?: mongoose.Types.ObjectId;
}

const run = async (): Promise<void> => {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error(
      colors.red.bold(
        "MIGRATION-NOTIFICATIONS-RECIPIENT-USER: DATABASE_URL no definida en el entorno.",
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

  const collection = Notification.collection;

  try {
    const pending = await collection
      .find<LegacyNotificationDoc>(
        {
          recipientUser: { $exists: false },
          recipientProfileId: { $exists: true },
        },
        { projection: { recipientProfileId: 1 } },
      )
      .toArray();

    if (pending.length === 0) {
      console.log(
        colors.yellow.bold(
          "MIGRATION-NOTIFICATIONS-RECIPIENT-USER: Nada que migrar (no hay documentos legacy).",
        ),
      );
      return;
    }

    let migrated = 0;
    let deleted = 0;
    const deletedDetails: Array<{ id: string; profileId: string }> = [];

    for (const doc of pending) {
      const profileId = doc.recipientProfileId;
      const profile = (await UserProfile.findById(profileId)
        .select("user")
        .lean()) as UserProfileLookup | null;

      if (profile?.user) {
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: { recipientUser: profile.user },
            $unset: { recipientProfileId: "" },
          },
        );
        migrated += 1;
      } else {
        await collection.deleteOne({ _id: doc._id });
        deleted += 1;
        deletedDetails.push({
          id: doc._id.toString(),
          profileId: profileId.toString(),
        });
        console.log(
          colors.yellow(
            `  [deleted] ${doc._id} | sin user asociado al perfil ${profileId}; documento eliminado.`,
          ),
        );
      }
    }

    if (migrated > 0) {
      console.log(
        colors.green(
          `  [migrated] ${migrated} notificación(es) renombradas a recipientUser.`,
        ),
      );
    }

    if (deleted > 0) {
      console.log(
        colors.yellow(
          `  [deleted]  ${deleted} notificación(es) huérfanas eliminadas.`,
        ),
      );
      console.log(
        colors.gray(
          `    Detalles: ${deletedDetails.map((d) => `${d.id} (perfil ${d.profileId})`).join(", ")}`,
        ),
      );
    }

    console.log(
      colors.green.bold(
        "MIGRATION-NOTIFICATIONS-RECIPIENT-USER: migración completada con éxito.",
      ),
    );
    console.log(
      colors.cyan(`  Total procesado: ${pending.length}`),
    );
    console.log(
      colors.green(`  Migrados: ${migrated}`),
    );
    console.log(
      colors.yellow(`  Eliminados: ${deleted}`),
    );
  } catch (error: unknown) {
    console.error(
      colors.red.bold(
        "MIGRATION-NOTIFICATIONS-RECIPIENT-USER: error durante la migración.",
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
