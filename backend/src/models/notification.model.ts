import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Modelo de persistencia para el módulo de Notificaciones In-App
 * (EPC-NOTIFICATIONS-001).
 *
 * Las notificaciones son inmutables desde el cliente: solo el servidor las crea
 * como reacción a eventos de negocio. El cliente puede marcarlas como leídas
 * mediante el campo `readAt`.
 */

export interface INotification extends Document {
  /** Usuario destinatario de la notificación (la cuenta que inicia sesión). */
  recipientUser: Types.ObjectId;
  /**
   * Tipo de notificación.
   * Hoy el único valor generado por el backend es "course-assignment";
   * el campo se mantiene como string abierto para futuros tipos
   * (event-reminder, life-group-session, etc.).
   */
  type: string;
  /** Título corto de la notificación. */
  title: string;
  /** Cuerpo descriptivo de la notificación. */
  message: string;
  /** Ruta interna del frontend (ej. "/my-courses"). `null` si no aplica. */
  link: string | null;
  /** Fecha de lectura. `null` significa que aún no fue leída. */
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    recipientUser: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Listado por destinatario ordenado por fecha descendente (GET /api/notifications).
NotificationSchema.index(
  { recipientUser: 1, createdAt: -1 },
  { name: "notification_recipient_createdAt" },
);

// Conteo eficiente de notificaciones no leídas por destinatario.
NotificationSchema.index(
  { recipientUser: 1, readAt: 1 },
  {
    name: "notification_recipient_unread",
    partialFilterExpression: { readAt: null },
  },
);

const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);

export default Notification;
