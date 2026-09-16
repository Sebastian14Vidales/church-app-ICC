/**
 * Contrato API del módulo de Notificaciones In-App (EPC-NOTIFICATIONS-001).
 * Tipos compartidos para validar shapes entre backend y frontend.
 * Lógica de negocio y persistencia permanecen en controllers/services/models.
 */

/** Tipo de notificación. Hoy solo se genera "course-assignment"; abierto a futuros tipos. */
export type NotificationType = string;

/** Notificación serializada tal como viaja en respuestas API y eventos Socket.IO. */
export type Notification = {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Respuesta de `GET /api/notifications?limit=`. */
export type NotificationsResponse = {
  items: Notification[];
  unreadCount: number;
};

/** Respuesta de `PATCH /api/notifications/:id/read`. */
export type MarkNotificationReadResponse = {
  message: string;
  notification: Notification;
};

/** Respuesta de `PATCH /api/notifications/read-all`. */
export type MarkAllNotificationsReadResponse = {
  message: string;
  updatedCount: number;
};

/** Query params de `GET /api/notifications`. */
export type NotificationListQuery = {
  limit?: number;
};

/**
 * Input para crear una notificación desde los servicios de negocio.
 * El backend asigna `recipientUser` según el destinatario (cuenta de usuario).
 */
export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  recipientUser: string;
};

/** Contexto mínimo que recibe el service de notificaciones para filtrar por dueño. */
export type NotificationOwnerContext = {
  callerUserId: string | null | undefined;
};

/** Payload emitido por Socket.IO en el evento `notifications:new`. */
export type NotificationSocketPayload = {
  notification: Notification;
};

/** Salas destinatarias de una notificación. */
export type NotificationTargetRooms = {
  userRooms: string[];
};
