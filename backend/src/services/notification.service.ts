import Notification from "../models/notification.model";
import Role from "../models/role.model";
import User from "../models/user.model";
import { emitRealtimeNotification } from "../realtime/socket";
import { AppError } from "./app-error";
import type {
  CreateNotificationInput,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  Notification as NotificationResponse,
  NotificationsResponse,
} from "../types/notification";

const serializeNotification = (doc: unknown): NotificationResponse => {
  const notification = doc as {
    _id: { toString(): string };
    type: string;
    title: string;
    message: string;
    link: string | null;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  return {
    _id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link ?? null,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
};

export const createNotification = async (
  input: CreateNotificationInput,
): Promise<NotificationResponse> => {
  const created = await Notification.create({
    recipientUser: input.recipientUser,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
  });

  const serialized = serializeNotification(created);

  emitRealtimeNotification([`user:${input.recipientUser}`], {
    notification: serialized,
  });

  return serialized;
};

export const notifyAdmins = async (
  input: Omit<CreateNotificationInput, "recipientUser">,
): Promise<void> => {
  try {
    const adminRoles = await Role.find({
      name: { $in: ["Admin", "Superadmin"] },
    }).select("_id");

    if (adminRoles.length === 0) {
      return;
    }

    const roleIds = adminRoles.map((role) => role._id);
    const adminUsers = await User.find({ roles: { $in: roleIds } }).select("_id");

    if (adminUsers.length === 0) {
      return;
    }

    await Promise.all(
      adminUsers.map((user) =>
        createNotification({
          ...input,
          recipientUser: String(user._id),
        }).catch((error) => {
          // eslint-disable-next-line no-console
          console.error("Error al enviar notificación a administrador", {
            userId: String(user._id),
            error: error instanceof Error ? error.message : String(error),
          });
        }),
      ),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error al notificar a administradores", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const listNotifications = async (
  userId: string,
  limit: number,
): Promise<NotificationsResponse> => {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ recipientUser: userId })
      .sort({ createdAt: -1 })
      .limit(limit),
    Notification.countDocuments({ recipientUser: userId, readAt: null }),
  ]);

  return {
    items: items.map(serializeNotification),
    unreadCount,
  };
};

export const markNotificationRead = async (
  id: string,
  userId: string,
): Promise<MarkNotificationReadResponse> => {
  const notification = await Notification.findOne({
    _id: id,
    recipientUser: userId,
  });

  if (!notification) {
    throw new AppError(404, "Notificación no encontrada");
  }

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return {
    message: "Notificación marcada como leída",
    notification: serializeNotification(notification),
  };
};

export const markAllNotificationsRead = async (
  userId: string,
): Promise<MarkAllNotificationsReadResponse> => {
  const result = await Notification.updateMany(
    { recipientUser: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );

  return {
    message: "Todas las notificaciones fueron marcadas como leídas",
    updatedCount: result.modifiedCount ?? 0,
  };
};
