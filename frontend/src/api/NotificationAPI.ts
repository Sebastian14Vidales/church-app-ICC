import axios from "axios";
import api from "@/lib/axios";
import {
    markAllNotificationsReadResponseSchema,
    markNotificationReadResponseSchema,
    notificationsResponseSchema,
    type MarkAllNotificationsReadResponse,
    type MarkNotificationReadResponse,
    type NotificationsResponse,
} from "@/types/index";

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
            | { message?: string; errors?: Array<{ msg?: string }> }
            | undefined;

        if (responseData?.message) {
            return responseData.message;
        }

        const firstValidationError = responseData?.errors?.[0]?.msg;
        if (firstValidationError) {
            return firstValidationError;
        }
    }

    return fallbackMessage;
};

export const getMyNotifications = async (limit = 20): Promise<NotificationsResponse> => {
    try {
        const { data } = await api.get("/notifications", { params: { limit } });
        const parsed = notificationsResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de notificaciones invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener las notificaciones"));
    }
};

export const markNotificationRead = async (
    id: string,
): Promise<MarkNotificationReadResponse> => {
    try {
        const { data } = await api.patch(`/notifications/${id}/read`);
        const parsed = markNotificationReadResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de marca de notificacion invalida");
    } catch (error) {
        throw new Error(
            getApiErrorMessage(error, "No se pudo marcar la notificacion como leida"),
        );
    }
};

export const markAllNotificationsRead = async (): Promise<MarkAllNotificationsReadResponse> => {
    try {
        const { data } = await api.patch("/notifications/read-all");
        const parsed = markAllNotificationsReadResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de marca masiva invalida");
    } catch (error) {
        throw new Error(
            getApiErrorMessage(error, "No se pudieron marcar las notificaciones como leidas"),
        );
    }
};
